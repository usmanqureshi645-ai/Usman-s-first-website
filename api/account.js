// Consolidated accounts + workspace endpoint — Vercel's Hobby plan caps a deployment at
// 12 Serverless Functions, so every account/workspace action is routed through this one
// file via ?action=, instead of one file per action.
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, getUserFromRequest, normalizeEmail, verifyAdminKey, checkLoginAttempts, recordFailedLogin, clearLoginAttempts } from '../lib/auth.js';
import { saveConsultation, scheduleFollowup } from '../lib/consultations.js';
import { getProfile, saveProfile } from '../lib/profile.js';
import { sendEmail } from '../lib/email.js';
import { recordVisit, recordPresence, recordSignup, getDashboardData, getVisitorTrend30, pipe } from '../lib/metrics.js';
import { logAndCheckUsage } from '../lib/ipUsage.js';
import { buildWorkbook } from '../lib/exportData.js';
import { getUsageAggregates, getMostUsedToolToday } from '../lib/featureLog.js';
import { getAnthropicCostReport } from '../lib/anthropicCost.js';
import { getPollyCostTrend } from '../lib/pollyCost.js';
import { fetchUrlText } from '../lib/safeFetch.js';
import { getLiveSession, saveLiveSession, clearLiveSession, LIVE_TOOLS } from '../lib/liveSession.js';

const TOOL_LABELS = { meeting: 'Meeting Room consultation', quiz: 'Interview Prep session' };
const SIGNUP_LINE = "If you haven't already, signing up is free and unlocks your personal workspace — every consultation saved, and you can resume any conversation right where you left off. It stays free after signing up too.";
const ALLOWED_SAVE_TOOLS = new Set(['gaap', 'cv-review', 'cv-tailor', 'ask', 'fsreview']);

// Department/Designation dropdown options on the signup form — kept in sync with the
// <select>-equivalent searchable dropdowns in index.html. "Other" triggers a separate,
// dedicated free-text field for each (departmentOther / designationOther) — never shared.
const DEPARTMENTS = new Set(['Internal Audit', 'External Audit', 'Tax', 'Advisory', 'AI', 'Accounting & Finance', 'Risk & Compliance', 'Treasury', 'Other']);
const DESIGNATIONS = new Set(['Associate', 'Senior Associate', 'Assistant Manager', 'Manager', 'Senior Manager', 'Director', 'Partner', 'CEO', 'CFO', 'VP / Executive Director', 'Other']);

