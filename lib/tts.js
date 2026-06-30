import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { createHash } from 'node:crypto';

// AWS Polly Neural voice list price (us-east-1): $16.00 per 1,000,000 characters. Used by the
// admin dashboard to ESTIMATE TTS cost from char counts — this is list pricing, not a real bill.
export const POLLY_PRICE_PER_CHAR = 16 / 1_000_000;

// Local copy of metrics.js's private day key helper (intentionally duplicated rather than
// importing a non-exported helper across modules). YYYY-MM-DD in UTC.
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

// Each persona gets a distinct voice. Accent spread across US, UK British, Australian,
// Indian English — the full range Polly's neural engine offers for English TTS.
// (Polly has no Russian/Spanish/Arabic-accented English voices; ElevenLabs does.)
const PERSONA_VOICES = {
  'Sarah Bennett':      { voice: 'Kimberly', language: 'en-US' }, // US female
  'David Whitfield':    { voice: 'Brian',    language: 'en-GB' }, // UK male
  'Amelia Hartley':     { voice: 'Kevin',    language: 'en-US' }, // US male (same as Quiz Coach — user requested)
  'Marcus Lee':         { voice: 'Joey',     language: 'en-US' }, // US male, younger energy
  'Elena Rossi':        { voice: 'Kendra',   language: 'en-US' }, // US female, distinct from Kimberly/Salli
  'James Carter':       { voice: 'Matthew',  language: 'en-US' }, // US male, emotion-capable
  'Charlotte Sinclair': { voice: 'Salli',    language: 'en-US' }, // US female (same as Eleanor — user requested)
  'Eleanor Hughes':     { voice: 'Salli',    language: 'en-US' }, // US female (user requested original voice back)
  'Quiz Coach':         { voice: 'Kevin',    language: 'en-US' }, // US male
  'default':            { voice: 'Brian',    language: 'en-GB' }, // UK male (David's voice — user requested for GAAP)
};

// Each persona has a distinct rate (1.0–1.15) for a unique speech rhythm.
// Volume is high across the board to project energy and presence.
const PERSONA_VOICE_SETTINGS = {
  'Sarah Bennett':      { rate: '1.05', loudness: '+8dB' },  // warm, measured
  'David Whitfield':    { rate: '1.10', loudness: '+8dB' },  // deliberate, authoritative
  'Amelia Hartley':     { rate: '1.08', loudness: '+9dB' },  // upbeat, warm
  'Marcus Lee':         { rate: '1.12', loudness: '+10dB' }, // high energy, punchy
  'Elena Rossi':        { rate: '1.15', loudness: '+9dB' },  // most energetic
  'James Carter':       { rate: '1.14', loudness: '+9dB' },  // high energy, emotion-capable
  'Charlotte Sinclair': { rate: '1.1',  loudness: '+9dB' },  // enthusiastic
  'Eleanor Hughes':     { rate: '1.07', loudness: '+8dB' },  // warm, encouraging, emotion-capable
  'Quiz Coach':         { rate: '1.13', loudness: '+9dB' },  // quiz-show energy
  'default':            { rate: '1.05', loudness: '+8dB' },  // balanced (GAAP Champion)
};

function getPollyClient() {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!accessKey || !secretKey) {
    return null;
  }

  return new PollyClient({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });
}

