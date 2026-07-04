# ENHANCED MASTER PROMPT – LINKEDIN ADVERTISEMENT 60-SECOND VIDEO
## (UPDATED WITH FULL FEATURE SET & USPs)

---

## FOUNDATIONAL BRIEF

You are an award-winning Creative Director, Hollywood commercial producer, UI motion designer, cinematographer, copywriter, storyboard artist, marketing strategist, and AI prompt engineer.

Your task is to produce a complete production package for a premium 60-second LinkedIn advertisement for **Usman's Professional Website** — a sophisticated AI-powered platform built for audit, accounting, and finance professionals.

**Aesthetic target:** Apple product launch × Stripe commercial × Linear.app × Notion. Premium, elegant, minimal, luxurious. **NOT** a Canva slideshow. Every frame should feel like a £50,000+ corporate brand film.

---

## ABOUT THE BUSINESS & UNIQUE SELLING PROPOSITIONS (USPs)

### Core Positioning
A **unified, AI-powered professional destination** for finance professionals — combining traditional consulting expertise (Audit, IFRS, FRS 102, Technical Accounting) with modern AI tools that save time and unlock insights.

### The 7 Interactive AI Tools (THE HERO FEATURES)

**1. Meeting Room** — Premium AI Panel Discussion
- User selects from 7 specialist personas (Audit, IFRS-FRS, Tax, Forensic, ESG, Legal, Technical Accounting) — each with distinct visual avatar (real professional headshots), accent, tone, perspective.
- Conversational, turn-based discussion format. AI panels ask clarifying questions, share cross-references, highlight risks/mitigations, redirect if off-track.
- **Unique:** Users can invite real colleagues into live 2-person sessions (experimental feature).
- Conversations auto-save to workspace for logged-in users; can be emailed as summaries with reply-to-continue via email.
- **Emotional hook:** "Talk to 7 expert specialists at once, anytime."

**2. Interview Preparation** (formerly Knowledge Test)
- AI coach greets user as a friend, asks about their role/job description, experience level, then delivers **job-specific, company-aware interview questions**.
- Explains the rationale for each question. References real Meeting Room personas for credibility.
- Kind, encouraging tone (never harsh). Feedback is specific and actionable.
- Auto-saved to workspace; summary emailed with structured feedback.
- **Emotional hook:** "Interview coaching tailored to YOUR role, not generic templates."

**3. Rate Your Resume** (Job Hub section)
- Two-mode AI CV scoring: **ATS/Recruiter perspective** (brutally honest skeptical review) + tailoring tools.
- Users upload or paste CV; AI extracts strengths, flags gaps, suggests restructures for ATS optimization.
- Integrated cover-letter & CV tailoring (preserves original format/structure).
- **Emotional hook:** "See your CV through a recruiter's eyes. No sugar-coating."

**4. GAAP Compare** — Jurisdiction-Aware Research Bot
- Instant comparisons of accounting standards: **US GAAP ↔ IFRS ↔ UK FRS ↔ Ireland FRS ↔ Luxembourg GAAP ↔ Australia IFRS**.
- Users paste disclosures or scenarios; AI cross-references real standard excerpts, highlights key differences, explains practical impact.
- Save to workspace; use in future consultations.
- **Emotional hook:** "One question. Seven jurisdictions. Instant clarity."

**5. Financial Statement Review** — AI Auditor with Word Document Comments
- Upload financial statements (.pdf, .docx, .txt); select reporting framework (FRS 101/102/Full IFRS/US GAAP/AICPA).
- AI panel reviews for compliance discrepancies, cross-reference mismatches, wording/spelling issues.
- **Unique:** Discrepancies are injected as **native Microsoft Word comments** (real OOXML, authored "Usman Qureshi") directly into the original document — or a freshly built .docx if PDF/text uploaded.
- Broader risks go in email body. Document emailed automatically (logged-in users also save to workspace).
- **Emotional hook:** "Professional audit-quality review + annotated documents. Automated."

**6. Hot Market Topics** — AI-Powered Industry News Feed
- Real-time IFRS/FRC/audit/finance news curated by AI. Headlines, summaries, impact analysis.
- Always current (auto-refreshed by background agents every 3 hours).
- **Emotional hook:** "Stay ahead. Real news, not noise."

**7. AskAI / Personal GPT** — General-Purpose Finance Assistant
- Open-ended Q&A: accounting questions, career advice, technical guidance, anything finance/career related.
- Same calming, professional tone as Meeting Room.
- **Emotional hook:** "Your AI consultant, 24/7."

### Integrated Workspace & Account Features (THE MULTIPLIER)

**Accounts (Free signup, no credit card)**
- Real email+password accounts (zero external auth dependencies — hand-rolled, secure).
- Optional signup. **All AI tools work fully anonymously** — accounts just add persistence & continuity.
- Soft-gated: users try tools first, signup nudge appears after they generate results (never a hard paywall).