async function handleSignup(req, res, { resendKey, kvUrl, kvToken }) {
  if (!resendKey) { res.status(500).json({ error: 'Email service not configured yet' }); return; }
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Accounts service not configured yet' }); return; }

  const usage = await logAndCheckUsage(req, { kvUrl, kvToken }, 'signup');
  if (usage.limited) { res.status(429).json({ error: 'Too many signup attempts — please wait 15 minutes and try again' }); return; }

  const { name, email, password, company, department, departmentOther, designation, designationOther, country, city } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !normalizedEmail.includes('@') || !password || password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'Please provide your name, a valid email, and a password (6-128 characters)' });
    return;
  }

  // Check duplicate email first (cheap lookup) — don't make a returning user fill out
  // every new field below before learning they already have an account.
  const existingResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const existingData = await existingResp.json();
  if (existingData?.result) {
    res.status(409).json({ error: 'This account has already been used', duplicate: true });
    return;
  }

  const cleanCompany = String(company || '').trim().slice(0, 120);
  const cleanCountry = String(country || '').trim().slice(0, 80);
  const cleanCity = String(city || '').trim().slice(0, 80);
  if (!cleanCompany || !cleanCountry || !cleanCity) {
    res.status(400).json({ error: 'Please provide your company, country, and city' });
    return;
  }

  const cleanDepartment = DEPARTMENTS.has(department) ? department : '';
  const cleanDepartmentOther = department === 'Other' ? String(departmentOther || '').trim().slice(0, 120) : '';
  if (!cleanDepartment || (cleanDepartment === 'Other' && !cleanDepartmentOther)) {
    res.status(400).json({ error: 'Please select your department (or specify it if you chose Other)' });
    return;
  }

  const cleanDesignation = DESIGNATIONS.has(designation) ? designation : '';
  const cleanDesignationOther = designation === 'Other' ? String(designationOther || '').trim().slice(0, 120) : '';
  if (!cleanDesignation || (cleanDesignation === 'Other' && !cleanDesignationOther)) {
    res.status(400).json({ error: 'Please select your designation (or specify it if you chose Other)' });
    return;
  }

  const user = {
    name, email: normalizedEmail, passwordHash: hashPassword(password),
    company: cleanCompany, department: cleanDepartment, departmentOther: cleanDepartmentOther,
    designation: cleanDesignation, designationOther: cleanDesignationOther,
    country: cleanCountry, city: cleanCity,
    createdAt: new Date().toISOString(),
  };
  await fetch(`${kvUrl}/set/user:${normalizedEmail}/${encodeURIComponent(JSON.stringify(user))}`, { headers: { authorization: `Bearer ${kvToken}` } });

  setSessionCookie(res, { email: normalizedEmail, name });

  // Persist to the signup database + counter that powers the admin dashboard and the
  // weekly Excel export (lib/exportData.js reads this same signups_log list).
  await recordSignup({ kvUrl, kvToken }, {
    name, email: normalizedEmail, company: cleanCompany,
    department: cleanDepartment, departmentOther: cleanDepartmentOther,
    designation: cleanDesignation, designationOther: cleanDesignationOther,
    country: cleanCountry, city: cleanCity,
  });

  await sendEmail(resendKey, {
      from: 'Usman Qureshi | Audit & Advisory <welcome@uqconsulting.org>',
      to: [normalizedEmail],
      subject: `Welcome aboard, ${name.split(' ')[0]}!`,
      html: `
        <h2>Welcome, ${name.split(' ')[0]}!</h2>
        <p>Thanks for signing up — and yes, it's completely free, and every AI tool on the site stays free after signing up too. The only difference now is that everything is saved.</p>
        <p>You now have a personal workspace: every Meeting Room and Knowledge Test consultation you finish gets saved there automatically, you can pick up any past conversation right where you left off, and you'll get a friendly follow-up email a day after each session in case you think of more questions — just reply to it.</p>
        <p>A few things worth exploring while you're here:</p>
        <ul>
          <li><strong>The Meeting Room</strong> — a live AI panel of audit, tax, legal and technical specialists you can actually talk to.</li>
          <li><strong>Knowledge Test</strong> — interview and exam prep with a friendly AI coach.</li>
          <li><strong>GAAP Compare</strong> — IFRS vs US/UK/Irish/Luxembourg/Australian GAAP, with a live research assistant.</li>
          <li><strong>Job Search</strong> — upload your CV for an honest ATS-style review and tailored rewrite.</li>
        </ul>
        <p>See you back soon.</p>
      `,
  }, { kvUrl, kvToken });

  await sendEmail(resendKey, {
      from: 'Website Signups <signups@uqconsulting.org>',
      to: ['usmanqureshi645@gmail.com'],
      subject: `New website signup: ${name}`,
      html: `<p>New signup on the website:</p><p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${normalizedEmail}</p>`,
  }, { kvUrl, kvToken });

  res.status(200).json({ ok: true, name, email: normalizedEmail });
}

async function handleLogin(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Accounts service not configured yet' }); return; }

  const usage = await logAndCheckUsage(req, { kvUrl, kvToken }, 'login');
  if (usage.limited) { res.status(429).json({ error: 'Too many login attempts — please wait a moment and try again' }); return; }

  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@') || !password) {
    res.status(400).json({ error: 'Please provide your email and password' });
    return;
  }

  // Check if account is locked due to failed attempts
  const attempts = await checkLoginAttempts(kvUrl, kvToken, normalizedEmail);
  if (attempts.isLocked) {
    res.status(429).json({ error: 'Too many failed attempts — please try again in 15 minutes' });
    return;
  }

  const getResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const getData = await getResp.json();
  if (!getData?.result) {
    await recordFailedLogin(kvUrl, kvToken, normalizedEmail);
    res.status(401).json({ error: 'No account found with that email — sign up free instead?' });
    return;
  }

  const user = JSON.parse(getData.result);
  if (!verifyPassword(password, user.passwordHash)) {
    await recordFailedLogin(kvUrl, kvToken, normalizedEmail);
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  // Clear failed attempts on successful login
  await clearLoginAttempts(kvUrl, kvToken, normalizedEmail);
  setSessionCookie(res, { email: user.email, name: user.name });
  res.status(200).json({ ok: true, name: user.name, email: user.email });
}