function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*\*(.+?)\*\*:\s*/g, '')
    .replace(/^(Hi, I'm|Hello, I'm|I'm)\s+\w+\s+\w+[.,!]?\s*/gim, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/[*_#`~>]/g, '')
    .replace(/[\p{Emoji}]/gu, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeSsml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Inject short natural pauses at sentence and clause boundaries.
// Must be called AFTER escapeSsml so the inserted <break> tags are not escaped.
// Deterministic (no randomness) so the cache key stays stable for identical text.
function addNaturalPauses(text) {
  return text
    // Pause after exclamations between sentences — dramatic beat
    .replace(/! ([A-Z])/g, '! <break time="600ms"/>$1')
    // Pause after questions between sentences — let the question land
    .replace(/\? ([A-Z])/g, '? <break time="500ms"/>$1')
    // Shorter pause between regular sentences
    .replace(/\. ([A-Z])/g, '. <break time="350ms"/>$1')
    // Very short pause after commas in longer clauses (adds natural rhythm)
    .replace(/, ([a-z])/g, ', <break time="150ms"/>$1');
}

// Polly's <amazon:emotion> tag is ONLY supported on Joanna and Matthew (neural engine).
// Every other English neural voice (Kendra, Kimberly, Salli, Kevin, Joey, Brian, Arthur,
// Olivia, Raveena, etc.) throws "Emotion tags are not supported for this voice" and the
// catch block returns null → browser TTS fallback. Keep this list to confirmed voices only.
const EMOTION_CAPABLE_VOICES = new Set(['Joanna', 'Matthew']);

function addEmotionalMarkup(text, voiceId) {
  if (!text || !EMOTION_CAPABLE_VOICES.has(voiceId)) return text;

  const hasExclamation = /!/.test(text);
  const hasQuestion = /\?/.test(text);
  const wordCount = text.split(/\s+/).length;

  // Default is excited/high — these are expressive, engaging characters.
  // Only pull back to medium for short factual statements.
  let emotion = 'excited';
  let intensity = 'high';

  if (hasQuestion && !hasExclamation) {
    // Questions stay excited but not at maximum — sounds more genuinely curious
    intensity = 'medium';
  } else if (!hasExclamation && !hasQuestion && wordCount < 12) {
    // Very short neutral statements — medium so it doesn't sound forced
    intensity = 'medium';
  }

  return `<amazon:emotion name="${emotion}" intensity="${intensity}">${text}</amazon:emotion>`;
}


function getPersonaVoice(personaName) {
  return PERSONA_VOICES[personaName] || PERSONA_VOICES['default'];
}

// Bump this when synthesis settings change (SSML, rate, volume, voice, pauses) so
// stale 30-day-cached audio from before the change is bypassed automatically.
const CACHE_VERSION = 'v7';

function getCacheKey(text, personaName) {
  const hash = createHash('sha256').update(text + personaName + CACHE_VERSION).digest('hex');
  return `tts:${hash}`;
}

async function synthesizeWithPolly(text, personaName, pollyClient) {
  const config = getPersonaVoice(personaName);
  const settings = PERSONA_VOICE_SETTINGS[personaName] || PERSONA_VOICE_SETTINGS['default'];
  const cleanedText = cleanText(text);

  // Leave headroom below Polly's 3000-char input cap — SSML wrapper tags, break elements,
  // and emotion/domain tags can add ~400 chars of overhead on a fully annotated response.
  if (!cleanedText || cleanedText.length === 0 || cleanedText.length > 2500) {
    return null;
  }

  const escaped = escapeSsml(cleanedText);
  const withPauses = addNaturalPauses(escaped);
  const withEmotion = addEmotionalMarkup(withPauses, config.voice);
  const ssmlText = `<speak><prosody rate="${settings.rate}" volume="${settings.loudness}">${withEmotion}</prosody></speak>`;

  try {
    const command = new SynthesizeSpeechCommand({
      Text: ssmlText,
      OutputFormat: 'mp3',
      VoiceId: config.voice,
      Engine: 'neural',
      LanguageCode: config.language,
      TextType: 'ssml',
    });

    const response = await pollyClient.send(command);
    if (!response.AudioStream) {
      return null;
    }

    const audioBuffer = await response.AudioStream.transformToByteArray?.();
    if (!audioBuffer) {
      return null;
    }

    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (err) {
    console.error('[TTS] Polly synthesis failed:', err.message);
    return null;
  }
}

async function updateUsageCounter(kv, charCount) {
  if (!kv || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return;
  }

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const auth = { Authorization: `Bearer ${token}` };
    // All-time cumulative counter (INCR, always +1's the body operand).
    await fetch(`${url}/incr/tts:usage:chars`, { method: 'POST', headers: auth, body: JSON.stringify([charCount]) });
    // Per-day counter for the Costs tab's 30-day Polly trend. INCRBY takes its operand in the
    // URL path (unlike INCR above), matching the Upstash REST convention used elsewhere.
    await fetch(`${url}/incrby/tts:usage:chars:${dayKey()}/${charCount}`, { method: 'POST', headers: auth });
  } catch {
    // Silent fail on usage tracking
  }
}

export async function synthesize(text, personaName, options = {}) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const kv = options.kv;
  const cacheKey = getCacheKey(text, personaName);

  if (kv) {
    try {
      const cached = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${cacheKey}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      }).then(r => r.json());

      if (cached?.result) {
        return cached.result;
      }
    } catch {
      // Cache miss or error, continue
    }
  }

  const pollyClient = getPollyClient();
  if (!pollyClient) {
    return null;
  }

  const audioUrl = await synthesizeWithPolly(text, personaName, pollyClient);

  if (audioUrl && kv) {
    const charCount = text.length;
    await updateUsageCounter(kv, charCount);

    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (redisUrl && redisToken) {
        await fetch(`${redisUrl}/set/${cacheKey}/${encodeURIComponent(audioUrl)}/EX/2592000`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${redisToken}` },
        });
      }
    } catch {
      // Cache write failed, still return the audio
    }
  }

  return audioUrl || null;
}
