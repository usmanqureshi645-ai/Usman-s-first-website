import { getUserFromRequest } from '../lib/auth.js';
import { saveConsultation } from '../lib/consultations.js';

const ALLOWED_TOOLS = new Set(['gaap', 'cv-review', 'cv-tailor', 'ask']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Workspace service not configured yet' });
    return;
  }

  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Sign up free to save this to your workspace' });
    return;
  }

  const { tool, title, transcript, summaryHtml } = req.body || {};
  if (!ALLOWED_TOOLS.has(tool) || !title || (!transcript && !summaryHtml)) {
    res.status(400).json({ error: 'Missing tool, title, or content to save' });
    return;
  }

  try {
    const id = await saveConsultation({
      kvUrl, kvToken,
      email: user.email,
      tool,
      title: String(title).slice(0, 80),
      transcript: transcript || null,
      summaryHtml: summaryHtml || null,
    });
    res.status(200).json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
