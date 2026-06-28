import { getUserFromRequest, verifyAdminKey } from '../lib/auth.js';
import { sendEmail } from '../lib/email.js';

async function findEntryIndex(kvUrl, kvToken, id) {
  const r = await fetch(`${kvUrl}/lrange/feedback_log/0/-1`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
  const data = await r.json();
  const raw = data.result || [];
  for (let i = 0; i < raw.length; i++) {
    try {
      const entry = JSON.parse(raw[i]);
      if (entry.id === id) return { index: i, entry };
    } catch { /* skip malformed */ }
  }
  return { index: -1, entry: null };
}

async function handleAttachEmail(req, res, { kvUrl, kvToken }) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Storage not configured yet' });
    return;
  }
  const { id, email } = req.body || {};
  if (!id || !email || !String(email).includes('@')) {
    res.status(400).json({ error: 'Missing id or valid email' });
    return;
  }
  try {
    const { index, entry } = await findEntryIndex(kvUrl, kvToken, id);
    if (index === -1) {
      res.status(404).json({ error: 'Feedback entry not found' });
      return;
    }
    entry.email = String(email).trim();
    await fetch(`${kvUrl}/lset/feedback_log/${index}/${encodeURIComponent(JSON.stringify(entry))}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}

async function handleResolve(req, res, { kvUrl, kvToken, resendKey }) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Storage not configured yet' });
    return;
  }
  // Same DASHBOARD_KEY pattern as ?action=list — this is an owner-only action
  const provided = req.query?.key || req.headers['x-feedback-key'];
  if (!verifyAdminKey(provided)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { id, resolutionSummary } = req.body || {};
  if (!id || !resolutionSummary) {
    res.status(400).json({ error: 'Missing id or resolutionSummary' });
    return;
  }
  try {
    const { index, entry } = await findEntryIndex(kvUrl, kvToken, id);
    if (index === -1) {
      res.status(404).json({ error: 'Feedback entry not found' });
      return;
    }
    entry.resolved = true;
    entry.resolutionSummary = resolutionSummary;
    entry.resolvedAt = new Date().toISOString();
    await fetch(`${kvUrl}/lset/feedback_log/${index}/${encodeURIComponent(JSON.stringify(entry))}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });

    let emailSent = false;
    if (resendKey && entry.email) {
      const emailResp = await sendEmail(resendKey, {
          from: 'Usman Qureshi <feedback@uqconsulting.org>',
          to: [entry.email],
          subject: `Thank you for your feedback — here's what we did about it`,
          html: `
            <p>Hi there,</p>
            <p>Thank you for taking the time to report something on the website a little while ago. I wanted to follow up personally and let you know it's been looked at.</p>
            <p><strong>What you reported:</strong><br>${entry.feedback}</p>
            ${entry.summary ? `<p><strong>How I understood it:</strong> ${entry.summary}</p>` : ''}
            <p><strong>What's been done:</strong><br>${resolutionSummary}</p>
            <p>I really appreciate you flagging it — feedback like yours directly makes the site better. If you notice anything else, the feedback widget (bottom-right) is always open.</p>
            <p>Best,<br>Usman Qureshi</p>
          `,
      }, { kvUrl, kvToken });
      emailSent = emailResp.ok;
    }
    res.status(200).json({ ok: true, emailSent });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}

