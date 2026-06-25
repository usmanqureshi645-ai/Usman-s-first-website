export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI service not configured' });
    return;
  }

  const { feedback, pageContext } = req.body || {};
  if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 3) {
    res.status(400).json({ error: 'Please provide some feedback text' });
    return;
  }

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

    // Log EVERY submission by email (valid or not) so the inbox doubles as a searchable
    // feedback log — Vercel functions are stateless, so there's no real filesystem to
    // write a persistent log file to; email is the practical equivalent without new infra.
    let emailSent = false;
    if (resendKey) {
      const tag = assessment.valid ? `Validated (${assessment.severity})` : 'Not actionable';
      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Website Feedback <onboarding@resend.dev>',
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
            ${assessment.valid ? `<p>To act on this, open your Claude Code session for this website and ask it to apply the suggested fix.</p>` : `<p><em>The technical agent judged this not specific/actionable enough to act on automatically — review and decide if it still needs attention.</em></p>`}
          `,
        }),
      });
      emailSent = emailResp.ok;
    }

    res.status(200).json({ ...assessment, emailSent });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
