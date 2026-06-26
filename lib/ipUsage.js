// Shared anonymous-usage tracker, used by every AI tool endpoint so repeat anonymous
// visitors can be nudged harder to sign up next time. Keyed by IP, no TTL — usage
// history should persist across visits, not just within a session.

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export async function logAndCheckUsage(req, { kvUrl, kvToken }, tool) {
  if (!kvUrl || !kvToken) return { count: 0, shouldNudge: false };

  const ip = getClientIp(req);
  if (ip === 'unknown') return { count: 0, shouldNudge: false };

  try {
    const key = `iplog:${ip}`;
    const getResp = await fetch(`${kvUrl}/get/${key}`, { headers: { authorization: `Bearer ${kvToken}` } });
    const getData = await getResp.json();

    let record;
    try { record = JSON.parse(getData?.result); } catch { record = null; }
    const now = new Date().toISOString();

    if (!record) {
      record = { count: 0, tools: [], firstSeen: now };
    }
    record.count += 1;
    if (!record.tools.includes(tool)) record.tools.push(tool);
    record.lastSeen = now;

    await fetch(`${kvUrl}/set/${key}/${encodeURIComponent(JSON.stringify(record))}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });

    return { count: record.count, shouldNudge: record.count >= 2 };
  } catch {
    return { count: 0, shouldNudge: false };
  }
}