**Workspace (Dashboard for Logged-In Users)**
- **Consultation History:** Auto-saved Meeting Room discussions, Interview Prep sessions, Financial Statement Reviews. Manually saved GAAP Compare sessions, CV tailoring projects.
- **Resume Conversations:** Click "Continue this conversation" to reload any past session (state persists via Redis, 30-day TTL for anonymous sessions, permanent for accounts).
- **Personalized Job Search Tab:** Paste CV + select location/country/experience-level filters. AI extracts likely role titles, suggests fit, generates pre-filled LinkedIn/Indeed/TotalJobs/eFinancialCareers search links (no scraping, ToS-safe).

**Email Reply-to-Continue**
- Meeting Room & Interview Prep summaries are emailed. Users can **reply to the email to continue the conversation** — their reply auto-routes back to the AI panel, gets processed, AI replies to their email, conversation persists.
- **Emotional hook:** "Pick up where you left off. From your inbox."

---

## TECHNICAL ARCHITECTURE (Behind-the-Scenes Credibility)

The website is:
- **Frontend:** Single responsive HTML/CSS/JS (no bloat, no framework overhead).
- **Backend:** Anthropic Claude API (`claude-sonnet-4-6`) powering every AI tool. Vercel serverless functions. Upstash Redis for conversation persistence.
- **Email:** Resend API + custom domain (`uqconsulting.org`).
- **Real-time (experimental):** 2-person Meeting Room sessions via polling.

**Why this matters in the ad:** It's not a chatbot vendor using ChatGPT API with a white-label interface. This is **bespoke AI built by a professional who understands finance**, deployed on enterprise infrastructure. Credibility signal.

---

## REVISED STORYLINE (Problem → Solution → Features → Outcome)

### Act 1: The Problem (0–12 seconds)
**Visual:** Overwhelmed finance professional. Emails. Tabs. Documents. Spreadsheets. Compliance checklists. Job interviews looming. Mentoring someone. Missing industry news.

**Voiceover:** *"Audit professionals face a hundred decisions every day. Jurisdictional differences. Interview prep. Regulatory updates. Career moves. Too many tabs. Too many resources. Nowhere to consolidate it all."*

**Emotional objective:** Recognition. "That's me."

---

### Act 2: Introducing the Platform (12–20 seconds)
**Visual:** Smooth transition to laptop. Website loads. Logo. Clean, minimal interface. Light grey + navy + soft cyan.

**Voiceover:** *"What if everything lived in one place? One platform, built specifically for finance professionals."*

**On-screen text:** (Fade in, minimal)
"One Platform. Built For You."

**Emotional objective:** Relief. Possibility.

---

### Act 3: Feature Showcase (20–48 seconds)
**Each feature gets 3–4 seconds. Show the UI animating naturally (not jumping). Let the voiceover guide, not the text.**

#### Scene A: Meeting Room (4 sec, 20–24)
**Visual:** Laptop screen. User clicks "Meeting Room." Personas fade in — 7 professional avatars in a circle. Sarah (Audit), David (IFRS-FRS), Amelia (Tax), Marcus (Forensic), Elena (ESG), James (Legal), Charlotte (Technical Accounting). Real professional headshots. Clean, minimal.

**Voiceover:** *"Sit across the table from seven specialist advisors. Audit. IFRS. Tax. Forensic. ESG. Legal. Technical Accounting."*

**Animation:** Each avatar subtly glows as mentioned. Chat bubbles emerge showing replies.

**On-screen text:** "7 Expert Specialists"

---

#### Scene B: Interview Preparation (3 sec, 24–27)
**Visual:** Mobile phone or tablet. Interview Prep interface loads. Friendly greeting. Job-specific questions appear. Persona image shows (e.g., David). Follow-up question. Kind, conversational tone.

**Voiceover:** *"Role-specific interview prep. Not generic. Tailored to your job, your background."*

**Animation:** Text fades in, question cards appear with subtle depth.

**On-screen text:** "Interview Coaching That's Personal"

---

#### Scene C: Rate Your Resume (3 sec, 27–30)
**Visual:** CV upload widget. File selected. AI analysis loads (progress bar subtle). Results panel expands. Strengths highlighted. ATS gaps flagged. Suggestion cards.

**Voiceover:** *"See your resume through a recruiter's honest eyes. No sugar-coating."*

**Animation:** Document scans/analyzes. Cards slide in. Numbers animate.

**On-screen text:** "Recruiter's Honest Review"

---

#### Scene D: GAAP Compare (3 sec, 30–33)
**Visual:** Dropdown showing 7 jurisdictions (US GAAP, IFRS, UK FRS, Ireland FRS, Luxembourg, Australia). User types a question about a disclosure. Results table appears showing side-by-side comparison. Differences highlighted.

**Voiceover:** *"Compare accounting standards across seven jurisdictions instantly. No guessing."*

