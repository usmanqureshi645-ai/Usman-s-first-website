import { buildQuizSystemPrompt } from '../lib/quizCoach.js';
import { logAndCheckUsage } from '../lib/ipUsage.js';
import { getUserFromRequest } from '../lib/auth.js';
import { synthesize } from '../lib/tts.js';
import { getProfile } from '../lib/profile.js';

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
  if (!user) { res.status(401).json({ error: 'Sign up free to start Interview Prep' }); return; }

  const { history } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'quiz');
  if (usage.limited) { res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' }); return; }

  let system = buildQuizSystemPrompt();

  // Safety net for CV access: if the client didn't already embed the candidate's CV in the
  // kickoff, pull it from their saved workspace profile so the coach can tailor questions to
  // their real background. Keeps the coach working even if the client-side profile hadn't loaded.
  try {
    const kickoff = history.find(m => m.role === 'user')?.content || '';
    const alreadyHasCv = /provided (?:their|your) CV/i.test(kickoff);
    if (!alreadyHasCv) {
      const profile = await getProfile({ kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN, email: user.email });
      if (profile?.cv && profile.cv.trim()) {
        system += `\n\nThe candidate has a CV saved in their workspace. Use it to tailor questions to their real background rather than asking them to summarise it — briefly confirm you can see it. CV:\n<<<${profile.cv.slice(0, 12000)}>>>`;
      }
    }
  } catch { /* profile lookup is best-effort */ }

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
        max_tokens: 320,
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
    const audioUrl = await synthesize(text, 'Quiz Coach', { kv: { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN } });
    res.status(200).json({ text, audioUrl: audioUrl || null, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