async function handleList(req, res, { kvUrl, kvToken }) {
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'Storage not configured yet' });
    return;
  }

  // Gated by DASHBOARD_KEY so this isn't publicly listable (separate from the Redis token itself)
  const provided = req.query?.key || req.headers['x-feedback-key'];
  if (!verifyAdminKey(provided)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const limit = Math.min(parseInt(req.query?.limit, 10) || 50, 500);
    const r = await fetch(`${kvUrl}/lrange/feedback_log/0/${limit - 1}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const data = await r.json();
    const entries = (data.result || []).map(s => {
      try { return JSON.parse(s); } catch { return { raw: s }; }
    });
    res.status(200).json({ count: entries.length, entries });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}

export default async function handler(req, res) {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;

  if (req.query?.action === 'list') {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    return handleList(req, res, { kvUrl, kvToken });
  }

  if (req.query?.action === 'attach-email') {
    return handleAttachEmail(req, res, { kvUrl, kvToken });
  }

  if (req.query?.action === 'resolve') {
    return handleResolve(req, res, { kvUrl, kvToken, resendKey });
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI service not configured' });
    return;
  }

  const { feedback, pageContext } = req.body || {};
  if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 3) {
    res.status(400).json({ error: 'Please provide some feedback text' });
    return;
  }

  const loggedInUser = getUserFromRequest(req);

  const system = `You are a technical QA agent reviewing a piece of user feedback submitted on a personal finance professional's website (built with HTML/CSS/JS, Vercel serverless functions, and an AI-powered Meeting Room / GAAP comparison / Knowledge Test feature).

Assess whether this feedback describes a genuine, specific, actionable bug or problem (e.g. "the button on X page doesn't work", "the music keeps playing when I open the chat", "text overlaps on mobile") versus vague, spammy, or non-actionable text (e.g. "nice site", random characters, abuse, unrelated content).

Respond with ONLY valid JSON, no markdown, no commentary, in this exact shape:
{"valid": true or false, "summary": "one-sentence plain-English summary of the issue", "suggestedFix": "a brief technical suggestion for what might need to change, or empty string if not valid", "severity": "low|medium|high"}`;

  try {
    const assessResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: `Page context: ${pageContext || 'unknown'}\n\nUser feedback: "${feedback}"` }],
      }),
    });

    const assessData = await assessResp.json();
    if (!assessResp.ok) {
      res.status(assessResp.status).json({ error: assessData?.error?.message || 'Assessment failed' });
      return;
    }

    let assessment;
    try {
      assessment = JSON.parse(assessData?.content?.[0]?.text || '{}');
    } catch {
      assessment = { valid: false, summary: 'Could not parse assessment', suggestedFix: '', severity: 'low' };
    }

    // Persist every submission to Upstash Redis so it can be listed/queried on demand
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      feedback,
      pageContext: pageContext || 'unknown',
      submittedAt: new Date().toISOString(),
      email: loggedInUser?.email || null,
      loggedIn: !!loggedInUser,
      resolved: false,
      ...assessment,
    };
    if (kvUrl && kvToken) {
      try {
        await fetch(`${kvUrl}/lpush/feedback_log/${encodeURIComponent(JSON.stringify(entry))}`, {
          headers: { authorization: `Bearer ${kvToken}` },
        });
        // keep the log bounded so it doesn't grow unbounded
        await fetch(`${kvUrl}/ltrim/feedback_log/0/499`, {
          headers: { authorization: `Bearer ${kvToken}` },
        });
      } catch {
        // non-fatal — still proceed to email even if KV write fails
      }
    }

    // Also log EVERY submission by email (valid or not) as a secondary, human-readable trail
    let emailSent = false;
    if (resendKey) {
      const tag = assessment.valid ? `Validated (${assessment.severity})` : 'Not actionable';
      const emailResp = await sendEmail(resendKey, {
          from: 'Website Feedback <feedback@uqconsulting.org>',
          to: ['usmanqureshi645@gmail.com'],
          subject: `[Feedback Log] ${tag}: ${assessment.summary || feedback.slice(0, 60)}`,
          html: `
            <h2>Website Feedback Log Entry</h2>
            <p><strong>Status:</strong> ${tag}</p>
            <p><strong>Page:</strong> ${pageContext || 'unknown'}</p>
            <p><strong>Submitted at:</strong> ${new Date().toISOString()}</p>
            <p><strong>Original feedback:</strong> ${feedback}</p>
            <p><strong>Agent's summary:</strong> ${assessment.summary || '—'}</p>
            <p><strong>Suggested fix:</strong> ${assessment.suggestedFix || '—'}</p>
            <p><strong>Severity:</strong> ${assessment.severity || '—'}</p>
            <p><strong>Reporter email:</strong> ${entry.email || 'not provided'}</p>
            <p><strong>Entry id (for resolve):</strong> ${entry.id}</p>
            ${assessment.valid ? `<p>To act on this, open your Claude Code session for this website and ask it to apply the suggested fix. Once fixed, call <code>POST /api/feedback?action=resolve&key=&lt;UPSTASH_REDIS_REST_TOKEN&gt;</code> with <code>{"id":"${entry.id}","resolutionSummary":"..."}</code> to send the reporter a thank-you email confirming what was done — only if they have an email on file.</p>` : `<p><em>The technical agent judged this not specific/actionable enough to act on automatically — review and decide if it still needs attention.</em></p>`}
          `,
      }, { kvUrl, kvToken });
      emailSent = emailResp.ok;
    }

    res.status(200).json({ ...assessment, emailSent, id: entry.id, loggedIn: !!loggedInUser });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
