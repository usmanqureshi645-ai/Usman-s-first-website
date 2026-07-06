import { buildMeetingSystemPrompt } from '../lib/meetingPersonas.js';
import { logAndCheckUsage } from '../lib/ipUsage.js';
import { getUserFromRequest } from '../lib/auth.js';
import { synthesize } from '../lib/tts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Sign up free to start a Meeting Room session' }); return; }

  const { history, agents } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'meeting');
  if (usage.limited) { res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' }); return; }

  const system = buildMeetingSystemPrompt(agents);

  // Anthropic 400s on empty/whitespace-only content blocks. A single empty turn
  // (e.g. a previous reply that came back blank and got pushed into the client's
  // history) would then make EVERY subsequent call in that session fail — which
  // reads to the user as the panel being "temporarily unavailable" again and
  // again until they reload. Drop empty turns and any leading assistant turns so
  // the first message is always a user turn.
  let messages = history
    .filter(m => {
      if (m.role !== 'user' && m.role !== 'assistant') return false;
      // Support both string content and content blocks (arrays with text/document/image)
      if (typeof m.content === 'string') {
        return m.content.trim().length > 0;
      } else if (Array.isArray(m.content)) {
        // Keep content-block messages even if they don't have text, since they may have documents/images
        return m.content.length > 0;
      }
      return false;
    })
    .map(m => {
      // Anthropic API expects content to be either a string or an array of content blocks
      return { role: m.role, content: m.content };
    });
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (messages.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    const text = data?.content?.[0]?.text || '';
    const kvOpts = { kv: { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN } };

    // Parse "**Name**: message" speaker segments and synthesize each with their own voice
    const segParts = text.split(/\*\*([^*]+)\*\*:\s*/).filter(Boolean);
    let audioUrl = null;
    let segments = null;
    if (segParts.length > 1) {
      const speakerSegs = [];
      for (let i = 0; i < segParts.length; i += 2) {
        if (segParts[i] && segParts[i+1]) speakerSegs.push({ speaker: segParts[i].trim(), text: segParts[i+1].trim() });
      }
      const results = await Promise.all(
        speakerSegs.map(s => synthesize(s.text, s.speaker, kvOpts).then(url => ({ speaker: s.speaker, audioUrl: url || null })))
      );
      segments = results;
    } else {
      audioUrl = await synthesize(text, agents?.[0] || 'default', kvOpts);
    }
    res.status(200).json({ text, audioUrl: audioUrl || null, segments: segments || null, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