**Animation:** Dropdown opens smoothly. Text-to-results transition. Table rows highlight.

**On-screen text:** "7 Standards. One Answer."

---

#### Scene E: Financial Statement Review (3 sec, 33–36)
**Visual:** Document upload (.docx icon visible). Framework selector (FRS 101/102/IFRS/US GAAP). File processing. Word document appears with embedded comments (red comment bubbles, "Usman Qureshi" author). Comments expand showing full feedback.

**Voiceover:** *"Professional audit-quality review with annotated Word documents, sent straight to you."*

**Animation:** Comments bubble in. Document preview. Email icon appears (delivery confirmation).

**On-screen text:** "Annotated Reviews. Automated."

---

#### Scene F: Workspace & Continuation (3 sec, 36–39)
**Visual:** Dashboard. Consultation history list. Cards showing "Meeting Room: IFRS Ruling, Dec 5", "Interview Prep: Senior Accountant, Dec 3", etc. Click "Continue" on one. Chat reloads with past context visible. User types a follow-up.

**Voiceover:** *"Save every conversation. Resume anytime. Your workspace, your history."*

**Animation:** Cards scroll smoothly. Click triggers page transition. Chat history fades in.

**On-screen text:** "Your Consultation History"

---

#### Scene G: Email Reply-to-Continue (2 sec, 39–41)
**Visual:** Email inbox. Summary email from Meeting Room. User clicks "Reply." Types follow-up. Sends. Notification shows "AI Response Sent to Your Inbox."

**Voiceover:** *"Reply to your email to continue. Stay in your inbox."*

**Animation:** Email opens. Reply composes. Send animation.

**On-screen text:** "Continue From Your Email"

---

#### Scene H: Hot Market Topics (2 sec, 41–43)
**Visual:** News feed. Headlines refresh. IFRS update. FRC guidance. Audit news. Each card shows headline + brief summary + date.

**Voiceover:** *"Industry news, curated and current. Always relevant."*

**Animation:** Cards fade in staggered. Auto-refresh indicator.

**On-screen text:** "Real-Time Industry Insights"

---

#### Scene I: AskAI (2 sec, 43–45)
**Visual:** Chat interface. User types open question: "What's the best way to explain accruals to a board?" AI reply appears. Calm, professional tone. Follow-up question available.

**Voiceover:** *"Your AI consultant, available 24/7."*

**Animation:** Text types naturally. Cursor moves. Reply streams in.

**On-screen text:** "Your Personal AI Advisor"

---

#### Scene J: Accessibility (2 sec, 45–47)
**Visual:** Split screen: left shows anonymous user (no signup required, all tools accessible). Right shows logged-in user (workspace visible, history saving). Smooth cross-fade between the two.

**Voiceover:** *"Try everything free, anonymously. Sign up to save your work."*

**Animation:** Screen splits. Login state toggle with smooth transition.

**On-screen text:** "Free. Anonymous. Your Choice."

---

### Act 4: Closing (47–60 seconds)

#### Scene K: The Vision (5 sec, 47–52)
**Visual:** Wide shot of laptop, tablet, phone — all showing the website (different sections, all animated, all alive). Website scrolls smoothly across screens. Parallax effects. Soft light. Office environment (desk, coffee, professional but comfortable).

**Voiceover:** *"One platform. One login. Everything a finance professional needs to make better decisions, faster. No switching between tabs. No hunting for answers. No missed updates."*

**On-screen text:** (Fade in, centered, large, elegant)
"One Platform. Built For Finance Professionals. Built For Your Next Step."

**Animation:** Smooth scroll. Hover states animate. Buttons glow subtly. Natural, organic feel.

**Emotional objective:** Confidence. "I can do this better."

---

#### Scene L: The CTA (3 sec, 52–55)
**Visual:** Website URL appears centered. `usman-s-first-website.vercel.app` (or branded domain if you have one). Logo below. Clean, premium.

**Voiceover:** *"Start for free today."*

**On-screen text:** 
"Visit the platform"
"Follow for more insights"

**Animation:** URL and logo appear with elegant fade + subtle scale.

**Emotional objective:** Action-ready. Urgency (calm, not pushy).

---

#### Scene M: Fade-Out Logo (2 sec, 55–60)
**Visual:** Logo holds center. Soft fade. Light grey background. Final frame holds for 1 sec.

**Voiceover:** (Soft, confident close)
*"Let's build your best next move."*

**On-screen text:** (Optional, centered below logo)
"Usman's Professional Platform"

**Emotional objective:** Trust. Professional. Ready.

---

## TARGET AUDIENCE (REFINED)

### Primary
- Audit managers & senior auditors (Big 4 / mid-tier firms)
- FRS/IFRS compliance professionals
- Finance controllers & finance directors
- Audit committee advisors
- Technical accountants
- Internal audit leaders

