// Consolidated accounts + workspace endpoint — Vercel's Hobby plan caps a deployment at
// 12 Serverless Functions, so every account/workspace action is routed through this one
// file via ?action=, instead of one file per action.
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, getUserFromRequest, normalizeEmail } from '../lib/auth.js';
import { saveConsultation, scheduleFollowup } from '../lib/consultations.js';

const TOOL_LABELS = { meeting: 'Meeting Room consultation', quiz: 'Interview Prep session' };
const SIGNUP_LINE = "If you haven't already, signing up is free and unlocks your personal workspace — every consultation saved, and you can resume any conversation right where you left off. It stays free after signing up too.";
const ALLOWED_SAVE_TOOLS = new Set(['gaap', 'cv-review', 'cv-tailor', 'ask', 'fsreview']);

async function handleSignup(req, res, { resendKey, kvUrl, kvToken }) {
  if (!resendKey) { res.status(500).json({ error: 'Email service not configured yet' }); return; }
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Accounts service not configured yet' }); return; }

  const { name, email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !normalizedEmail.includes('@') || !password || password.length < 6) {
    res.status(400).json({ error: 'Please provide your name, a valid email, and a password (6+ characters)' });
    return;
  }

  const existingResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const existingData = await existingResp.json();
  if (existingData?.result) {
    res.status(409).json({ error: 'An account with that email already exists — log in instead?' });
    return;
  }

  const user = { name, email: normalizedEmail, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  await fetch(`${kvUrl}/set/user:${normalizedEmail}/${encodeURIComponent(JSON.stringify(user))}`, { headers: { authorization: `Bearer ${kvToken}` } });

  setSessionCookie(res, { email: normalizedEmail, name });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
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
    }),
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Website Signups <signups@uqconsulting.org>',
      to: ['usmanqureshi645@gmail.com'],
      subject: `New website signup: ${name}`,
      html: `<p>New signup on the website:</p><p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${normalizedEmail}</p>`,
    }),
  });

  res.status(200).json({ ok: true, name, email: normalizedEmail });
}

async function handleLogin(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) { res.status(500).json({ error: 'Accounts service not configured yet' }); return; }

  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@') || !password) {
    res.status(400).json({ error: 'Please provide your email and password' });
    return;
  }

  const getResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const getData = await getResp.json();
  if (!getData?.result) { res.status(401).json({ error: 'No account found with that email — sign up free instead?' }); return; }

  const user = JSON.parse(getData.result);
  if (!verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: 'Incorrect password' }); return; }

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

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: item.replyTo ? `${item.tool === 'quiz' ? 'Interview Prep Coach' : 'Meeting Room'} <${item.tool === 'quiz' ? 'coach' : 'meetingroom'}@uqconsulting.org>` : 'Usman Qureshi | Audit & Advisory <noreply@uqconsulting.org>',
        to: [item.email],
        ...(item.replyTo ? { reply_to: item.replyTo } : {}),
        subject: `Following up on your ${toolLabel}`,
        html,
      }),
    });
    if (!emailResp.ok) console.error('[account:cron-followups] send failed for', item.email, await emailResp.text());

    await fetch(`${kvUrl}/zrem/followups_zset/${encodeURIComponent(member)}`, { headers: { authorization: `Bearer ${kvToken}` } });
    processed++;
  }

  res.status(200).json({ ok: true, processed });
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
      case 'save-consultation': return req.method === 'POST' ? await handleSaveConsultation(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      case 'workspace-list': return await handleWorkspaceList(req, res, ctx);
      case 'workspace-get': return await handleWorkspaceGet(req, res, ctx);
      case 'cron-followups': return await handleCronFollowups(req, res, ctx);
      case 'personalized-jobs': return req.method === 'POST' ? await handlePersonalizedJobs(req, res, ctx) : res.status(405).json({ error: 'Method not allowed' });
      default: res.status(400).json({ error: 'Unknown or missing action' });
    }
  } catch (err) {
    console.error('[account] unexpected error for action', action, err);
    res.status(500).json({ error: 'Request failed' });
  }
}