async function handleLogout(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

async function handleMe(req, res) {
  const user = getUserFromRequest(req);
  res.status(200).json(user ? { loggedIn: true, name: user.name, email: user.email } : { loggedIn: false });
}

const RESET_CODE_TTL_SECONDS = 60 * 10; // 10 minutes

async function handleForgotPassword(req, res, { resendKey, kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Accounts service not configured yet' }); return; }

  const usage = await logAndCheckUsage(req, { kvUrl, kvToken }, 'forgot-password');
  if (usage.limited) { res.status(429).json({ error: 'Too many requests — please wait a minute and try again' }); return; }

  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    res.status(400).json({ error: 'Please provide a valid email' });
    return;
  }

  // Always respond ok — don't leak whether an account exists for this email.
  const getResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const getData = await getResp.json();
  if (!getData?.result) { res.status(200).json({ ok: true }); return; }

  const user = JSON.parse(getData.result);
  const code = String(Math.floor(10000 + Math.random() * 90000));

  const key = `resetcode:${normalizedEmail}`;
  await fetch(`${kvUrl}/set/${key}/${code}`, { headers: { authorization: `Bearer ${kvToken}` } });
  await fetch(`${kvUrl}/expire/${key}/${RESET_CODE_TTL_SECONDS}`, { headers: { authorization: `Bearer ${kvToken}` } });

  if (resendKey) {
    await sendEmail(resendKey, {
      from: 'Usman Qureshi | Audit & Advisory <welcome@uqconsulting.org>',
      to: [normalizedEmail],
      subject: 'Your password reset code',
      html: `
        <h2>Reset your password</h2>
        <p>Hi ${user.name.split(' ')[0]}, here's your password reset code:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
        <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      `,
    }, { kvUrl, kvToken });
  }

  res.status(200).json({ ok: true });
}

async function handleResetPassword(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Accounts service not configured yet' }); return; }

  const { email, code, newPassword } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !code || !newPassword || newPassword.length < 6 || newPassword.length > 128) {
    res.status(400).json({ error: 'Please provide your email, the code, and a new password (6-128 characters)' });
    return;
  }

  const codeKey = `resetcode:${normalizedEmail}`;
  const codeResp = await fetch(`${kvUrl}/get/${codeKey}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const codeData = await codeResp.json();
  if (!codeData?.result || codeData.result !== String(code)) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }

  const getResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const getData = await getResp.json();
  if (!getData?.result) { res.status(400).json({ error: 'Invalid or expired code' }); return; }

  const user = JSON.parse(getData.result);
  user.passwordHash = hashPassword(newPassword);
  await fetch(`${kvUrl}/set/user:${normalizedEmail}/${encodeURIComponent(JSON.stringify(user))}`, { headers: { authorization: `Bearer ${kvToken}` } });
  await fetch(`${kvUrl}/del/${codeKey}`, { headers: { authorization: `Bearer ${kvToken}` } });

  setSessionCookie(res, { email: user.email, name: user.name });
  res.status(200).json({ ok: true, name: user.name, email: user.email });
}

async function handleSaveConsultation(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Workspace service not configured yet' }); return; }
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Sign up free to save this to your workspace' }); return; }

  const { tool, title, transcript, summaryHtml } = req.body || {};
  if (!ALLOWED_SAVE_TOOLS.has(tool) || !title || (!transcript && !summaryHtml)) {
    res.status(400).json({ error: 'Missing tool, title, or content to save' });
    return;
  }

  const id = await saveConsultation({ kvUrl, kvToken, email: user.email, tool, title: String(title).slice(0, 80), transcript: transcript || null, summaryHtml: summaryHtml || null });
  res.status(200).json({ ok: true, id });
}

async function fetchConsultations(kvUrl, kvToken, email) {
  const listResp = await fetch(`${kvUrl}/lrange/consultations:${email}/0/199`, { headers: { authorization: `Bearer ${kvToken}` } });
  const listData = await listResp.json();
  return (Array.isArray(listData?.result) ? listData.result : [])
    .map(raw => { try { return JSON.parse(raw); } catch { return null; } })
    .filter(Boolean);
}

async function handleWorkspaceList(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Workspace service not configured yet' }); return; }
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }

  const records = await fetchConsultations(kvUrl, kvToken, user.email);
  res.status(200).json({ ok: true, name: user.name, email: user.email, consultations: records });
}

async function handleWorkspaceGet(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Workspace service not configured yet' }); return; }
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }

  const id = req.query?.id;
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

  const records = await fetchConsultations(kvUrl, kvToken, user.email);
  const record = records.find(r => r.id === id);
  if (!record) { res.status(404).json({ error: 'Consultation not found' }); return; }

  res.status(200).json({ ok: true, consultation: record });
}

// Shared CV / cover-letter / contact profile, reused across every tool for logged-in users.
// Safely read a user-supplied link (e.g. a job posting) server-side and return its text.
// SSRF-guarded in lib/safeFetch.js; login-required like every other AI-adjacent action.
async function handleFetchUrl(req, res) {
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }
  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    res.status(400).json({ error: 'Provide a valid http(s) link' }); return;
  }
  const text = await fetchUrlText(url.trim());
  if (!text) { res.status(422).json({ error: "Couldn't read that link", text: '' }); return; }
  res.status(200).json({ ok: true, text });
}

// ── Cross-device live-session sync ────────────────────────────────────────────
// Each logged-in user's in-progress conversation per tool is mirrored to Redis so
// their other devices can pull it. See lib/liveSession.js.
async function handleSessionGet(req, res, { kvUrl, kvToken }) {
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }
  const tool = String(req.query?.tool || '');
  if (!LIVE_TOOLS.includes(tool)) { res.status(400).json({ error: 'Unknown tool' }); return; }
  const session = await getLiveSession({ kvUrl, kvToken, email: user.email, tool });
  res.status(200).json({ ok: true, session: session || null });
}

async function handleSessionSave(req, res, { kvUrl, kvToken }) {
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }
  const { tool, history, meta } = req.body || {};
  if (!LIVE_TOOLS.includes(tool)) { res.status(400).json({ error: 'Unknown tool' }); return; }
  if (!Array.isArray(history)) { res.status(400).json({ error: 'history must be an array' }); return; }
  // Guard against an oversized blob taking down the write.
  if (JSON.stringify(history).length > 400000) { res.status(413).json({ error: 'Conversation too large to sync' }); return; }
  const rec = await saveLiveSession({ kvUrl, kvToken, email: user.email, tool, history, meta });
  res.status(200).json({ ok: true, rev: rec?.rev || 0, updatedAt: rec?.updatedAt || null });
}

async function handleSessionClear(req, res, { kvUrl, kvToken }) {
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }
  const { tool } = req.body || {};
  if (!LIVE_TOOLS.includes(tool)) { res.status(400).json({ error: 'Unknown tool' }); return; }
  await clearLiveSession({ kvUrl, kvToken, email: user.email, tool });
  res.status(200).json({ ok: true });
}

async function handleProfileGet(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Profile service not configured yet' }); return; }
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }
  const profile = await getProfile({ kvUrl, kvToken, email: user.email });
  res.status(200).json({ ok: true, name: user.name, email: user.email, profile: profile || {} });
}

async function handleProfileSave(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Profile service not configured yet' }); return; }
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Sign up free to save this to your workspace' }); return; }

  const { cv, cvFilename, coverLetter, coverFilename, location, country, experienceLevel } = req.body || {};
  const patch = {};
  if (typeof cv === 'string') patch.cv = cv.slice(0, 60000);
  if (typeof cvFilename === 'string') patch.cvFilename = cvFilename.slice(0, 200);
  if (typeof coverLetter === 'string') patch.coverLetter = coverLetter.slice(0, 60000);
  if (typeof coverFilename === 'string') patch.coverFilename = coverFilename.slice(0, 200);
  if (typeof location === 'string') patch.location = location.slice(0, 120);
  if (typeof country === 'string') patch.country = country.slice(0, 120);
  if (typeof experienceLevel === 'string') patch.experienceLevel = experienceLevel.slice(0, 60);
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: 'Nothing to save' }); return; }

  const profile = await saveProfile({ kvUrl, kvToken, email: user.email, patch });
  res.status(200).json({ ok: true, profile });
}

const EXPERIENCE_LABELS = {
  graduate: 'Graduate / Entry-level',
  associate: 'Associate / Senior Associate',
  manager: 'Manager',
  'assistant-manager': 'Assistant Manager',
  senior: 'Senior Manager / Director',
};

function buildJobSearchLinks(roleTitles, location) {
  const loc = encodeURIComponent(location || '');
  const links = [];
  roleTitles.slice(0, 3).forEach(title => {
    const kw = encodeURIComponent(title);
    links.push({ label: `LinkedIn — ${title}`, url: `https://www.linkedin.com/jobs/search/?keywords=${kw}${loc ? `&location=${loc}` : ''}` });
    links.push({ label: `Indeed — ${title}`, url: `https://www.indeed.com/jobs?q=${kw}${loc ? `&l=${loc}` : ''}` });
  });
  if (roleTitles[0]) {
    links.push({ label: `TotalJobs — ${roleTitles[0]}`, url: `https://www.totaljobs.com/jobs/${encodeURIComponent(roleTitles[0]).replace(/%20/g, '-')}` });
    links.push({ label: `eFinancialCareers — ${roleTitles[0]}`, url: `https://www.efinancialcareers.co.uk/search?q=${encodeURIComponent(roleTitles[0])}` });
  }
  return links;
}

