# Project: Usman's Personal Website

A single-page personal/professional site for Usman (ACCA, ACA — Big 4 audit & advisory) with several AI-powered interactive tools built on top of a static HTML/CSS/JS frontend and Vercel serverless functions.

## Stack
- Frontend: single `index.html` (mirrored to `Latest Business card.html` — **always copy before committing**, they must stay byte-identical)
- Backend: `/api/*.js` serverless functions on Vercel, calling the Anthropic API (model `claude-sonnet-4-6`)
- Hosting: Vercel project `usman-s-first-website`, auto-deploys on push to `main` on GitHub (`usmanqureshi645-ai/Usman-s-first-website`)
- Email: Resend API
- Persistence: Upstash Redis (REST API) — used only for the feedback log so far
- Owner's contact email: `usmanqureshi645@gmail.com` (used as the destination for signup/feedback notification emails)

## Env vars (set in Vercel, production)
- `ANTHROPIC_API_KEY` — powers every `/api/*.js` AI endpoint
- `RESEND_API_KEY` — outbound email (signup welcome, feedback log, meeting/interview summaries)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — feedback persistence (`/api/feedback-list.js` reuses the token itself as a simple shared-secret query param for read access)

## API endpoints (all in `/api/`)
- `meeting.js` — Meeting Room panel chat. Personas selectable by the user (Sarah Chen/audit, David Whitfield/IFRS-FRS, Amara Singh/tax, Marcus Lee/forensic, Elena Rossi/ESG, James Carter/legal, Priya Nair/technical accounting). Greets → asks name → interactive discussion with cross-references, risk/mitigation exchanges, clarifying questions, redirects if off-track.
- `gaap.js` — GAAP Compare research bot, jurisdiction-aware (US/UK/Ireland/Luxembourg/Australia).
- `quiz.js` — Knowledge Test interview coach. Onboarding flow: greet as a friend → ask role/JD → ask experience → mention CV tool exists separately → mention email feedback → then ask questions. Tone must always stay kind/encouraging, never harsh.
- `tailor.js` — CV/cover-letter tailoring (preserves original structure/format).
- `cv-review.js` — brutally honest ATS/recruiter review (the "skeptical recruiter" prompt) — deliberately the opposite tone to quiz.js.
- `ask.js` — general-purpose "AskAI"/"[Name]'sGPT" assistant, not finance-specific.
- `send-summary.js` — emails a Meeting Room discussion summary (used by the "End meeting & email me a summary" button).
- `qz-summary.js` — emails a kind, specific, never-harsh interview-prep feedback report (Knowledge Test's "End session" button).
- `feedback.js` — technical-agent assessment of submitted feedback (valid/not), persists every submission to Upstash Redis (`feedback_log` list, capped at 500) and emails a log entry to the owner regardless of validity.
- `feedback-list.js` — GET endpoint to list stored feedback (`?key=<UPSTASH_REDIS_REST_TOKEN>&limit=N`).
- `signup.js` — sends a welcome email + lead notification on site signup.

## Scheduled background agents (run independently of any chat session)
- `site-health-monitor` (every 3h) — checks the live site/APIs, can fix small unambiguous bugs directly and commit/push; asks first for anything structural or risky. Reads this CLAUDE.md at the start of each run.
- `market-news-updater` (every 3h) — uses WebSearch to refresh `data/market-news.json` (Industry News section of Hot Market Topics) with real current IFRS/FRC/audit news.

## Page structure (top to bottom)
Hero → USP tools showcase → **Meeting Room → Knowledge Test → Job Search → GAAP Compare → Hot Market Topics** (the 5 interactive AI tools, intentionally placed right after the hero) → Trust → Services → About → Sectors → Standards → Skills → Client Experience → Publications → Trainings → Contact → Footer.

## Floating widgets (bottom-right, stacked)
Audio toggle (ambient music), Welcome/Site Guide bot, Feedback widget, Sign-up widget, AskAI/personal GPT. All five are mutually exclusive — opening any one closes the others via `window.closeOtherWidgets()` (also cancels any in-progress TTS).

## Known constraints / conventions
- Don't scrape or reproduce third-party copyrighted content (e.g. Big 4 "at a glance" guides) — build original equivalents instead (e.g. the hand-built IFRS flowchart diagrams).
- Job Search tool deliberately does NOT scrape LinkedIn/Indeed or auto-submit applications (ToS risk) — only quick-search links + AI CV tailoring/upload.
- New interactive AI tools follow the existing pattern: a `mr-chat`-style UI in `index.html` + a matching `/api/<name>.js` serverless function with its own system prompt.
- Voice features use the shared `VoiceEngine` (browser TTS, male/female selectable) — no paid voice API wired in yet; would need ElevenLabs if the user ever wants real human-cloned voices (they have recordings ready if so).
- Background music is a shuffled playlist of 3 real royalty-free piano/flute/ambient tracks in `/audio/`, fixed-position office-scene SVG background behind all content (cursor parallax).
- The "visits/signups" counters on the hero are illustrative (day-seeded random, signups always < visits) — not real analytics. Signing up does bump the displayed count for that session.
- `git add -A` will break on the `Previous feedbacks/` folder (long `.eml` filenames exceed Windows path limits) — it's gitignored; leave it that way.
- Vercel functions are stateless — no real filesystem persistence. Use Upstash Redis (already wired) or email for anything that needs to persist.

## Workflow expectations
- After any code change: verify in the local preview (`.claude/launch.json` static server proxies `/api/*` to the live Vercel deployment), then `cp index.html "Latest Business card.html" && git add -A && git commit && git push` — Vercel deploys automatically.
- After deploying, verify live endpoints with `curl` against `https://usman-s-first-website.vercel.app` rather than assuming success.
