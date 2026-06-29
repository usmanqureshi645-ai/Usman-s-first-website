import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { createHash } from 'node:crypto';

// AWS Polly Neural voice list price (us-east-1): $16.00 per 1,000,000 characters. Used by the
// admin dashboard to ESTIMATE TTS cost from char counts — this is list pricing, not a real bill.
export const POLLY_PRICE_PER_CHAR = 16 / 1_000_000;

// Local copy of metrics.js's private day key helper (intentionally duplicated rather than
// importing a non-exported helper across modules). YYYY-MM-DD in UTC.
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

const PERSONA_VOICES = {
  'Sarah Bennett': { voice: 'Joanna', language: 'en-GB' },
  'David Whitfield': { voice: 'Brian', language: 'en-GB' },
  'Amelia Hartley': { voice: 'Amy', language: 'en-GB' },
  'Marcus Lee': { voice: 'Arthur', language: 'en-GB' },
  'Elena Rossi': { voice: 'Raveena', language: 'en-GB' },
  'James Carter': { voice: 'Russell', language: 'en-GB' },
  'Charlotte Sinclair': { voice: 'Emma', language: 'en-GB' },
  'Eleanor Hughes': { voice: 'Salli', language: 'en-US' },
  'Quiz Coach': { voice: 'Joanna', language: 'en-GB' },
  'default': { voice: 'Matthew', language: 'en-US' },
};

// Polly's neural engine only honours <prosody rate> and <prosody volume> -
// pitch is NOT supported on neural voices, so distinctiveness between
// characters comes from the VoiceId choice (PERSONA_VOICES) plus rate/volume.
const PERSONA_VOICE_SETTINGS = {
  'Sarah Bennett': { rate: '1.05', loudness: '+8dB' },
  'David Whitfield': { rate: '1.0', loudness: '+6dB' },
  'Amelia Hartley': { rate: '1.1', loudness: '+7dB' },
  'Marcus Lee': { rate: '1.0', loudness: '+6dB' },
  'Elena Rossi': { rate: '1.15', loudness: '+8dB' },
  'James Carter': { rate: '1.05', loudness: '+7dB' },
  'Charlotte Sinclair': { rate: '1.05', loudness: '+7dB' },
  'Eleanor Hughes': { rate: '1.05', loudness: '+7dB' },
  'Quiz Coach': { rate: '1.1', loudness: '+8dB' },
  'default': { rate: '1.0', loudness: '+6dB' },
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

// Amazon Polly's <amazon:emotion> SSML tag only works on a handful of neural
// voices (Joanna, Matthew) - using it on unsupported voices (Brian, Amy,
// Arthur, Raveena, Russell, Emma, Salli) causes synthesis to fail and fall
// back to robotic browser TTS, so it's gated to supported voices only.
const EMOTION_CAPABLE_VOICES = new Set(['Joanna', 'Matthew']);

function addEmotionalMarkup(text, voiceId) {
  if (!text || !EMOTION_CAPABLE_VOICES.has(voiceId)) return text;

  const hasQuestion = /\?/.test(text);
  const hasExclamation = /!/.test(text);

  let emotion = 'excited';
  let intensity = 'medium';

  if (hasExclamation && hasQuestion) {
    intensity = 'high';
  } else if (!hasQuestion && !hasExclamation) {
    emotion = 'calm';
    intensity = 'medium';
  }

  return `<amazon:emotion name="${emotion}" intensity="${intensity}">${text}</amazon:emotion>`;
}

function getPersonaVoice(personaName) {
  return PERSONA_VOICES[personaName] || PERSONA_VOICES['default'];
}

// Bump this when synthesis settings change (SSML, rate, volume, voice) so
// stale 30-day-cached audio from before the change is bypassed automatically.
const CACHE_VERSION = 'v2';

function getCacheKey(text, personaName) {
  const hash = createHash('sha256').update(text + personaName + CACHE_VERSION).digest('hex');
  return `tts:${hash}`;
}

async function synthesizeWithPolly(text, personaName, pollyClient) {
  const config = getPersonaVoice(personaName);
  const settings = PERSONA_VOICE_SETTINGS[personaName] || PERSONA_VOICE_SETTINGS['default'];
  const cleanedText = cleanText(text);

  // Leave headroom below Polly's 3000-char input cap, since the SSML wrapper
  // tags added below count toward that same limit.
  if (!cleanedText || cleanedText.length === 0 || cleanedText.length > 2800) {
    return null;
  }

  const emotionalText = addEmotionalMarkup(escapeSsml(cleanedText), config.voice);
  const ssmlText = `<speak><prosody rate="${settings.rate}" volume="${settings.loudness}">${emotionalText}</prosody></speak>`;

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
