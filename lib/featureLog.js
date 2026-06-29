// Tracks GENUINE feature completions for the weekly Excel export (Part 2 of
// WEBSITE_LAUNCH_SUMMARY_DATABASE.md) — separate from lib/metrics.js's recordToolUse(),
// which counts every single AI message regardless of whether the session was a real,
// complete use or just a quick test. Both systems coexist for different purposes.

import { pipe } from './metrics.js';

export const FEATURE_USAGE_LOG_KEY = 'feature_usage_log';
export const FEATURE_USAGE_LOG_CAP = 5000; // permanent business dataset feeding the weekly export, not a rolling debug log
export const FEATURE_RATINGS_LOG_KEY = 'feature_ratings_log';
export const FEATURE_RATINGS_LOG_CAP = 5000;

// Per-tool minimum thresholds for "this was a genuine session, not a quick test/trial".
// Tunable per tool since some tools are naturally terser per-turn than others.
const THRESHOLDS = {
  meeting: { minUserMessages: 2, minUserChars: 60 },
  quiz: { minUserMessages: 2, minUserChars: 60 },
  gaap: { minUserMessages: 2, minUserChars: 40 },
  default: { minUserMessages: 2, minUserChars: 40 },
};

// transcript: array of {role:'user'|'assistant', content:string}. opts.tool selects the
// threshold profile. Resumed sessions are judged on the FULL transcript (mrHistory/qzHistory/
// gaapHistory already include everything from the prior session, not just the new turns).
export function isMeaningfulSession(transcript, opts = {}) {
  if (!Array.isArray(transcript) || transcript.length === 0) return false;
  const t = THRESHOLDS[opts.tool] || THRESHOLDS.default;
  const userMsgs = transcript.filter(m => m && m.role === 'user' && typeof m.content === 'string');
  if (userMsgs.length < t.minUserMessages) return false;
  const totalChars = userMsgs.reduce((sum, m) => sum + m.content.trim().length, 0);
  return totalChars >= t.minUserChars;
}

// detail: free-form small object specific to the tool (e.g. {framework} for fsreview,
// {resumed:true} for a resumed session, {messageCount} for cv-review chat).
export async function logFeatureUse(kv, { tool, email, detail }) {
  try {
    const entry = JSON.stringify({
      tool,
      email: email || null,
      detail: detail || {},
      loggedAt: new Date().toISOString(),
    });
    await pipe(kv, [
      ['RPUSH', FEATURE_USAGE_LOG_KEY, entry],
      ['LTRIM', FEATURE_USAGE_LOG_KEY, String(-FEATURE_USAGE_LOG_CAP), '-1'],
    ]);
  } catch { /* non-fatal — never break the user-facing flow that triggered this */ }
}

export async function logFeatureRating(kv, { email, rating, feature }) {
  try {
    const entry = JSON.stringify({
      email: email || null,
      rating: Number(rating) || null,
      feature: feature || 'unspecified',
      loggedAt: new Date().toISOString(),
    });
    await pipe(kv, [
      ['RPUSH', FEATURE_RATINGS_LOG_KEY, entry],
      ['LTRIM', FEATURE_RATINGS_LOG_KEY, String(-FEATURE_RATINGS_LOG_CAP), '-1'],
    ]);
  } catch { /* non-fatal */ }
}

// ─── Dashboard read-side aggregation (Usage tab) ────────────────────────────────
// feature_usage_log is written with a broader set of tool strings than metrics.js's canonical
// 7 TOOLS (e.g. cv-review-chat / cv-review-score split, plus the resume-session pseudo-tool, and
// NO tailor/ask entries). These derived views are therefore best-effort, not authoritative — the
// all-time leaderboard (metrics:tool:* via getDashboardData's tools[]) is the source of truth.
export const TOOL_NORMALIZE = { 'cv-review-chat': 'cv-review', 'cv-review-score': 'cv-review' };
export function normalizeToolName(raw) { return TOOL_NORMALIZE[raw] || raw; }

function safeParse(raw) { try { return JSON.parse(raw); } catch { return null; } }

// One pipelined read of both logs, post-processed entirely in JS into the aggregates the Usage
// tab needs. kv: { kvUrl, kvToken }. No extra Redis round-trips beyond the two LRANGEs.
export async function getUsageAggregates(kv) {
  const [usageRaw, ratingsRaw] = await pipe(kv, [
    ['LRANGE', FEATURE_USAGE_LOG_KEY, '0', '-1'],
    ['LRANGE', FEATURE_RATINGS_LOG_KEY, '0', '-1'],
  ]);
  const usage = (Array.isArray(usageRaw) ? usageRaw : []).map(safeParse).filter(Boolean);
  const ratings = (Array.isArray(ratingsRaw) ? ratingsRaw : []).map(safeParse).filter(Boolean);

  const today = new Date().toISOString().slice(0, 10);
  const since30 = Date.now() - 30 * 86400000;

  const todayCounts = {};   // { tool: count } for entries logged today
  const trend30 = {};       // { tool: { 'YYYY-MM-DD': count } } over the last 30 days
  usage.forEach(u => {
    const tool = normalizeToolName(u.tool);
    const loggedDate = (u.loggedAt || '').slice(0, 10);
    if (loggedDate === today) todayCounts[tool] = (todayCounts[tool] || 0) + 1;
    const ts = new Date(u.loggedAt).getTime();
    if (Number.isFinite(ts) && ts >= since30) {
      trend30[tool] = trend30[tool] || {};
      trend30[tool][loggedDate] = (trend30[tool][loggedDate] || 0) + 1;
    }
  });

  const ratingSums = {}, ratingCounts = {};   // keyed by feature
  ratings.forEach(rt => {
    if (!rt.rating) return;
    const key = rt.feature || 'unspecified';
    ratingSums[key] = (ratingSums[key] || 0) + rt.rating;
    ratingCounts[key] = (ratingCounts[key] || 0) + 1;
  });
  const avgRatings = Object.keys(ratingSums).map(feature => ({
    feature, avg: ratingSums[feature] / ratingCounts[feature], count: ratingCounts[feature],
  })).sort((a, b) => b.avg - a.avg);

  return { todayCounts, trend30, avgRatings, logSize: usage.length, ratingsLogSize: ratings.length };
}

// Picks the single most-used tool today from a todayCounts map. Returns { tool, count } or null.
export function getMostUsedToolToday(todayCounts) {
  const entries = Object.entries(todayCounts || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { tool: entries[0][0], count: entries[0][1] };
}
