import { getUserFromRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Workspace service not configured yet' });
    return;
  }

  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  try {
    const listResp = await fetch(`${kvUrl}/lrange/consultations:${user.email}/0/199`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const listData = await listResp.json();
    const records = (Array.isArray(listData?.result) ? listData.result : [])
      .map(raw => { try { return JSON.parse(raw); } catch { return null; } })
      .filter(Boolean);

    res.status(200).json({ ok: true, name: user.name, email: user.email, consultations: records });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
