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
  if (!user) { res.status(401).json({ error: 'Sign up free to use AskAI' }); return; }

  const { history } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'ask');
  if (usage.limited) { res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' }); return; }

  const system = `You are a helpful, general-purpose AI assistant embedded on a personal/professional website (a personal "ChatGPT-style" assistant for whoever is visiting, currently chatting with ${user.name}). Answer any question helpfully, clearly and concisely, on any topic — not limited to finance or accounting, though the site owner is a Big 4 audit/advisory professional so finance questions are especially welcome.

CURRENT DATE: Today is 2026. When answering questions about current events, markets, technology, or professional standards, use 2026 as your reference point. Adjust any time-based calculations or trend assessments accordingly.

Style:
- Be direct and helpful, like a knowledgeable friend, not overly formal.
- Use markdown formatting (headings, bold, lists) where it genuinely helps clarity.
- Keep responses reasonably concise unless the question calls for depth.
- If asked who you are, explain you're a general-purpose AI assistant on this website, separate from the site's specialised tools (Meeting Room, GAAP Compare, Knowledge Test).`;

  const messages = history.map(m => ({ role: m.role, content: m.content }));

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
        max_tokens: 1000,
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
    const audioUrl = await synthesize(text, 'default', { kv: { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN } });
    res.status(200).json({ text, audioUrl: audioUrl || null, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
