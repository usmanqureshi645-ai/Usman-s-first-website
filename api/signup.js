import { hashPassword, setSessionCookie, normalizeEmail } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!resendKey) {
    res.status(500).json({ error: 'Email service not configured yet' });
    return;
  }
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Accounts service not configured yet' });
    return;
  }

  const { name, email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !normalizedEmail.includes('@') || !password || password.length < 6) {
    res.status(400).json({ error: 'Please provide your name, a valid email, and a password (6+ characters)' });
    return;
  }

  try {
    const existingResp = await fetch(`${kvUrl}/get/user:${normalizedEmail}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const existingData = await existingResp.json();
    if (existingData?.result) {
      res.status(409).json({ error: 'An account with that email already exists — log in instead?' });
      return;
    }

    const user = {
      name,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    await fetch(`${kvUrl}/set/user:${normalizedEmail}/${encodeURIComponent(JSON.stringify(user))}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });

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
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
