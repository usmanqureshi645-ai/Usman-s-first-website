# SEO Ops — Playbook-Adopted Tactics (Live Runbook)

**Created:** 2026-07-13
**Purpose:** The recurring, data-driven SEO actions absorbed from the "SEO Growth Playbook"
(500 → 200k impressions). This is the *operational* companion to `02_Keyword_Ranking_Strategy.md`.
Our depth-per-paragraph moat stays; these tactics sit on top.

---

## 0. What's automated vs what needs Usman

| Task | Who | Why |
|---|---|---|
| robots.txt AI-crawler allowlist | ✅ Done (Claude) | GPTBot/ClaudeBot/PerplexityBot/Google-Extended explicitly allowed |
| Canonical/OG → www | ✅ Done (Claude) | Matches the apex→www 308 redirect |
| Title/meta CTR rewrites | Claude, **once GSC data pasted** | Needs real pos 8–20 queries — blind rewrites risk hurting current rankers |
| Bing Webmaster setup | **Usman** (5 min) | Account creation — Claude cannot create accounts |
| Weekly GSC export | **Usman** (2 min) | Claude can't read your Search Console; paste the CSV and Claude analyses |

---

## 1. Bing Webmaster Tools (one-time, Usman does — ~5 min)

Free extra impressions; Bing also powers ChatGPT/Copilot web results.

1. Go to **bing.com/webmasters** → sign in with the same Google account you use for GSC.
2. Click **Import from Google Search Console** (fastest — pulls the verified property + sitemap
   automatically). If import fails, choose **Add site manually** → enter
   `https://www.uqconsulting.org` → verify via the **CNAME / meta-tag** option.
3. Once verified: **Sitemaps → Submit** → `https://www.uqconsulting.org/sitemap.xml`.
4. **Configure → Crawl Control:** leave default. Done.

*After this: paste the Bing "Search Performance" export into a session the same way as GSC below.*

---

## 2. Weekly GSC ritual (Usman pulls data → Claude analyses)

**Every Monday (2 min for you):**
1. GSC → **Performance → Search results**.
2. Date range: **Last 28 days**. Toggle ON: Impressions, Clicks, CTR, Position.
3. **Queries** tab → **Export → CSV** (or Google Sheets).
4. **Pages** tab → **Export → CSV**.
5. Paste both into a Claude session with: *"weekly GSC review"*.

**Claude then reports (automated):**
- Total impressions / clicks / avg CTR vs last week.
- Query buckets: # in pos 1–3, 4–10, 11–20, 21+.
- **Striking-distance list** (pos 8–20) — the rewrite queue (§3).
- Top gainers / losers (pages that moved ≥3 positions).
- Indexed-count check.

---

## 3. Striking-distance play (pos 8–20) — highest-ROI quick win

The playbook's core move: improving near-page-1 pages beats writing new ones.

**Trigger:** paste the GSC Queries CSV. Claude filters to `8 ≤ position ≤ 20` with impressions > 0.

**Per striking-distance query, Claude:**
1. Finds the ranking page (from the Pages CSV / by topic match).
2. Inserts the **exact query phrasing** into the page's `<title>`, `<h1>`, and one `<h2>`.
3. Expands the matching section (+150–300 words) so the page answers that query directly in the
   first 2 sentences under the H2 (featured-snippet + AI-answer extraction).
4. Adds an FAQ entry for the query if missing (with FAQPage JSON-LD).
5. Bumps `dateModified`.
6. You re-request indexing in GSC (**URL Inspection → Request Indexing**).

---

## 4. Title/meta CTR formula (applied during §3, not blind)

**Title** (≤60 chars): `<Primary keyword> <IAS/IFRS ref>: <hook> (2026)`
- e.g. `Inventory Valuation: IAS 2 vs ASC 330 Deep Dive (2026)` ✅ already live
- Hooks that lift CTR for our audience: `Worked Example`, `Journal Entries`, `Free Guide`,
  `Deep Dive`, `Explained`.

**Meta description** (≤160 chars): lead with the keyword, promise the concrete answer, include
`worked example` + `free` + `ACCA/ACA` where natural.
- e.g. `IAS 36 goodwill impairment explained with a worked WACC example, journal entries and
  real FTSE case studies. Free ACA/ACCA guide.`

---

## 5. Intent weighting (target ~40% commercial-comparison / 60% informational)

Our clusters are heavily informational. Tag each target keyword and rebalance:

| Intent | Keyword shape | Our coverage | Action |
|---|---|---|---|
| **Comparison** (commercial) | "IFRS X vs ASC/US GAAP", "IAS X vs …" | 7 deep-dive articles | ✅ strong — these are the CTR-priority pages |
| **Tool / transactional** | "free IFRS calculator", "CV review free", "GAAP compare tool" | tool pages exist | Add "free tool" landing intent to tool-page titles/meta |
| **Informational** | "how to calculate X under IAS N", "what is …" | 40+ articles | ✅ dominant — keep, but ensure question-shaped H2s |

**Rule going forward:** every *new* article gets an intent tag in `blogCatalog.js` topics
(or a note) so the mix stays balanced.

---

## 6. AI-search (LLM) visibility checklist — per article

Baked into the Track-3 pipeline's Polish stage, but verify on any manual edit:
- [ ] Question-shaped H2s ("How is goodwill impairment tested under IAS 36?")
- [ ] First 2 sentences under each H2 directly answer it (RAG-extractable)
- [ ] Article + FAQPage + BreadcrumbList JSON-LD valid
- [ ] Correct standard numbers (enforced by `tests/meta.standards.spec.js`)
- [ ] `robots.txt` allows the AI crawlers (✅ done)

---

## 7. Content-refresh loop (every 4–6 weeks)

Refreshing existing rankers beats new posts click-for-click.
1. Pull GSC; find pages with **declining** position or **high impressions / low CTR**.
2. Update year in title, add 1–2 new sub-questions surfaced by GSC queries, refresh any stale
   figures/case studies, bump `dateModified`.
3. Re-request indexing.

---

## 8. Backlinks / digital-PR (Phase 4, ongoing — see `04_Phase_4_Backlinks_Strategy.md`)
- One original data piece (e.g. "State of IFRS 16 lease disclosure in the FTSE 100") as a
  citable asset.
- Promote the free AI tools as linkable assets (HARO/Connectively answers, unlinked-mention
  reclamation, competitor backlink-gap).

---

**Next data-gated action:** Usman pastes the GSC Queries + Pages CSV → Claude runs §2 + §3.
