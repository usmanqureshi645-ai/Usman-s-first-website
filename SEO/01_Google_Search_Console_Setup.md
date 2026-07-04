# Google Search Console Setup & Monitoring

**Status:** Ready to submit (GSC verification file already in place)  
**Priority:** HIGH — unlocks indexing acceleration + real organic search metrics  
**Estimated time:** 5 minutes to submit, then monitor for 24-48 hours

---

## One-Time Setup (You do this once)

### 1. Verify Domain in Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sign in with your Google account (same one you use for Gmail/Drive)
3. Click **"Add property"** (top left)
4. Select **"URL prefix"** (easier than "Domain" — doesn't require DNS record)
5. Enter: `https://uqconsulting.org`
6. Click **"Continue"**
7. Choose **"HTML file"** verification method
8. It will offer to download a file — **don't download it**, we already have it
9. Just click **"Verify"** and it will scan your live site for the existing `google936b19e7579920fc.html` file
10. ✅ Verified!

### 2. Submit Your Sitemap

1. In GSC, go to **Sitemaps** (left sidebar under "Index")
2. Click **"Add/test sitemap"**
3. In the text box, paste: `https://uqconsulting.org/sitemap.xml`
4. Click **"Submit"**
5. Within seconds, you'll see the submission status

**What Google will do:**
- Crawl all 22 URLs in your sitemap
- Index pages with higher priority first (home, index, knowledge-hub, tools, blogs)
- Detect new blog articles automatically (when you add them)

### 3. Watch the Indexing Happen (Real-time)

- **Coverage report** (Sitemaps tab) will show:
  - ✅ "Indexed" (the goal)
  - ⚠️ "Crawled but not indexed" (usually OK — Google will re-index later)
  - ❌ "Excluded" (check why — usually no issue for SEO content)

---

## Ongoing Monitoring (Weekly)

### Traffic & Keywords (GSC Performance Tab)

1. Go to **Performance** (left sidebar)
2. View:
   - **Total clicks** — organic visits to your site
   - **Total impressions** — how many times your site appeared in search results
   - **Avg. click-through rate (CTR)** — % of people who clicked vs. just saw you
   - **Avg. position** — where your pages rank for their keywords

**Pro tip:** Add **filters** by:
- **Query** (target terms like "IFRS vs US GAAP", "audit interview prep")
- **Page** (track which content gets the most organic love)

### Check for Indexing Issues

1. Go to **Coverage** (left sidebar)
2. Look for ❌ red flags — usually these are auto-resolved, but if something's excluded:
   - Click the issue → it shows which pages
   - Common reasons: page too new (wait 7 days), noindex tag (we don't have any), redirect issues (we don't have any)

### Mobile Usability & Core Web Vitals

1. Go to **Core Web Vitals** (left sidebar under "Experience")
2. Check all three metrics for mobile:
   - ✅ **LCP (Largest Contentful Paint)** — how fast your page loads (should be < 2.5s)
   - ✅ **CLS (Cumulative Layout Shift)** — does the page layout shift around while loading? (should be < 0.1)
   - ✅ **INP (Interaction to Next Paint)** — responsiveness to clicks (should be < 200ms)

If red flags appear:
- Click the issue → see which pages are slow
- Check locally via [PageSpeed Insights](https://pagespeed.web.dev/) (paste your URL)
- Common fixes: image optimization, lazy loading, CSS minification (Vercel does this for you)

---

## Phase 2 Target Keywords (Track These)

Track organic rankings for these terms — use GSC **Performance** tab:

| Keyword | Target Rank | Current (check now) | Tracking Priority |
|---------|-------------|-------------------|------------------|
| IFRS vs US GAAP | Top 10 | — | 🔴 HIGH |
| IFRS 16 lease accounting | Top 20 | — | 🟡 MEDIUM |
| Revenue recognition | Top 20 | — | 🟡 MEDIUM |
| Audit interview prep | Top 10 | — | 🔴 HIGH |
| Accounting CV tips | Top 20 | — | 🟡 MEDIUM |
| Interview technical questions | Top 20 | — | 🟡 MEDIUM |

**What to do with this data:**
- If a page ranks #50+ but you think it should rank #10, that's a link-building or content-depth signal
- If a page ranks #3 but gets 0 clicks, the title/description in search results might be weak
- If a page has high impressions but low CTR, test new titles/descriptions (GSC lets you suggest changes)

---

## Common GSC Questions

**Q: How long until pages are indexed?**  
A: Usually 1-7 days. High-authority sites get faster. Your sitemap + internal links speed this up.

**Q: What if a page shows "Crawled but not indexed"?**  
A: Usually OK. Google crawled it but decided it's not unique/useful enough yet. Add more depth, internal links, or a fresher publish date and Google will re-index.

**Q: Can I speed up indexing?**  
A: Yes — use the **URL Inspection tool** (top of GSC) to manually request indexing of key pages. Google will re-crawl within hours.

**Q: What's the difference between domain vs. URL prefix?**  
A: Domain (domain.com) requires DNS verification but covers all subdomains (blog.domain.com, api.domain.com). URL prefix (https://domain.com) is just that URL. You picked the right one.

---

## Next Steps

1. ✅ **This week:** Submit sitemap, verify indexing in the Coverage report
2. ✅ **Next week:** Check **Performance** — do you have organic clicks yet?
3. ✅ **Month 2-3:** Track keyword rankings — update the table above with real data
4. ✅ **Month 3+:** If a page isn't ranking, consider internal linking or link-building (Phase 4)

---

**File Last Updated:** 2026-07-04
