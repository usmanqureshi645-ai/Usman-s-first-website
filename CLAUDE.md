# Project: Usman's Personal Website & Global Directives

*(Note to Claude: By Usman's explicit directive, the old rule splitting `CLAUDE.md` and `MEMORY.md` is abolished to save tokens. THIS is the single unified startup file containing both project constraints and user workflow.)*

## 1. About Me, Workflow, & Token Efficiency
- **User:** Usman (ACCA/ACA). No jargon. Prefers maximum automation (Admin/UAC, deployments).
- **Token Efficiency (CRITICAL):** Caveman Mode (max token savings), Ponytail Mode (shorten/reuse code—this is an active directive, keep it), Headroom (context management).
- **No Story-Telling:** Document ONLY the final agreed product. Treat bugs as separate tickets; when solved, move to `Archived/Old issues` and unload immediately.
- **Backups:** Daily 4:00 AM via `Usman_Website_Claude_AutoBackup` (`AutoBackupScript.ps1`).

## 2. Environment & Infrastructure
- **Env Vars (Vercel):** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AUTH_SECRET`, `CRON_SECRET`.
- **Domain & Owner:** `uqconsulting.org` | Owner: `usmanqureshi645@gmail.com`
- **Redis Keys (Upstash):** `mrconv:<uuid>` (30-day TTL), `iplog:<ip>`, `feature_usage_log`, `signups_log`.
- **Emailing Rule:** All outbound email MUST route through `lib/email.js` `sendEmail()`. NEVER use raw fetch (breaks gauges).

## 3. Strict Code & Architecture Gotchas (Bug Prevention)
- **12-Function Limit:** Max 12 files in `/api/`. Route new actions via `account.js?action=`.
- **File Mirroring:** `index.html` MUST be byte-identical to `Latest Business card.html`. No overwriting with `home.html`.
- **Testing & Git Workflow:** `npm test` -> `meta.mirror` verifies sync -> Stage files by name (NO `git add -A`) -> commit/push -> `npm run test:live` (live smoke test).
- **Security & Auth:** Hard-gate pattern (`getUserFromRequest` 401 enforcement). SSRF guard in `lib/safeFetch.js`. 7-day cookie TTL, 5-attempt/15min lockout.
- **UI:** Floating widgets (Audio, Guide, Feedback, Signup, AskAI) are mutually exclusive (`window.closeOtherWidgets()`).
- **Word/OOXML (`docxComments.js`):** Never double `xml:space="preserve"`. Anchor comments at `<w:r>` (run), not `<w:t>` (text).
- **JS Traps:** In `cv-review.js`, `rawText` MUST NOT be named `text` (shadowing trap).
- **Logging:** `isMeaningfulSession` triggers genuine completion logging in `fsreview.js` / `send-summary.js`.
- **Voice/TTS:** Polly mappings (Salli/Kevin). 2500-char chunking limit. MUST use `\p{Extended_Pictographic}` for emoji stripping (never `\p{Emoji}`, which strips digits). Bump `CACHE_VERSION` in `lib/tts.js` on text changes.

## 4. API Map (Quick Reference)
- `meeting.js` (Panel chat), `quiz.js` (Coach), `cv-review.js` (Score/Eleanor), `fsreview.js` (Reviews), `gaap.js`, `tailor.js`, `ask.js`, `send-summary.js`, `account.js`, `feedback.js`, `inbound-email.js`. 

## 5. Active Memories Index (Load On-Demand ONLY)
*Claude: Load these via `load [[path]]` only when specifically required, then unload.*
- `memory/active/deployment_and_architecture.md`
- `memory/active/design_system.md`
- `memory/active/voice_system.md`
- `memory/active/cv_and_interview.md`
- `memory/active/meeting_room.md`
- `memory/active/accounts_and_profile.md`
- `memory/active/feedback_and_quality.md`
- `memory/active/admin_dashboard.md`
- `memory/active/fsreview.md`
- `memory/active/reference_and_scaling.md`
- `memory/active/nav_dropdowns.md`
- **SEO Folder (`memory/SEO on demand/`):** `seo_project.md`, `blog_quality_and_conventions.md`, `blog_knowledge_hub_architecture.md`, `feedback_knowledge_hub_navigation.md`, `preexisting_named_company_sections.md`
- **Security Checklists (`memory/active/`):** `SECURITY_AUDIT.md`, `SECURITY_CHECKLIST.md`
- **Archived Folder (`memory/Archived/`):** Stores completed/superseded tasks.