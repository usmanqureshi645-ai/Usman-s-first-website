export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    res.status(500).json({ error: 'Email service not configured yet' });
    return;
  }

  const { name, email } = req.body || {};
  if (!name || !email || !email.includes('@')) {
    res.status(400).json({ error: 'Please provide a valid name and email' });
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Usman | Audit & Advisory <onboarding@resend.dev>',
        to: [email],
        subject: `Welcome aboard, ${name.split(' ')[0]}!`,
        html: `
          <h2>Welcome, ${name.split(' ')[0]}!</h2>
          <p>Thanks for signing up. You now have a personalised corner of the site — look for "<strong>${name.split(' ')[0]}'sGPT</strong>" near the chat bubble next time you visit, your own general-purpose AI assistant.</p>
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
        from: 'Website Signups <onboarding@resend.dev>',
        to: ['usmanqureshi645@gmail.com'],
        subject: `New website signup: ${name}`,
        html: `<p>New signup on the website:</p><p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}</p>`,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
