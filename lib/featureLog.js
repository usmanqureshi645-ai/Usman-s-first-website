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