### Secondary
- ACCA/ICAEW students (career prep, interview training)
- Finance graduates (CV optimization, interview coaching)
- Career changers entering audit/accounting
- Recruiters in finance/audit (CV scoring credibility)
- Small firms needing ad-hoc specialist expertise (Meeting Room, GAAP Compare)
- Corporate training teams (Professional Courses angle)

**What they should feel:**
"This person gets my world. This is built FOR me, not sold AT me. This saves time. This is credible."

---

## COLOR PALETTE (CONFIRM / REFINE)

**Primary**
- Deep Navy Blue (`#0D1F3C` or `#001433`)
- Royal Blue (`#1E40AF`)
- Pure White (`#FFFFFF`)
- Very Light Grey (`#F8F9FA` or `#F3F4F6`)

**Accent**
- Soft Cyan / Glacial Blue (`#06B6D4` or `#0891B2`)
- Subtle Gold (`#D4AF37` or muted, not shiny)

**Effects**
- Glassmorphism (semi-transparent panels with backdrop blur)
- Subtle gradients (navy → royal blue, not vibrant)
- Premium shadows (soft, directional, 2-3 layer depth)
- Very light vignette (edges darken slightly)

---

## TYPOGRAPHY

- **Headline:** Bold, sans-serif, large (48–72px in ad). Minimal words (max 6 on screen at once).
- **Body/Voiceover text:** Clean, professional, 16–24px. High contrast for readability.
- **Font family:** Inter, Söhne, Montserrat, or similar modern sans-serif. NO serif. NO script.

---

## VOICEOVER STYLE & SCRIPT

**Voice talent:**
- Male or female, doesn't matter — but tone is **non-negotiable**: calm, confident, authoritative, professional.
- Imagine a Deloitte partner or KPMG technical director speaking at a conference. Measured. Knowledgeable. No hype.

**Delivery:**
- No shouting. No fast talking. No sales-y cadence.
- Slow, deliberate pacing. Pauses for impact.
- Authentic warmth (not cold, but not chummy either).

**Script** (already provided in storyline above — delivers all features without dumping).

---

## MUSIC & SOUND DESIGN

**Music:**
- Modern, cinematic, inspirational corporate soundtrack.
- Ambient, orchestral, or minimalist electronic (NOT EDM, NOT loud beats, NOT dramatic stabs).
- Suggest: Epidemic Sound, Artlist, or hire a composer.
- Build subtly from opening to closing (emotional arc).
- No lyrics.

**SFX (Sound Effects):**
- Soft button clicks (subtle, not mechanical).
- Gentle notifications (bells, chimes, subtle pings).
- Page transitions (minimal whooshes, NOT cartoony).
- Typing sounds (optional, very subtle).
- Email send (soft confirmation tone).
- NO cheesy "ding" sounds. NO overuse of SFX.

**Voiceover:**
- Professional voice actors (Fiverr top-rated, or hire local). Test multiple takes. Use the calmest, most authoritative one.

---

## CINEMATOGRAPHY & VISUAL STYLE

### Camera Movements
- Slow push-ins on UI elements (gentle, intentional).
- Parallax scrolling (foreground/background depth).
- Macro shots on details (buttons, avatars, text highlights).
- Ultra-smooth tracking shots (no jerky pans).
- Rack focus (blur to sharp, emphasizing UI hierarchy).
- Floating UI (subtle 3D depth, not spinning).
- Depth of field (bokeh in background, sharp foreground UI).

### Lighting
- Golden hour / office ambient (warm, professional).
- Natural lens flares (minimal, premium feel).
- Soft bokeh (not harsh).
- Directional shadows (indicates light source).
- NO flat, harsh lighting.
- NO neon glows.

### Never Use
- Cheap stock footage.
- People pointing at camera.
- Handshakes or people shaking hands.
- Overacting.
- Cartoon graphics or flying icons.
- Clip-art style visuals.
- Cheesy transitions (zoom-in noise, spin, flip).

### Website Animation Notes
- Animate as if the website is ALIVE, not a static screenshot.
- Smooth scrolling (not instant jumps).
- Hover states (buttons glow, cards expand subtly).
- Mouse cursor visible (shows interactivity).
- Cards expanding on focus.
- Buttons with subtle glow or underline animation.
- Text fading in/out (not appearing instantly).
- Charts animating (bars grow, numbers count up).
- Page transitions (fade, slide, not cut).
- Glass reflections on panels.
- **Principle:** Every frame should feel like a product in motion, not a catalog of screenshots.

---

## STORYBOARD SCENES (COMPLETE BREAKDOWN)

