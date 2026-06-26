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
  if (!resendKey) {
    res.status(500).json({ error: 'Email service not configured yet' });
    return;
  }

  const { email, transcript } = req.body || {};
  if (!email || !Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: 'Missing email or transcript' });
    return;
  }

  const conversationText = transcript
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Candidate' : 'Coach'}: ${m.content}`)
    .join('\n\n');

  const system = `You write warm, encouraging, kind feedback emails on behalf of an "Interview Prep Coach" feature on a personal website. You are given a transcript of an interview-prep conversation between the coach and a candidate practising for a real job interview.

Your job is to write a personalised feedback report as an HTML email body (simple inline-styled HTML: <h2>, <p>, <ul>, <li>, no external CSS). This must be:
- KIND and FLATTERING in tone throughout — never brutal, never harsh, never disappointing. The goal is to make the candidate feel good about practising and motivated to keep improving, never discouraged.
- SPECIFIC to this exact candidate and their actual answers in the transcript — never generic advice. Quote or reference specific things they said.
- Genuinely useful and constructive, just delivered softly — frame every development point as "something to sharpen further" or "an easy win" rather than a flaw.

Structure the email exactly like this:
1. A warm opening paragraph thanking them for practising and congratulating them on taking the prep seriously.
2. "## How You Came Across" — comments on their apparent energy, confidence and tone based on how they wrote their answers (word choice, hedging language, length/conciseness, enthusiasm) — be specific, reference actual phrasing they used.
3. "## What You Did Well" — at least 3 specific genuine strengths, quoting or referencing their actual answers.
4. "## A Few Things to Sharpen" — 2-4 SOFTLY-FRAMED development points (e.g. "one easy win would be...", "you could make this even stronger by..."), covering things like: crispness/clarity of answers, use of specific examples/metrics (STAR method), technical accuracy, and confidence signals — always specific to what they actually said, never generic.
5. "## Final Encouragement" — a warm, motivating closing paragraph.

Never use harsh words like "weak", "bad", "failed", "poor". Use "developing", "an opportunity", "worth strengthening" instead.`;

  try {
    const summaryResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `Interview prep transcript:\n\n${conversationText}` }],
      }),
    });

    const summaryData = await summaryResp.json();
    if (!summaryResp.ok) {
      res.status(summaryResp.status).json({ error: summaryData?.error?.message || 'Summary generation failed' });
      return;
    }

    const htmlBody = summaryData?.content?.[0]?.text || '<p>No feedback available.</p>';

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Interview Prep Coach <coach@uqconsulting.org>',
        to: [email],
        subject: 'Your Interview Prep Feedback — Great Work!',
        html: htmlBody,
      }),
    });

    const emailData = await emailResp.json();
    if (!emailResp.ok) {
      res.status(emailResp.status).json({ error: emailData?.message || 'Email send failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
