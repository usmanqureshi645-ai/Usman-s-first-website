import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { createHash } from 'node:crypto';

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

function getPersonaVoice(personaName) {
  return PERSONA_VOICES[personaName] || PERSONA_VOICES['default'];
}

function getCacheKey(text, personaName) {
  const hash = createHash('sha256').update(text + personaName).digest('hex');
  return `tts:${hash}`;
}

async function synthesizeWithPolly(text, personaName, pollyClient) {
  const config = getPersonaVoice(personaName);
  const cleanedText = cleanText(text);

  if (!cleanedText || cleanedText.length === 0 || cleanedText.length > 3000) {
    return null;
  }

  try {
    const command = new SynthesizeSpeechCommand({
      Text: cleanedText,
      OutputFormat: 'mp3',
      VoiceId: config.voice,
      Engine: 'neural',
      LanguageCode: config.language,
      SpeechRate: '1.15',
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
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/incr/tts:usage:chars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      body: JSON.stringify([charCount]),
    });
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