| Scene # | Duration | Title | Purpose | Visual | Camera | Animation | Transition | Voiceover | Text | SFX | Emotional Tone |
|---------|----------|-------|---------|--------|--------|-----------|-----------|-----------|------|-----|----------------|
| 1 | 4 sec | Problem Setup | Establish pain point | Overwhelmed professional, multiple apps, clutter | Wide to close-up on stress | Screen flicker, rapid edits | Hard cut | "Audit professionals face a hundred decisions..." | None (shows clips of problem) | Subtle tension SFX | Recognition, tension |
| 2 | 3 sec | Transition | Bridge to solution | Laptop opening, website URL loading | Slow push-in on screen | Smooth fade-in | Fade | (Voiceover continues) | Fade in website URL | Soft chime | Hope, calm |
| 3 | 4 sec | Meeting Room Intro | Hero feature — specialists | 7 avatars appear in circle, real headshots, minimal UI | Slow zoom centered on avatars | Avatars glow as mentioned | None (continuous) | "Sit across the table from seven specialist advisors..." | "7 Expert Specialists" | Soft arrival tones | Authority, trust |
| 4 | 3 sec | Interview Prep | Role-specific coaching | Mobile phone, Prep UI, question card, avatar | Pull back from phone | Cards slide in, text appears | Fade to next | "Role-specific interview prep..." | "Interview Coaching That's Personal" | Subtle notification | Personalization, warmth |
| 5 | 3 sec | CV Scoring | Honest feedback | CV upload, analysis, results, highlights | Slight zoom on results panel | Progress bar animates, results fade in | Fade | "See your resume through a recruiter's honest eyes..." | "Recruiter's Honest Review" | Soft success chime | Clarity, relief |
| 6 | 3 sec | GAAP Compare | Standard research | Dropdown menu, jurisdiction selector, comparison table | Pull back to show full UI | Dropdown opens smooth, table highlights | Fade | "Compare accounting standards across seven jurisdictions..." | "7 Standards. One Answer." | Subtle UI clicks | Confidence, clarity |
| 7 | 3 sec | Financial Statement Review | Document annotation | .docx upload, framework select, Word comments visible, email icon | Slow push-in on comment bubbles | Document loads, comments bubble in, email sends | Fade | "Professional audit-quality review with annotated Word documents..." | "Annotated Reviews. Automated." | Soft success, notification | Expertise, efficiency |
| 8 | 3 sec | Workspace Dashboard | Saved history | Dashboard view, consultation cards, "Continue" button, click action | Camera pulls back to show full dashboard | Cards scroll, click triggers reload animation | Fade | "Save every conversation. Resume anytime..." | "Your Consultation History" | Subtle UI transitions | Control, continuity |
| 9 | 2 sec | Email Reply-to-Continue | Asynchronous continuation | Email inbox, summary email, reply compose, send | Close-up on email, then pull back | Reply composes, animates send | Fade | "Reply to your email to continue. Stay in your inbox." | "Continue From Your Email" | Send whoosh, notification | Convenience, connection |
| 10 | 2 sec | Hot Market Topics | News feed | News cards appearing, headlines refreshing, dates visible | Wide shot of feed | Cards fade in staggered, auto-refresh indicator | Fade | "Industry news, curated and current. Always relevant." | "Real-Time Industry Insights" | Subtle refresh SFX | Relevance, awareness |
| 11 | 2 sec | AskAI | Open-ended assistant | Chat interface, user question, AI reply streaming, calm tone | Slow zoom on chat | Text types naturally, reply streams in | Fade | "Your AI consultant, available 24/7." | "Your Personal AI Advisor" | Typing sounds (subtle), ping | Availability, support |
| 12 | 2 sec | Free & Anonymous | Accessibility message | Split screen: anonymous user (no signup) vs. logged-in (workspace visible) | Split-screen composition | Smooth cross-fade between modes | Fade | "Try everything free, anonymously. Sign up to save your work." | "Free. Anonymous. Your Choice." | Subtle toggle sound | Inclusivity, freedom |
| 13 | 5 sec | Vision & Multi-Device | The complete platform | Laptop, tablet, phone all showing website sections, scrolling smoothly, parallax, office environment | Wide establishing shot, then push-in on screens | Smooth scroll across devices, parallax effects, hover states | Continuous scroll | "One platform. One login. Everything a finance professional needs..." | "One Platform. Built For Finance Professionals. Built For Your Next Step." | Ambient background music | Completeness, confidence |
| 14 | 3 sec | CTA | Call-to-action | Website URL centered, logo below, clean presentation | Static, centered composition | URL and logo appear with fade + subtle scale | Fade | "Start for free today." | Website URL "Visit the platform" + "Follow for more insights" | Soft arrival tone | Action-ready, urgency |
| 15 | 2 sec | Fade-Out Logo | Closing frame | Logo centered, soft fade to light grey | Centered, static | Fade out, hold for 1 sec | Fade to grey | "Let's build your best next move." | (Optional) "Usman's Professional Platform" | Ambient music soft fade | Trust, professionalism |

---

## MOTION GRAPHICS & ANIMATION NOTES

