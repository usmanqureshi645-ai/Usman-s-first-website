// Pulls REAL Anthropic spend from the org-level Admin API (Usage & Cost Report).
//
// Requires ANTHROPIC_ADMIN_API_KEY — an Admin key (sk-ant-admin01-...) created at
// Console → Settings → Admin keys. This is DISTINCT from the chat ANTHROPIC_API_KEY; the chat
// key cannot call this endpoint (it 401s). When the admin key is missing we degrade gracefully
// so the Costs tab shows a "not configured" banner instead of crashing.
//
// CRITICAL: the cost_report `amount` field is a decimal STRING in the lowest currency unit
// (cents) — e.g. "123.78912" represents $1.2378912. Dollars = amount / 100. This conversion
// lives in exactly one place: centsToDollars() below. Get it wrong and every figure is 100x off.

import { pipe } from './metrics.js';

const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';
const ANTHROPIC_VERSION = '2023-06-01';
const CACHE_TTL_SECONDS = 600; // 10 min — keeps the Costs tab fresh without hammering the API

function centsToDollars(amountStr) {
  const n = parseFloat(amountStr);
  return Number.isFinite(n) ? n / 100 : 0;
}

function todayCacheKey() {
  return `cache:anthropic_cost_report:${new Date().toISOString().slice(0, 10)}`;
}

// Fetches the last `days` days of cost data, paginating via next_page until has_more is false.
// Returns { ok, byDay:[{date,totalUsd}], totalUsd, byDescription:[{description,usd}], fetchedAt }.
export async function getAnthropicCostReport({ kvUrl, kvToken, adminApiKey, days = 30 }) {
  if (!adminApiKey) {
    return { ok: false, error: 'ANTHROPIC_ADMIN_API_KEY not configured', byDay: [], totalUsd: 0, byDescription: [] };
  }

  // Cache check (10-min TTL, keyed by today's date so each new UTC day invalidates naturally).
  if (kvUrl && kvToken) {
    try {
      const [cached] = await pipe({ kvUrl, kvToken }, [['GET', todayCacheKey()]]);
      if (cached) { const parsed = JSON.parse(cached); if (parsed) return parsed; }
    } catch { /* fall through to a live call */ }
  }

  const startingAt = new Date(Date.now() - days * 86400000).toISOString();
  const byDayMap = {};    // date -> totalUsd
  const byDescMap = {};   // description -> totalUsd
  let nextPage = null;
  let pageCount = 0;

  try {
    do {
      const url = new URL(COST_REPORT_URL);
      url.searchParams.set('starting_at', startingAt);
      url.searchParams.set('bucket_width', '1d');
      url.searchParams.append('group_by', 'description');
      if (nextPage) url.searchParams.set('page', nextPage);

      const resp = await fetch(url, {
        headers: { 'x-api-key': adminApiKey, 'anthropic-version': ANTHROPIC_VERSION },
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        return { ok: false, error: `Anthropic API ${resp.status}: ${errBody.slice(0, 200)}`, byDay: [], totalUsd: 0, byDescription: [] };
      }
      const data = await resp.json();
      (data.data || []).forEach(bucket => {
        const day = (bucket.starting_at || '').slice(0, 10);
        (bucket.results || []).forEach(item => {
          const usd = centsToDollars(item.amount);
          byDayMap[day] = (byDayMap[day] || 0) + usd;
          const desc = item.description || item.cost_type || 'other';
          byDescMap[desc] = (byDescMap[desc] || 0) + usd;
        });
      });
      nextPage = data.has_more ? data.next_page : null;
      pageCount++;
    } while (nextPage && pageCount < 20); // hard safety cap against a malformed has_more/next_page loop
  } catch (err) {
    return { ok: false, error: `Anthropic cost report failed: ${err.message}`, byDay: [], totalUsd: 0, byDescription: [] };
  }

  const byDay = Object.keys(byDayMap).sort().map(date => ({ date, totalUsd: byDayMap[date] }));
  const totalUsd = byDay.reduce((s, d) => s + d.totalUsd, 0);
  const byDescription = Object.entries(byDescMap)
    .map(([description, usd]) => ({ description, usd }))
    .sort((a, b) => b.usd - a.usd);

  const result = { ok: true, byDay, totalUsd, byDescription, fetchedAt: new Date().toISOString() };

  if (kvUrl && kvToken) {
    try {
      await pipe({ kvUrl, kvToken }, [['SET', todayCacheKey(), JSON.stringify(result), 'EX', String(CACHE_TTL_SECONDS)]]);
    } catch { /* non-fatal — caching is best-effort */ }
  }
  return result;
}
