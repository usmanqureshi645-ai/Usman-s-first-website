# Google Analytics 4 Setup & Integration

**Status:** Waiting on your GA4 Measurement ID  
**Estimated setup time:** 5 minutes (once you have the ID)  
**What it does:** Tracks user behavior, traffic sources, conversions (signups, tool usage)

---

## Do You Already Have a GA4 Property?

### Option A: You Have an Existing GA4 Account

If you already set up GA4 for uqconsulting.org:

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click your property name (left sidebar)
3. Go to **Data streams** (bottom left under "Admin")
4. Click the **Web** data stream for your domain
5. Copy the **Measurement ID** (looks like `G-XXXXXXXXXX`)
6. Send it to me → I'll add it to your site in 30 seconds

### Option B: You Don't Have GA4 Yet

**One-time setup (5 minutes):**

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in (same Google account as Gmail/GSC)
3. Click **"Create"** (top left)
4. Choose **"Web"** as your platform
5. Name: `Usman's Consulting` (or whatever)
6. Website URL: `https://uqconsulting.org`
7. Timezone: UTC (or your timezone)
8. Industry: **Accounting & Finance** or **Professional Services**
9. Click **"Create"**
10. On the next screen, click **"Install the Google tag"** → **"Web"** → choose **"Google Tag Manager"** or **"Manually install the global site tag"**
    - **I recommend:** Choose **"Manually install"** → Copy the entire code block
    - It will look like:
      ```html
      <!-- Google Analytics -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-XXXXXXXXXX');
      </script>
      ```
11. Copy the **Measurement ID** from that code (the `G-XXXXXXXXXX` part)
12. Send me the ID, and I'll add it to your site

---

## Once You Have Your Measurement ID

I will:

1. ✅ Add the GA4 tracking code to:
   - `index.html` (the main tools page)
   - `home.html` (the landing page)
   - `knowledge-hub.html` (your new content hub)
   - `workspace.html` (logged-in user area)

2. ✅ Deploy to live site (30 seconds, auto-deploys to Vercel)

3. ✅ Verify it's working by checking Google Analytics → see real-time visitors

---

## What You'll Track (Automatic)

Once GA4 is live, you'll see:

### Real-Time Dashboard (Instant)
- **Active users now** (people currently on your site)
- **Traffic source** (direct, Google search, link clicks)
- **Top pages** (which content is being viewed)

### Daily Reports (Updated overnight)
- **Users** (total visitors, new vs. returning)
- **Sessions** (how many visit sessions occurred)
- **Engagement rate** (% of visitors who did something meaningful)
- **Session duration** (how long they stayed)

### Traffic Sources
- **Organic search** (from Google) — this is your gold metric
- **Direct** (typed your URL)
- **Referral** (came from a link on another site)
- **Social** (from LinkedIn, Twitter, etc.)

### Page Performance
- **Top pages by users** (which blog articles / tools are visited most?)
- **Bounce rate** (% of people who left without doing anything)
- **Avg. session duration** (how long they stayed on each page)

### Goals & Conversions (Optional — Can Set Up Later)
- **Signups** (track form submissions)
- **Tool usage** (track when people use Meeting Room, CV Scoring, etc.)
- **Email subscriptions** (if you add a newsletter)

---

## How to Read GA4 Reports (Once It's Live)

### The Main Dashboard (What You'll See First)

1. **Top left:** Choose date range → "Last 28 days" (to track trends)
2. **Users metric:** Total number of unique visitors
3. **Sessions metric:** Number of separate visit sessions (if someone visits twice, that's 2 sessions)
4. **Engagement rate:** % who did something (clicked a link, filled a form, used a tool)
5. **Session duration:** Average time spent on your site

### Where to Find Organic Search Traffic

1. **Left sidebar** → **"Traffic acquisition"**
2. **Click the table** → filter to "Organic search"
3. You'll see:
   - How many organic visitors (from Google)
   - Which pages they landed on
   - Conversion rate (if you set up goals)

### Track Blog Article Performance

1. **Left sidebar** → **"Pages and screens"**
2. **Sort by** "Views" (most visited)
3. You'll see:
   - `/blog/ifrs-16-lease-accounting-example.html` — 42 views
   - `/blog/ifrs-vs-us-gaap-comparison.html` — 38 views
   - etc.
4. Compare this to your GSC rankings — if an article ranks #3 but has only 10 views, the title/description in search results might be weak

---

## Setting Up Conversion Tracking (Optional, Phase 2)

Once you want to track specific actions (like tool usage or signups), you can set up **Events**:

1. **Signup event** — track when someone creates an account
2. **Tool usage event** — track when someone uses Meeting Room, GAAP Compare, etc.
3. **Email signup event** — if you add a newsletter

For now, just focus on traffic & page performance. Advanced conversion tracking can wait.

---

## Common Questions

**Q: Can I see which keywords brought traffic?**  
A: Not directly in GA4 (Google keeps this private in GA4 for privacy reasons, unlike Universal Analytics). Use **Google Search Console** for keyword data. GA4 shows you what people did *after* clicking.

**Q: How soon will I see data?**  
A: GA4 starts tracking immediately after you add the code. Real-time visitors will show up within seconds. Daily reports compile overnight.

**Q: Can I see individual users?**  
A: No. GA4 respects privacy — it shows aggregated data (e.g., "42 users visited this page") but not individual user info.

**Q: Should I use Google Analytics or GSC?**  
A: Both.
- **GSC** = before click (impressions, clicks, keywords, rank)
- **GA4** = after click (user behavior, pages visited, time spent, conversions)

---

## Sending Me Your GA4 Measurement ID

Once you have it:

1. Copy the Measurement ID (e.g., `G-ABC123XYZ789`)
2. Reply with just the ID
3. I'll:
   - Add the tracking code to all 4 pages
   - Deploy to live site
   - Test that it's working
   - Confirm you can see real-time data in Analytics

---

**File Last Updated:** 2026-07-04  
**Next Step:** Set up GA4 (Option A or B above) → Send me your Measurement ID