### Principles
- **Subtlety over flashiness.** No spinning logos. No flying text. No 3D flips.
- **Purposeful movement.** Every animation answers: "Why is this moving?"
- **Easing:** Smooth cubic-bezier (ease-in-out). NOT linear. NOT bounce.
- **Depth:** Layering (background, mid, foreground) creates sense of 3D without overdoing it.
- **Timing:** Most animations 300–600ms. Entrance 400ms, exit 300ms.

### Specific Animation Examples
1. **Avatar circle (Meeting Room):** Each avatar fades in at 100ms intervals as their specialty is mentioned. Subtle glow or border highlight as active speaker.
2. **GAAP dropdown:** Smooth ease-out expansion. Rows highlight in soft cyan as they appear.
3. **Word comments:** Comments bubble in from left with stagger (100ms apart). Text inside fades in after bubble appears.
4. **Dashboard cards:** Scroll smoothly (not snap). Hover state: subtle scale (102%) + shadow increase. Click: fade out to new page.
5. **Email animation:** Compose box grows from reply button. Send button animates to "sending..." then completion checkmark appears.
6. **News feed:** Cards fade in staggered (150ms apart). Auto-refresh icon rotates 360° slowly every 3 seconds (even in static storyboard, note this for video).
7. **Chart animations:** Bars grow from bottom (300ms). Numbers count up (500ms). Subtle delay between each bar (50ms).
8. **Parallax on multi-device view:** Foreground device moves slower than background, creating depth. Phone slightly overlaps tablet, tablet overlaps laptop — all moving together smoothly.

---

## COLOR GRADING & POST-PRODUCTION

- **Whites:** Bright, clean, not blown out.
- **Shadows:** Soft, not crushed. Maintain detail in dark areas.
- **Saturation:** Slightly desaturated overall (not vivid). Navy and cyan pop because of restraint elsewhere.
- **Contrast:** Moderate to high. Readable on mobile screens.
- **Vignette:** Very light (2–5% opacity). Draws eye to center.
- **Film emulation (optional):** Subtle grain (ISO 100–200 equivalent) for premium, cinematic feel. NO heavy grain.
- **Temperature:** Neutral to very slightly warm (not orange, not blue).

---

## ASSET CREATION INSTRUCTIONS

### B-Roll Suggestions
- **Office environment:** Desk with laptop, coffee cup, notebook, professional but comfortable. Natural light from window.
- **Hands:** Typing on keyboard, clicking mouse, swiping on tablet (diverse hands, professional setting).
- **Reactions:** Subtle nods, "aha" expressions (NOT exaggerated). Professional listening.
- **Lighting:** Golden hour or soft window light. Depth of field blurring background.

### AI Image Prompts (Midjourney / Leonardo / Flux)
1. **Hero image (professional, calm, modern workspace):**
   *"Overhead view of a minimalist desk: laptop showing clean UI, coffee cup, notepads, golden hour light, shallow depth of field, luxury magazine photoshoot style, 4K, Canon 5D Mark IV, f/1.8, professional color grading"*

2. **Avatar placeholder (if creating new specialist personas):**
   *"Professional headshot, square crop, 400x400px, real person, diverse ethnicity, warm smile, soft studio lighting, neutral background (very light grey), high-res, credible, trusted advisor, corporate portrait style"*

3. **Meeting Room visual (abstract, premium):**
   *"Seven circular nodes glowing soft cyan on deep navy background, connected by delicate lines, minimal, glassmorphism effect, soft bokeh foreground, luxury design, 3840x2160, ultra HD"*

4. **Office environment (wide, inviting):**
   *"Modern office interior, minimalist furniture, large windows, natural light, desk with laptop and dual monitors, plants, professional but warm, office design, nobody in frame, shot from 2 meters away, golden hour lighting, high contrast, 4K"*

### AI Video Prompts (Runway / Google Veo / Pika / Kling / Luma)

1. **Website scrolling (auto-animate):**
   *"Smooth vertical scroll through a professional financial services website: navy blue + white minimalist design, soft cyan accents, cards expanding as they come into view, parallax scrolling, glassmorphism panels, natural lighting, 2K, 24fps, 8 seconds duration, no text on screen except UI labels"*

2. **Avatars fading in (circle arrangement):**
   *"Seven professional headshots arranged in a circle on deep navy background, each fading in sequentially at 100ms intervals, subtle white glow around each image, soft bokeh, very minimal motion, ultra premium, 1080p, 4 seconds, no text"*

3. **Laptop waking up (screen on):**
   *"MacBook Pro opening, screen waking from dark to show clean white website homepage, subtle glow reflecting on desk, golden hour light from window, cinematic, no people, 2K, 2 seconds"*

4. **Multi-device view (all showing website):**
   *"Three devices side-by-side (16-inch MacBook Pro on left, iPad in center, iPhone on right), each displaying different sections of the same website (navy + white + cyan design), smooth parallax scroll across all three synchronized, office desk environment, warm lighting, 2K, 5 seconds"*

