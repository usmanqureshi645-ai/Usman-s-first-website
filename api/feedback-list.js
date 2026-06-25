export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Storage not configured yet' });
    return;
  }

  // Simple shared-secret check so this isn't publicly listable — reuses the KV token itself
  const provided = req.query?.key || req.headers['x-feedback-key'];
  if (provided !== kvToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const limit = Math.min(parseInt(req.query?.limit, 10) || 50, 500);
    const r = await fetch(`${kvUrl}/lrange/feedback_log/0/${limit - 1}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const data = await r.json();
    const entries = (data.result || []).map(s => {
      try { return JSON.parse(s); } catch { return { raw: s }; }
    });
    res.status(200).json({ count: entries.length, entries });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