async function handlePersonalizedJobs(req, res, { kvUrl, kvToken, apiKey }) {
  if (!apiKey) { res.status(500).json({ error: 'Server not configured' }); return; }
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Sign up free to use personalized job search' }); return; }

  const { cv, coverLetter, location, country, experienceLevel } = req.body || {};
  if (!cv || !String(cv).trim()) { res.status(400).json({ error: 'Please upload your CV first' }); return; }

  const expLabel = EXPERIENCE_LABELS[experienceLevel] || experienceLevel || 'any level';
  const system = `You help a finance/audit/accounting professional find relevant job search terms based on their CV. Extract their likely role titles, seniority and key skills, then respond with ONLY valid JSON, no markdown fencing, in this exact shape:
{
  "roleTitles": ["<2-4 specific job titles this person should search for, ordered by best fit>"],
  "summary": "<2-3 short sentences, written directly to the candidate, on what kind of roles fit their background and why, considering the experience level ${expLabel} and location preference ${location || 'not specified'}${country ? `, country ${country}` : ''}>"
}`;
  const userMessage = `CANDIDATE CV:\n${cv}\n\n${coverLetter ? `COVER LETTER:\n${coverLetter}\n\n` : ''}PREFERRED LOCATION: ${location || 'not specified'}\nPREFERRED COUNTRY: ${country || 'not specified'}\nTARGET EXPERIENCE LEVEL: ${expLabel}`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system, messages: [{ role: 'user', content: userMessage }] }),
    });
    const data = await upstream.json();
    if (!upstream.ok) { res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' }); return; }

    const text = data?.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { roleTitles: [], summary: text }; }

    const roleTitles = Array.isArray(parsed.roleTitles) && parsed.roleTitles.length ? parsed.roleTitles : ['Audit Manager'];
    const links = buildJobSearchLinks(roleTitles, location || country || '');

    res.status(200).json({ ok: true, roleTitles, summary: parsed.summary || '', links });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}

