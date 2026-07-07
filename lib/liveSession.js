// Cross-device live conversation store. Each logged-in user's in-progress conversation for a
// given tool is mirrored to Redis so a second device (phone + laptop) stays in sync: every
// exchange is auto-saved here, and open tools poll for a newer revision to pull the other
// device's messages.
//
// Stored under livesession:<email>:<tool> as a single JSON blob { tool, history, meta, rev,
// updatedAt } with a 7-day TTL (a stale draft shouldn't live forever). Monotonic `rev` is the
// version the clients compare; writes are last-write-wins (a tiny race window if two devices
// reply in the same instant is accepted). Uses Upstash's POST command form so long transcripts
// aren't constrained by URL length.

const TTL_SECONDS = 7 * 24 * 60 * 60;
export const LIVE_TOOLS = ['meeting', 'quiz', 'gaap', 'ask', 'cv-chat'];

function key(email, tool) { return `livesession:${email}:${tool}`; }

async function cmd(kvUrl, kvToken, args) {
  const resp = await fetch(kvUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${kvToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!resp.ok) throw new Error('kv error ' + resp.status);
  return resp.json();
}

export async function getLiveSession({ kvUrl, kvToken, email, tool }) {
  if (!kvUrl || !kvToken || !email || !tool) return null;
  const { result } = await cmd(kvUrl, kvToken, ['GET', key(email, tool)]);
  if (!result) return null;
  try { return JSON.parse(result); } catch { return null; }
}

export async function saveLiveSession({ kvUrl, kvToken, email, tool, history, meta }) {
  if (!kvUrl || !kvToken || !email || !tool) return null;
  const existing = await getLiveSession({ kvUrl, kvToken, email, tool });
  const rec = {
    tool,
    history: Array.isArray(history) ? history : [],
    meta: meta && typeof meta === 'object' ? meta : {},
    rev: (existing?.rev || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  await cmd(kvUrl, kvToken, ['SET', key(email, tool), JSON.stringify(rec), 'EX', String(TTL_SECONDS)]);
  return rec;
}

export async function clearLiveSession({ kvUrl, kvToken, email, tool }) {
  if (!kvUrl || !kvToken || !email || !tool) return;
  await cmd(kvUrl, kvToken, ['DEL', key(email, tool)]);
}
