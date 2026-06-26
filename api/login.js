import { verifyPassword, setSessionCookie, normalizeEmail } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Accounts service not configured yet' });
    return;
  }

  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@') || !password) {
    res.status(400).json({ error: 'Please provide your email and password' });
    return;
  }

  try {
    const getResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const getData = await getResp.json();
    if (!getData?.result) {
      res.status(401).json({ error: 'No account found with that email — sign up free instead?' });
      return;
    }

    const user = JSON.parse(getData.result);
    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    setSessionCookie(res, { email: user.email, name: user.name });
    res.status(200).json({ ok: true, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