### Midjourney Prompts (Still Images for Reference)

1. **Professional advisory meeting (inspiration):**
   *"A boardroom with advisors, deep navy walls, modern minimalist furniture, large window, golden light, warm professional energy, no people visible, focus on space and atmosphere, luxury corporate design, hyperrealistic, 4K, Leica M, f/2.8"*

2. **Tech product aesthetic (reference):**
   *"Apple event stage, minimalist, deep blue lighting, single laptop center stage, soft shadows, premium product launch feel, no people, no clutter, 4K, cinematic lighting"*

3. **Modern dashboard interface (UI reference):**
   *"Web dashboard UI mockup: navy blue + white + soft cyan, glassmorphism panels, data visualizations (charts, tables), professional sans-serif fonts, minimal, clean, luxury software interface, Figma design, 3440x1440, high-res, no people"*

### Text-to-Video Prompts (For Editing Software Automation)

Use these with CapCut, DaVinci Resolve, Pika, or Runway's auto-edit features:

1. **Scene transition (fade + parallax):**
   *"Fade-in duration: 0.5s | Parallax effect: -5% X-axis | Background blur: 3px | Apply to: scene 3–4 transition"*

2. **Avatar appearance:**
   *"Staggered fade-in | Delay between items: 100ms | Easing: ease-out-cubic | Duration per item: 400ms | Glow effect (soft cyan): +10% brightness on appearance"*

3. **Website scroll animation:**
   *"Smooth scroll | Duration: 8 seconds | Easing: ease-in-out-cubic | Parallax depth: moderate (15%) | No audio cutting on scroll"*

---

## EXPORT SETTINGS & DELIVERY SPECS

### Final Video Format
- **Resolution:** 1080p or 4K (1920x1080 or 3840x2160).
- **Frame rate:** 24fps or 30fps (NOT 60fps; premium aesthetic prefers 24fps).
- **Codec:** H.264 (.mp4) for broad compatibility.
- **Bitrate:** 8–12 Mbps (1080p), 15–25 Mbps (4K).
- **Audio:** 48kHz, stereo, loudness normalized to -16 LUFS (YouTube/broadcast standard).

### LinkedIn Export
- **Aspect ratio:** 16:9 (full-width feed videos).
- **Duration:** 60 seconds exactly.
- **File size:** Max 5GB (LinkedIn limit), target 300–500MB for quality + speed.
- **Captions:** Optional but recommended (burned-in or .srt file). Use speaker voiceover script.
- **Logo/branding:** Final frame holds for 1 second (viewers can screenshot).

### Social Media Variants (Optional)
- **TikTok/Instagram Reels:** 9:16 vertical, 15–60 seconds, same content reframed.
- **YouTube:** 16:9, full 60 seconds with extended intro/outro.
- **Website embed:** Autoplay muted, loop, no captions required.

---

## EDITING SOFTWARE INSTRUCTIONS

### DaVinci Resolve (Professional Grade)
1. Import all video clips and music into a single Fusion/Edit timeline.
2. Color grade using LUTs (Rec. 709 for broadcast, or create custom LUT for premium look: slightly crushed blacks, lifted midtones, subtle cyan boost in shadows, navy boost in highlights).
3. Add Fusion text animations (title cards, voiceover captions if used).
4. Layer animations in Fusion (avatars, dashboard cards, charts).
5. Export using H.264 codec, 24fps, 1080p or 4K as specified.
6. Normalize audio in Fairlight tab: -16 LUFS for YouTube/broadcast standard.

### CapCut (User-Friendly Alternative)
1. Import clips, drag into timeline.
2. Apply "Fade" transitions between scenes (0.5s duration).
3. Use built-in color grading presets (search for "cinematic" or "professional") — adjust slightly toward navy + cyan tones.
4. Add text overlays from the voiceover script (font: Inter or Montserrat Bold, size 60px, center-aligned, white on transparent, 2-second duration per line).
5. Sync audio (voiceover + music) to timeline, layer music lower than voiceover.
6. Export as MP4, 1080p or 4K, 24/30fps.
7. Use "Merge" feature to add captions from audio (optional, but recommended).

### Adobe Premiere Pro (Full Suite Workflow)
1. Organize clips in Bins (Video, Music, VFX, Text Overlays).
2. Drag clips into main timeline in sequence.
3. Use "Essential Sound" panel to level voiceover (-18dB) + music (-12dB), then normalize to -16 LUFS.
4. Apply "Lumetri Color" to all clips: create custom LUT or use a preset starting point, tweak for navy/cyan aesthetic.
5. Use "Morph Cut" or "Smooth Cut" for video transitions.
6. For text animations, import from After Effects (optional) or use Premiere's built-in "Essential Graphics" panel with keyframes.
7. Export using Media Encoder: H.264, 24fps, 1080p or 4K, high bitrate (12 Mbps for 1080p, 20+ for 4K).

