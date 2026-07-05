// Shared per-IP usage tracker, used by every AI tool endpoint for rate-limiting and
// for the admin dashboard's unique-vs-repeat feature split. Keyed by IP, no TTL — usage
// history should persist across visits, not just within a session.

import { recordToolUse } from './metrics.js';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 20;

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Fixed-window counter per IP across all AI tools combined. Self-expiring (no cleanup needed).
async function isRateLimited(kvUrl, kvToken, ip) {
  try {
    const key = `ratelimit:${ip}`;
    const incrResp = await fetch(`${kvUrl}/incr/${key}`, { headers: { authorization: `Bearer ${kvToken}` } });
    const incrData = await incrResp.json();
    const count = incrData?.result;
    if (count === 1) {
      await fetch(`${kvUrl}/expire/${key}/${RATE_LIMIT_WINDOW_SECONDS}`, { headers: { authorization: `Bearer ${kvToken}` } });
    }
    return count > RATE_LIMIT_MAX_REQUESTS;
  } catch {
    return false; // fail open — don't block legitimate traffic if Redis has a hiccup
  }
}

export async function logAndCheckUsage(req, { kvUrl, kvToken }, tool) {
  if (!kvUrl || !kvToken) return { count: 0, limited: false };

  const ip = getClientIp(req);
  if (ip === 'unknown') return { count: 0, limited: false };

  const limited = await isRateLimited(kvUrl, kvToken, ip);
  if (limited) return { count: 0, limited: true };

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
    // Whether this IP has used THIS tool before — drives the unique-vs-repeat split on the dashboard.
    const isRepeat = record.tools.includes(tool);
    record.count += 1;
    if (!isRepeat) record.tools.push(tool);
    record.lastSeen = now;

    await fetch(`${kvUrl}/set/${key}/${encodeURIComponent(JSON.stringify(record))}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });

    // Global per-feature aggregation for the admin dashboard (non-fatal).
    await recordToolUse({ kvUrl, kvToken }, tool, isRepeat);

    return { count: record.count, limited: false };
  } catch {
    return { count: 0, limited: false };
  }
}
