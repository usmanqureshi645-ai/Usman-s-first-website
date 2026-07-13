# Keyword Ranking & Monitoring Strategy

**Goal:** Track organic search performance for your 15 blog articles + 7 tool pages  
**Timeline:** Start tracking now, measure progress in 30/60/90 days  
**Tools:** Google Search Console (free), Google Analytics (free), optional paid (Ahrefs, SEMrush, Moz)

---

## Phase 1: Free Tools (What You Already Have)

### Google Search Console (Do This First)

**Submit your sitemap** (see `01_Google_Search_Console_Setup.md`), then:

1. Go to **Performance** tab
2. Set **date range** to "Last 28 days"
3. Click **+ New** (next to "Filters") → **Query**
4. Search for one of your target keywords (e.g., "IFRS 16")
5. See:
   - **Impressions** (how many times Google showed your page)
   - **Clicks** (how many people visited from Google)
   - **CTR** (click-through rate — % of impressions that led to clicks)
   - **Position** (your average rank, e.g., #3, #15, #42)

**This is free, real organic data.** GSC is the source of truth.

### Google Analytics 4 (Once You Add Your GA ID)

Once GA4 is wired, you'll see:
- Which keywords brought visitors (once they land on your page)
- How long they stay
- Which pages/CTAs they click
- Bounce rate (did they leave immediately?)

**Note:** GA4 shows traffic *after* people click. GSC shows *before* they click. Both are essential.

---

## Target Keywords (Phase 2 + 3 Content)

### HIGH Priority (Ranking #1-10 = Core Revenue/Brand Signal)

| Keyword | Target Rank | Article/Page | Current Status |
|---------|-------------|--------------|-----------------|
| IFRS vs US GAAP | #3-7 | blog/ifrs-vs-us-gaap-comparison.html | TBD |
| IFRS 16 lease accounting | #5-10 | blog/ifrs-16-lease-accounting-example.html | TBD |
| Audit interview prep | #3-7 | interview-prep.html | TBD |
| CV writing guide | #5-10 | blog/accountant-cv-writing-guide.html | TBD |

### MEDIUM Priority (Ranking #10-20 = Topic Authority)

| Keyword | Target Rank | Article/Page | Current Status |
|---------|-------------|--------------|-----------------|
| Revenue recognition IFRS 15 | #10-15 | blog/revenue-recognition-ifrs-15-vs-asc-606-deep-dive.html | TBD |
| IFRS 18 presentation | #10-15 | blog/ifrs-18-presentation-guide.html | TBD |
| Accounting interview questions | #10-15 | blog/acca-interview-questions-answers.html | TBD |
| Technical interview questions accounting | #10-20 | blog/accounting-interview-technical-questions.html | TBD |

### LONG TAIL (Specific, Less Competitive)

| Keyword | Target Rank | Article/Page | Current Status |
|---------|-------------|--------------|-----------------|
| Goodwill impairment IAS 36 vs ASC 350 | #15-30 | goodwill-impairment-ias-36-vs-asc-350-deep-dive.html | TBD |
| Lease accounting IFRS 16 vs ASC 842 | #15-30 | lease-accounting-ifrs-16-vs-asc-842-deep-dive.html | TBD |
| PCAOB audit standards | #20-30 | blog/pcaob-standards-audit-quality-guide.html | TBD |

---

## Tracking Workflow (Monthly)

### Week 1 of Month (E.g., July 1)

1. **Open Google Search Console** → Performance tab
2. **Set date range:** "Last 28 days"
3. **For each keyword in the table above:**
   - Search for it in the "Query" filter
   - Note the **position** (rank), **clicks**, **impressions**
   - Update the "Current Status" column
4. **Sum up the data:**
   - Total impressions across all keywords
   - Total clicks (organic traffic)
   - Average CTR
5. **Save this as a CSV or Google Sheet** — track trends over time

### What Good Looks Like

**After 30 days:**
- ✅ At least 1-2 keywords getting impressions (even if rank is #50+)
- ✅ A few keywords ranking in top 20

**After 60 days:**
- ✅ High-priority keywords starting to rank in top 30-20
- ✅ Organic clicks increasing week-over-week

**After 90 days:**
- ✅ Some keywords ranking in top 10
- ✅ Consistent organic traffic (even if small — 10-50 visitors/day is realistic for new content)

---

## If a Keyword Isn't Ranking (Troubleshooting)

**Symptom:** Keyword gets 0 impressions after 30+ days.  
**Causes & Fixes:**

1. **Page is too new** (< 7 days)
   - ✅ Fix: Wait. Google crawls new pages slower.

2. **Your page isn't linked from anywhere**
   - ✅ Fix: Add internal links from:
     - Your Knowledge Hub (did you link to all 15 articles? Check `knowledge-hub.html`)
     - Home page (add a mention in hero or footer)
     - Related blog articles (blog/index.html mentions all 15)

3. **Title/heading doesn't match the keyword**
   - ✅ Fix: Check the blog article's `<title>` and `<h1>`. Must include the keyword.
   - Example: `<title>IFRS 16 Lease Accounting Explained | Deep Dive — Usman Qureshi</title>`

4. **Content is too thin** (< 1500 words)
   - ✅ Fix: Add more depth — examples, comparison tables, worked cases
   - Your Phase 3 blog articles should all be 2000-3000+ words

5. **Better competitors rank higher**
   - ✅ Fix: Link-building (Phase 4 — guest posts, backlinks) — see `04_Phase_4_Backlinks_Strategy.md`

---

## Optional Paid Tools (Paid Phase 4+)

If you want deeper insights, these tools track rankings across search engines:

| Tool | Cost | Best For | Alternative |
|------|------|----------|-------------|
| Ahrefs | $99-399/mo | Competitor analysis, backlink tracking | SEMrush, Moz |
| SEMrush | $99-499/mo | Keyword research, rank tracking | Ahrefs, Moz |
| Moz | $79-599/mo | Rank tracking, DA/PA metrics | Ahrefs, SEMrush |
| Google Search Console | FREE | Real organic data, impressions/clicks | — |

**My recommendation for now:** Stick with GSC (free) + GA4 (free) for 90 days. If you want to invest in paid tools after you have baseline data, Ahrefs is the most accurate for rank tracking.

---

## Sample Tracking Sheet (Copy This)

**Create a Google Sheet with this structure** (one row per keyword, update monthly):

```
Keyword | Target Rank | Jun 1 Rank | Jul 1 Rank | Aug 1 Rank | Trend | Notes
IFRS vs US GAAP | #3-7 | #42 | #28 | #15 | 📈 Improving | Adding internal links helped
Audit interview prep | #3-7 | #68 | #52 | #38 | 📈 Improving | Good CTR (12%), needs top-10 links
```

**Columns:**
- **Keyword** — the search term
- **Target Rank** — where you want to rank
- **Monthly Rank** — fill in from GSC each month
- **Trend** — 📈 improving, 📉 declining, ➡️ stable
- **Notes** — what changed? Did you add links? Update content? Publish related article?

---

## Next Steps

1. ✅ **This week:** Submit sitemap to GSC (see `01_Google_Search_Console_Setup.md`)
2. ✅ **Week 2:** Check GSC Performance → see if keywords are getting impressions yet
3. ✅ **Month 1 (end):** Fill in the "Current Status" column above with real GSC data
4. ✅ **Month 2-3:** Track trends, identify gaps, consider link-building for stuck keywords
5. ✅ **Month 3+:** Phase 4 — backlinks & guest posts (see `04_Phase_4_Backlinks_Strategy.md`)

---

**File Last Updated:** 2026-07-04  
**Review Frequency:** Monthly
