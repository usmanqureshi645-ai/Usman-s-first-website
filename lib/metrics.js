// Lightweight analytics layer on top of the existing Upstash Redis (REST) store.
// Every helper is wrapped so a metrics failure never breaks the user-facing flow that
// triggered it. Reads use the Upstash /pipeline endpoint to fetch everything the admin
// dashboard needs in a single round-trip. See dashboard.html + account.js (?action=track
// / ?action=dashboard) for the consumers.

// Tool keys mirror the strings each AI endpoint passes to logAndCheckUsage() — keep in sync.
export const TOOLS = ['meeting', 'quiz', 'gaap', 'tailor', 'cv-review', 'ask', 'fsreview'];

// Known free-tier ceilings, surfaced on the dashboard so limits are caught early.
export const LIMITS = { emailPerDay: 100, emailPerMonth: 3000 };

const PRESENCE_WINDOW_MS = 120000; // a visitor counts as "live" if seen in the last 2 minutes

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }   // YYYY-MM-DD
function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); }  // YYYY-MM
function dayKeyAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

// Run a batch of Redis commands in one request via the Upstash REST pipeline endpoint.
// commands: array of arg-arrays, e.g. [['INCR','k'], ['GET','k2']]. Exported so lib/featureLog.js
// and lib/exportData.js can reuse it instead of duplicating the Upstash-pipeline-POST logic.
export async function pipe({ kvUrl, kvToken }, commands) {
  if (!kvUrl || !kvToken || !commands.length) return [];
  const resp = await fetch(`${kvUrl}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${kvToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const data = await resp.json();
  // Upstash returns [{result: ...}, {error: ...}, ...] in command order.
  return Array.isArray(data) ? data.map(r => (r && 'result' in r ? r.result : null)) : [];
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export async function recordVisit(kv, vid) {
  if (!vid) return;
  const day = dayKey();
  try {
    await pipe(kv, [
      ['INCR', 'metrics:visits:total'],
      ['INCR', `metrics:visits:${day}`],
      ['PFADD', 'metrics:uniq:all', vid],
      ['PFADD', `metrics:uniq:${day}`, vid],
    ]);
  } catch { /* non-fatal */ }
}

export async function recordPresence(kv, vid) {
  if (!vid) return;
  const now = Date.now();
  try {
    await pipe(kv, [
      ['ZADD', 'presence_zset', String(now), vid],
      ['ZREMRANGEBYSCORE', 'presence_zset', '0', String(now - PRESENCE_WINDOW_MS)],
    ]);
  } catch { /* non-fatal */ }
}

export async function recordEmail(kv) {
  try {
    await pipe(kv, [
      ['INCR', `metrics:email:${dayKey()}`],
      ['INCR', `metrics:email:${monthKey()}`],
      ['INCR', 'metrics:email:total'],
    ]);
  } catch { /* non-fatal */ }
}

export async function recordToolUse(kv, tool, isRepeat) {
  if (!tool) return;
  try {
    await pipe(kv, [
      ['INCR', `metrics:tool:${tool}:total`],
      ['INCR', `metrics:tool:${tool}:${isRepeat ? 'repeat' : 'users'}`],
      ['INCR', `metrics:invocations:${monthKey()}`],
    ]);
  } catch { /* non-fatal */ }
}

export async function recordSignup(kv, { name, email, company, department, departmentOther, designation, designationOther, country, city }) {
  try {
    const entry = JSON.stringify({
      name, email, company, department, departmentOther, designation, designationOther,
      country, city, createdAt: new Date().toISOString(),
    });
    await pipe(kv, [
      ['INCR', 'metrics:signups:total'],
      ['INCR', `metrics:signups:${dayKey()}`],   // per-day counter, mirrors recordVisit's total+day pair (powers dashboard "today"/"this week")
      ['LPUSH', 'signups_log', entry],
      ['LTRIM', 'signups_log', '0', '4999'],
    ]);
  } catch { /* non-fatal */ }
}

// Percentage change today vs yesterday. Returns null when yesterday is 0 (avoid divide-by-zero
// and a meaningless "infinity%" jump on the first day a metric appears).
function pctChange(today, yesterday) {
  if (!yesterday) return null;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

// Append `days` worth of visits+unique trend reads (oldest -> newest, 2 commands per day) to
// `commands`. Returns the base offset + the day list so callers can parse the results back out.
function buildTrendCommands(commands, days) {
  const trendBase = commands.length;
  const trendDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKeyAgo(i);
    trendDays.push(d);
    commands.push(['GET', `metrics:visits:${d}`]);
    commands.push(['PFCOUNT', `metrics:uniq:${d}`]);
  }
  return { trendBase, trendDays };
}

// Single-request read of everything the admin Overview tab renders.
export async function getDashboardData(kv) {
  const now = Date.now();
  const today = dayKey();
  const yesterday = dayKeyAgo(1);
  const month = monthKey();

  const commands = [
    ['ZREMRANGEBYSCORE', 'presence_zset', '0', String(now - PRESENCE_WINDOW_MS)], // 0: prune stale first
    ['ZCARD', 'presence_zset'],                  // 1: live now
    ['GET', 'metrics:visits:total'],             // 2
    ['GET', `metrics:visits:${today}`],          // 3
    ['PFCOUNT', 'metrics:uniq:all'],             // 4
    ['PFCOUNT', `metrics:uniq:${today}`],        // 5
    ['GET', 'metrics:signups:total'],            // 6
    ['LRANGE', 'signups_log', '0', '199'],       // 7
    ['GET', `metrics:email:${today}`],           // 8
    ['GET', `metrics:email:${month}`],           // 9
    ['GET', 'metrics:email:total'],              // 10
    ['GET', `metrics:invocations:${month}`],     // 11
  ];
  // New fixed reads for %-change deltas + the manually-set Anthropic balance. Indices captured
  // from push() so adding more reads later never silently shifts these.
  const iVisitsYesterday  = commands.push(['GET', `metrics:visits:${yesterday}`]) - 1;
  const iSignupsToday     = commands.push(['GET', `metrics:signups:${today}`]) - 1;
  const iSignupsYesterday = commands.push(['GET', `metrics:signups:${yesterday}`]) - 1;
  const iBalance          = commands.push(['GET', 'dashboard:anthropic_balance']) - 1;

  // Per-tool block; 3 commands per tool.
  const toolBase = commands.length;
  TOOLS.forEach(t => {
    commands.push(['GET', `metrics:tool:${t}:total`]);
    commands.push(['GET', `metrics:tool:${t}:users`]);
    commands.push(['GET', `metrics:tool:${t}:repeat`]);
  });

  // 7-day visits/unique trend.
  const { trendBase, trendDays } = buildTrendCommands(commands, 7);

  // 7 daily signup counters for the "this week" sum. (Only accrues from deploy onward, so the
  // first week post-deploy shows partial data — acceptable, same caveat as any new counter.)
  const signupWeekBase = commands.length;
  const signupWeekDays = [];
  for (let i = 6; i >= 0; i--) {
    signupWeekDays.push(dayKeyAgo(i));
    commands.push(['GET', `metrics:signups:${dayKeyAgo(i)}`]);
  }

  const r = await pipe(kv, commands);

  const signups = (Array.isArray(r[7]) ? r[7] : [])
    .map(s => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);

  const tools = TOOLS.map((t, i) => {
    const o = toolBase + i * 3;
    return { tool: t, total: num(r[o]), uniqueUsers: num(r[o + 1]), repeatUses: num(r[o + 2]) };
  });

  const trend = trendDays.map((d, i) => {
    const o = trendBase + i * 2;
    return { date: d, visits: num(r[o]), unique: num(r[o + 1]) };
  });

  const visitsToday = num(r[3]);
  const visitsYesterday = num(r[iVisitsYesterday]);
  const signupsToday = num(r[iSignupsToday]);
  const signupsYesterday = num(r[iSignupsYesterday]);
  const signupsThisWeek = signupWeekDays.reduce((sum, _d, i) => sum + num(r[signupWeekBase + i]), 0);

  let anthropicBalance = null;
  try { anthropicBalance = r[iBalance] ? JSON.parse(r[iBalance]) : null; } catch { anthropicBalance = null; }

  return {
    generatedAt: new Date().toISOString(),
    live: num(r[1]),
    visitors: {
      total: num(r[2]), today: visitsToday, uniqueAll: num(r[4]), uniqueToday: num(r[5]),
      yesterday: visitsYesterday, pctChangeVsYesterday: pctChange(visitsToday, visitsYesterday),
    },
    signups: {
      total: num(r[6]), today: signupsToday, yesterday: signupsYesterday, thisWeek: signupsThisWeek,
      pctChangeVsYesterday: pctChange(signupsToday, signupsYesterday), recent: signups,
    },
    tools,
    trend,
    email: { today: num(r[8]), month: num(r[9]), total: num(r[10]), limits: LIMITS },
    vercel: { invocationsThisMonth: num(r[11]) },
    anthropicBalance,
  };
}

// 30-day visits/unique trend for the Usage tab. Kept separate from getDashboardData so the
// 15s-polled Overview payload doesn't carry 30 days of data on every tick.
export async function getVisitorTrend30(kv) {
  const commands = [];
  const { trendBase, trendDays } = buildTrendCommands(commands, 30);
  const r = await pipe(kv, commands);
  return trendDays.map((d, i) => {
    const o = trendBase + i * 2;
    return { date: d, visits: num(r[o]), unique: num(r[o + 1]) };
  });
}

// Atomically "claims" the 80%-usage alert for the current day/month (SET NX), so the
// owner-alert email in lib/email.js fires at most once per period. Returns which alerts
// to send now plus the current counts.
export async function claimEmailAlerts(kv) {
  const day = dayKey(), month = monthKey();
  let todayCount = 0, monthCount = 0;
  try {
    const c = await pipe(kv, [['GET', `metrics:email:${day}`], ['GET', `metrics:email:${month}`]]);
    todayCount = num(c[0]); monthCount = num(c[1]);
  } catch { return { day: false, month: false, todayCount: 0, monthCount: 0 }; }

  const out = { day: false, month: false, todayCount, monthCount };
  try {
    if (todayCount >= Math.floor(LIMITS.emailPerDay * 0.8)) {
      const s = await pipe(kv, [['SET', `metrics:alert:email:day:${day}`, '1', 'NX', 'EX', '172800']]);
      out.day = s[0] === 'OK';
    }
    if (monthCount >= Math.floor(LIMITS.emailPerMonth * 0.8)) {
      const s = await pipe(kv, [['SET', `metrics:alert:email:month:${month}`, '1', 'NX', 'EX', '2764800']]);
      out.month = s[0] === 'OK';
    }
  } catch { /* non-fatal */ }
  return out;
}