---

## MUSIC & SOUND RECOMMENDATIONS

### Music Suggestions (Royalty-Free Platforms)
1. **Epidemic Sound**
   - Search: "corporate cinematic ambient", "modern advisory", "professional electronic"
   - Examples: "Deep Focus", "Confidence Builder", "Advisory Board"

2. **Artlist**
   - Search: "luxe corporate", "professional ambience", "elegant modern"
   - Examples: "Trusted Voice", "Executive Suite", "Modern Confidence"

3. **AudioJungle**
   - Search: "premium corporate background", "elegant advisor theme"
   - Examples: "Corporate Confidence", "Business Elegance", "Professional Trust"

4. **Composer hire (custom)**
   - Budget: $500–2000 for a 60-second custom track.
   - Brief: "Modern, cinematic, inspirational, corporate. Minimalist orchestral or electronic. Builds subtly from opening (calm, professional) to closing (confident, resolute). No vocals, no EDM, no loud stabs. Imagine a Deloitte or McKinsey corporate video."

### SFX Library Recommendations
- **Notification/UI sounds:** Freesound.org, BBC Sound Effects Library, Zapsplat.
- **Voiceover processing:** Light compression (4:1 ratio, -3dB threshold), slight EQ boost in 2–4kHz range for clarity, light reverb (0.5s) for professionalism.

---

## FINAL CHECKLIST BEFORE DELIVERY

- [ ] **Voiceover**: Professional delivery, calm & authoritative, no sales cadence, audio normalized to -16 LUFS.
- [ ] **Visuals**: No cheap stock footage, no exaggerated hand gestures, no overacting, no clip-art icons.
- [ ] **Animation**: Smooth, purposeful, subtle, no spinning logos or flying text, glassmorphism effects present.
- [ ] **Text on screen**: Max 6 words at any moment, large, readable, elegant typography (Inter, Montserrat, or Söhne).
- [ ] **Transitions**: Fade or smooth dissolve, NOT cuts with whoosh sounds.
- [ ] **Color palette**: Navy + cyan + white throughout, subtle gradients, soft shadows, NO neon glow.
- [ ] **Music**: Cinematic, ambient, inspirational, NO EDM or loud beats, complements voiceover volume.
- [ ] **Duration**: Exactly 60 seconds.
- [ ] **Export format**: 1080p or 4K, H.264, 24fps, 500MB max file size.
- [ ] **LinkedIn compliance**: 16:9 aspect ratio, captions optional but recommended, no external links in video (CTA in comments/description instead).
- [ ] **Brand consistency**: Logo/URL visible at end, brand colors accurate, tone authentic & trustworthy.
- [ ] **Credibility signals**: Real avatars (not generic), real features (not mockups), real website (working URLs/links).

---

## OPENING MESSAGE TO THE CREATIVE TEAM

*"You are creating a 60-second premium corporate advertisement for a financial advisory platform. This is not a startup pitch video. This is not a SaaS 'clickety-click' demo. This is a brand film — imagine the opening scene of a McKinsey or Apple corporate event.*

*Every frame should scream: 'This person knows what they're doing. This is professional-grade. This is trustworthy.'*

*The platform is built by an ACCA/ACA professional with deep Big 4 audit experience. The features are real. The testimonials are implicit — the design and calm confidence do the selling.*

*Use cinematic language: slow push-ins, parallax, soft bokeh, golden light, minimal text, strategic silence. Let the voiceover be the storyteller. Let the UI animation show capability. Let the aesthetic prove credibility.*

*The finished product should be indistinguishable from a £50,000+ corporate brand commercial. That is the standard."*

---

## END OF PROMPT

**Ready to give this to your other project. It now includes:**
✅ All 7 interactive AI tools (Meeting Room, Interview Prep, CV Scoring, GAAP Compare, Financial Statement Review, Hot Market Topics, AskAI)
✅ Workspace & account features (consultation history, resume-from-email, saved conversations)
✅ Email reply-to-continue mechanic
✅ Anonymous + free access positioning
✅ Detailed storyboard (15 scenes, 60 seconds)
✅ Complete scripts, cinematography notes, animation specs
✅ Export & editing instructions for 3 professional tools
✅ Music & SFX recommendations
✅ AI image/video prompts for all major production tools (Midjourney, Runway, Pika, Luma, etc.)
✅ Premium aesthetic anchored throughout (no cheesy marketing, no cheap stock footage, no overhype)
✅ Target audience clarified (audit professionals, finance leaders, career-changers)
✅ Verification checklist before final delivery

---

**How to use:** Share this with your creative team or AI video production assistant. They should follow the storyboard scene-by-scene, use the prompts as exact reference, and deliver a final 1080p or 4K video (60s, H.264, ~500MB).

