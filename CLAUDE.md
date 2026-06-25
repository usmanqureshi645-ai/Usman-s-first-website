# Project: Usman's Personal Website

A single-page personal/professional site for Usman (ACCA, ACA — Big 4 audit & advisory) with several AI-powered interactive tools built on top of a static HTML/CSS/JS frontend and Vercel serverless functions.

## Stack
- Frontend: single `index.html` (mirrored to `Latest Business card.html` — keep both in sync on every change)
- Backend: `/api/*.js` serverless functions on Vercel, calling the Anthropic API (model `claude-sonnet-4-6`)
- Hosting: Vercel, auto-deploys on push to `main` on GitHub (`usmanqureshi645-ai/Usman-s-first-website`)
- Email: Resend API (`/api/send-summary.js`, `/api/feedback.js`)
- Env vars (Vercel): `ANTHROPIC_API_KEY`, `RESEND_API_KEY`

## Conventions
- Always copy `index.html` → `Latest Business card.html` before committing — they must stay identical.
- Don't scrape or reproduce third-party copyrighted content (e.g. Big 4 "at a glance" guides) — build original equivalents instead.
- Job Search tool deliberately does NOT scrape LinkedIn/Indeed or auto-submit applications (ToS risk) — only quick-search links + AI CV tailoring.
- New interactive AI tools follow the existing pattern: a `mr-chat`-style UI in `index.html` + a matching `/api/<name>.js` serverless function with its own system prompt.
- Voice features use the shared `VoiceEngine` (browser TTS) — no paid voice API is wired in yet.

## Workflow expectations
- After any code change: verify in the local preview, then `git add -A && git commit && git push` — Vercel deploys automatically, no manual deploy step needed.
- A daily/3-hourly scheduled background task audits the live site for bugs (see `.claude/scheduled-tasks/site-health-monitor/`). Small, unambiguous fixes can be applied directly; anything structurally significant should be raised with Usman first.