async function handleCronFollowups(req, res, { kvUrl, kvToken, resendKey }) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!kvUrl || !kvToken || !resendKey) { res.status(200).json({ ok: true, processed: 0 }); return; }

  const now = Date.now();
  const dueResp = await fetch(`${kvUrl}/zrangebyscore/followups_zset/-inf/${now}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const dueData = await dueResp.json();
  const dueMembers = Array.isArray(dueData?.result) ? dueData.result : [];

  let processed = 0;
  for (const member of dueMembers) {
    let item;
    try { item = JSON.parse(member); } catch {
      await fetch(`${kvUrl}/zrem/followups_zset/${encodeURIComponent(member)}`, { headers: { authorization: `Bearer ${kvToken}` } });
      continue;
    }

    const toolLabel = TOOL_LABELS[item.tool] || 'session';
    const firstName = (item.name || '').split(' ')[0] || 'there';
    const html = `
      <p>Hi ${firstName},</p>
      <p>Just checking in — thanks again for using the ${toolLabel} yesterday. Hope it was helpful!</p>
      <p>If you've got any more questions or want to keep going, just reply to this email${item.replyTo ? " and we'll pick the conversation back up" : ''}.</p>
      <p>${SIGNUP_LINE}</p>
      <p>Talk soon,<br>Usman</p>
    `;

    const emailResp = await sendEmail(resendKey, {
        from: item.replyTo ? `${item.tool === 'quiz' ? 'Interview Prep Coach' : 'Meeting Room'} <${item.tool === 'quiz' ? 'coach' : 'meetingroom'}@uqconsulting.org>` : 'Usman Qureshi | Audit & Advisory <noreply@uqconsulting.org>',
        to: [item.email],
        ...(item.replyTo ? { reply_to: item.replyTo } : {}),
        subject: `Following up on your ${toolLabel}`,
        html,
    }, { kvUrl, kvToken });
    if (!emailResp.ok) console.error('[account:cron-followups] send failed for', item.email, await emailResp.text());

    await fetch(`${kvUrl}/zrem/followups_zset/${encodeURIComponent(member)}`, { headers: { authorization: `Bearer ${kvToken}` } });
    processed++;
  }

  res.status(200).json({ ok: true, processed });
}

// Weekly full-snapshot Excel export (3 sheets: Signups, Feature Usage, Feature Ratings —
// see lib/exportData.js), emailed to the owner. Same Bearer CRON_SECRET pattern as cron-followups.
async function handleCronExportData(req, res, { kvUrl, kvToken, resendKey }) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!kvUrl || !kvToken || !resendKey) { res.status(200).json({ ok: true, sent: false, reason: 'not configured' }); return; }

  try {
    const buffer = await buildWorkbook({ kvUrl, kvToken });
    const dateLabel = new Date().toISOString().slice(0, 10);
    const emailResp = await sendEmail(resendKey, {
        from: 'Website Data Export <data@uqconsulting.org>',
        to: ['usmanqureshi645@gmail.com'],
        subject: `Weekly website data export — ${dateLabel}`,
        html: `<p>Attached is the latest full snapshot of signups, feature usage, and feature ratings (3 sheets), as of ${new Date().toISOString()}.</p><p>This is a complete export each time, not incremental — safe to keep just the most recent file.</p>`,
        attachments: [{ filename: `website-export-${dateLabel}.xlsx`, content: buffer.toString('base64') }],
    }, { kvUrl, kvToken });

    if (!emailResp.ok) { console.error('[account:cron-export-data] send failed', await emailResp.text()); res.status(200).json({ ok: true, sent: false }); return; }
    res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('[account:cron-export-data] failed', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// On-demand version of the same export — gated by the admin DASHBOARD_KEY (same pattern
// as ?action=dashboard) so the owner can pull current data without waiting for Monday.
async function handleExportData(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Storage not configured yet' }); return; }
  const provided = req.query?.key || req.headers['x-dashboard-key'];
  if (!verifyAdminKey(provided)) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const buffer = await buildWorkbook({ kvUrl, kvToken });
    const dateLabel = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="website-export-${dateLabel}.xlsx"`);
    res.status(200).send(buffer);
  } catch (err) {
    console.error('[account:export-data] failed', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// Public, no-auth visitor ping — fired on page load + a periodic heartbeat from index.html.
// Powers the live-traffic and visitor counts on the admin dashboard.
async function handleTrack(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(200).json({ ok: true }); return; }
  const vid = String((req.body && req.body.vid) || req.query?.vid || '').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  if (vid) { await Promise.all([recordVisit({ kvUrl, kvToken }, vid), recordPresence({ kvUrl, kvToken }, vid)]); }
  res.status(200).json({ ok: true });
}

// Owner-only analytics read. Gated by DASHBOARD_KEY (separate from the Redis token — see lib/auth.js).
// Powers the Overview tab + its 15s poll. Kept lightweight; the Costs/Usage/Database tabs have
// their own dedicated actions so this payload doesn't balloon on every tick.
async function handleDashboard(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Storage not configured yet' }); return; }
  const provided = req.query?.key || req.headers['x-dashboard-key'];
  if (!verifyAdminKey(provided)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const data = await getDashboardData({ kvUrl, kvToken });

  // Most-used-tool-today — best-effort; a feature_usage_log read failure must not break Overview.
  let mostUsedToolToday = null;
  try {
    const { todayCounts } = await getUsageAggregates({ kvUrl, kvToken });
    mostUsedToolToday = getMostUsedToolToday(todayCounts);
  } catch { /* non-fatal */ }

  res.status(200).json({ ok: true, ...data, mostUsedToolToday });
}

// Manually-entered Anthropic prepaid balance (no Anthropic API exposes remaining balance).
// GET reads the stored value; POST updates it. Same DASHBOARD_KEY gate as every dashboard action.
async function handleDashboardSetBalance(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Storage not configured yet' }); return; }
  const provided = req.query?.key || req.headers['x-dashboard-key'];
  if (!verifyAdminKey(provided)) { res.status(401).json({ error: 'Unauthorized' }); return; }

  if (req.method === 'GET') {
    const [raw] = await pipe({ kvUrl, kvToken }, [['GET', 'dashboard:anthropic_balance']]);
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    res.status(200).json({ ok: true, balance: parsed });
    return;
  }

  // POST
  const cleanBalance = Number(req.body?.balance);
  const cleanThreshold = Number(req.body?.lowThreshold);
  if (!Number.isFinite(cleanBalance) || cleanBalance < 0) {
    res.status(400).json({ error: 'Please provide a valid non-negative balance' });
    return;
  }
  const record = {
    balance: cleanBalance,
    lowThreshold: Number.isFinite(cleanThreshold) && cleanThreshold >= 0 ? cleanThreshold : 10,
    updatedAt: new Date().toISOString(),
  };
  await pipe({ kvUrl, kvToken }, [['SET', 'dashboard:anthropic_balance', JSON.stringify(record)]]);
  res.status(200).json({ ok: true, balance: record });
}

// Costs tab — real Anthropic spend (live Admin API, internally cached 10 min) + estimated Polly
// cost (from daily char counters) + static Vercel Hobby fact. Not part of the 15s Overview poll.
async function handleDashboardCosts(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Storage not configured yet' }); return; }
  const provided = req.query?.key || req.headers['x-dashboard-key'];
  if (!verifyAdminKey(provided)) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const adminApiKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  const [anthropic, polly] = await Promise.all([
    getAnthropicCostReport({ kvUrl, kvToken, adminApiKey, days: 30 }),
    getPollyCostTrend({ kvUrl, kvToken }, 30),
  ]);

  res.status(200).json({
    ok: true,
    generatedAt: new Date().toISOString(),
    anthropic,
    polly,
    vercel: { plan: 'Hobby', costUsd: 0 },
  });
}

// Usage tab — today leaderboard + ratings + 30-day per-tool trend (from feature_usage_log) plus
// 30-day visitor growth. The all-time leaderboard is already in ?action=dashboard's tools[]; the
// frontend reuses that rather than re-fetching it here.
async function handleDashboardUsage(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Storage not configured yet' }); return; }
  const provided = req.query?.key || req.headers['x-dashboard-key'];
  if (!verifyAdminKey(provided)) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [aggregates, visitorTrend30] = await Promise.all([
    getUsageAggregates({ kvUrl, kvToken }),
    getVisitorTrend30({ kvUrl, kvToken }),
  ]);
  res.status(200).json({ ok: true, generatedAt: new Date().toISOString(), ...aggregates, visitorTrend30 });
}

// Database tab — full signup list (capped at 4999 by signups_log itself) + server-computed
// breakdowns. Deliberately separate from the 200-entry signups.recent in ?action=dashboard.
async function handleDashboardUsers(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Storage not configured yet' }); return; }
  const provided = req.query?.key || req.headers['x-dashboard-key'];
  if (!verifyAdminKey(provided)) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [raw] = await pipe({ kvUrl, kvToken }, [['LRANGE', 'signups_log', '0', '-1']]);
  const signups = (Array.isArray(raw) ? raw : [])
    .map(s => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);

  const byDepartment = {}, byCountry = {}, byCompany = {};
  signups.forEach(s => {
    const dept = s.department === 'Other' ? (s.departmentOther || 'Other') : (s.department || 'Unknown');
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    const country = s.country || 'Unknown';
    byCountry[country] = (byCountry[country] || 0) + 1;
    const company = s.company || 'Unknown';
    byCompany[company] = (byCompany[company] || 0) + 1;
  });
  const toSorted = obj => Object.entries(obj).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

  res.status(200).json({
    ok: true,
    generatedAt: new Date().toISOString(),
    signups,             // signups_log entries never contain passwordHash
    total: signups.length,
    breakdowns: { byDepartment: toSorted(byDepartment), byCountry: toSorted(byCountry), byCompany: toSorted(byCompany) },
  });
}

export default async function handler(req, res) {
  const ctx = {
    resendKey: process.env.RESEND_API_KEY,
    kvUrl: process.env.UPSTASH_REDIS_REST_URL,
    kvToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    apiKey: process.env.ANTHROPIC_API_KEY,
  };
  const action = req.query?.action;

  try {
    switch (action) {
      case 'signup': return req.method === 'POST' ? await handleSignup(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'login': return req.method === 'POST' ? await handleLogin(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'logout': return req.method === 'POST' ? await handleLogout(req, res) : res.status(405).json({ error: 'Method not allowed' });
      case 'me': return await handleMe(req, res);
      case 'forgot-password': return req.method === 'POST' ? await handleForgotPassword(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'reset-password': return req.method === 'POST' ? await handleResetPassword(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'save-consultation': return req.method === 'POST' ? await handleSaveConsultation(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'workspace-list': return await handleWorkspaceList(req, res, ctx);
      case 'workspace-get': return await handleWorkspaceGet(req, res, ctx);
      case 'cron-followups': return await handleCronFollowups(req, res, ctx);
      case 'personalized-jobs': return req.method === 'POST' ? await handlePersonalizedJobs(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'fetch-url': return req.method === 'POST' ? await handleFetchUrl(req, res) : res.status(405).json({ error: 'Method not allowed' });
      case 'session-get': return req.method === 'GET' ? await handleSessionGet(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'session-save': return req.method === 'POST' ? await handleSessionSave(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'session-clear': return req.method === 'POST' ? await handleSessionClear(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'profile-get': return await handleProfileGet(req, res, ctx);
      case 'profile-save': return req.method === 'POST' ? await handleProfileSave(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'track': return await handleTrack(req, res, ctx);
      case 'dashboard': return req.method === 'GET' ? await handleDashboard(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'dashboard-set-balance': return (req.method === 'GET' || req.method === 'POST') ? await handleDashboardSetBalance(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'dashboard-costs': return req.method === 'GET' ? await handleDashboardCosts(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'dashboard-usage': return req.method === 'GET' ? await handleDashboardUsage(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'dashboard-users': return req.method === 'GET' ? await handleDashboardUsers(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'cron-export-data': return await handleCronExportData(req, res, ctx);
      case 'export-data': return req.method === 'GET' ? await handleExportData(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      default: res.status(400).json({ error: 'Unknown or missing action' });
    }
  } catch (err) {
    console.error('[account] unexpected error for action', action, err);
    res.status(500).json({ error: 'Request failed' });
  }
}
