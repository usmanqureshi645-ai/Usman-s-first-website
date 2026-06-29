// Reads the per-day AWS Polly character counters that lib/tts.js's updateUsageCounter writes
// (tts:usage:chars:{day}) and converts them to an ESTIMATED dollar cost using the same
// POLLY_PRICE_PER_CHAR list-price constant tts.js exports. This is an estimate (Polly list
// pricing), not a real AWS bill — the Costs tab labels it as such.

import { pipe } from './metrics.js';
import { POLLY_PRICE_PER_CHAR } from './tts.js';

function dayKeyAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Returns { byDay:[{date,chars,usd}], totalUsd, totalChars, allTimeChars, allTimeUsd, pricePerChar }.
export async function getPollyCostTrend(kv, days = 30) {
  const dayList = [];
  const commands = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKeyAgo(i);
    dayList.push(d);
    commands.push(['GET', `tts:usage:chars:${d}`]);
  }
  commands.push(['GET', 'tts:usage:chars']); // all-time cumulative total (for the "since tracking began" stat)

  const r = await pipe(kv, commands);

  const byDay = dayList.map((d, i) => {
    const chars = num(r[i]);
    return { date: d, chars, usd: chars * POLLY_PRICE_PER_CHAR };
  });
  const totalChars = byDay.reduce((s, d) => s + d.chars, 0);
  const totalUsd = totalChars * POLLY_PRICE_PER_CHAR;
  const allTimeChars = num(r[days]);

  return {
    byDay,
    totalUsd,
    totalChars,
    allTimeChars,
    allTimeUsd: allTimeChars * POLLY_PRICE_PER_CHAR,
    pricePerChar: POLLY_PRICE_PER_CHAR,
  };
}
