import { randomUUID } from 'node:crypto';

const CONVERSATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiKey) {
    res.status(500).json({ error: 'AI service not configured' });
    return;
  }
  if (!resendKey) {
    res.status(500).json({ error: 'Email service not configured yet' });
    return;
  }

  const { email, transcript, kind, agents } = req.body || {};
  if (!email || !Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: 'Missing email or transcript' });
    return;
  }

  const conversationText = transcript
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'User' : 'Panel'}: ${m.content}`)
    .join('\n\n');

  const system = `You write professional consultation summary emails on behalf of "Usman's Meeting Room" — a virtual panel of finance specialists on a personal website. Given a raw conversation transcript, produce a polished HTML email body (use simple inline-styled HTML: <h2>, <p>, <ul>, <li>, <a>, no external CSS) with this exact structure:

1. A warm opening paragraph thanking the user for using the Meeting Room.
2. A heading "Discussion Summary" followed by a clear, well-organised excerpt/summary of what was actually discussed (the user's question(s), the key points raised by each specialist, any risks flagged).
3. A heading "References & Further Reading" with a bullet list of any real source links mentioned during the discussion (IFRS Foundation, Big 4, FRC, PCAOB etc.) — only include real, plausible URLs that were actually referenced; if none were given, link to https://www.ifrs.org/ and https://pcaobus.org/ as general resources.
4. A heading "Other Resources You Might Find Useful" with 2-3 additional relevant links based on the topic discussed.
5. A heading "Conclusion" with a brief, professional closing summary and an invitation to return to the Meeting Room any time.

Tone: professional, warm, clearly human-written consultation style — not robotic. Do not mention that this was AI-generated.`;

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
        messages: [{ role: 'user', content: `Conversation transcript:\n\n${conversationText}` }],
      }),
    });

    const summaryData = await summaryResp.json();
    if (!summaryResp.ok) {
      res.status(summaryResp.status).json({ error: summaryData?.error?.message || 'Summary generation failed' });
      return;
    }

    let htmlBody = summaryData?.content?.[0]?.text || '<p>No summary available.</p>';

    // Persist the conversation so a reply to this email can resume it (Meeting Room itself is stateless)
    let replyTo;
    if (kvUrl && kvToken && kind === 'meeting') {
      const conversationId = randomUUID();
      const record = JSON.stringify({ email, agents: Array.isArray(agents) ? agents : [], history: transcript });
      try {
        await fetch(`${kvUrl}/set/mrconv:${conversationId}/${encodeURIComponent(record)}/EX/${CONVERSATION_TTL_SECONDS}`, {
          headers: { authorization: `Bearer ${kvToken}` },
        });
        replyTo = `meetingroom+${conversationId}@uqconsulting.org`;
        htmlBody += `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;color:#555">Have a follow-up question? Just reply to this email and the panel will pick the discussion back up.</p>`;
      } catch {
        // non-fatal — summary email still sends without reply capability
      }
    }

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Meeting Room <meetingroom@uqconsulting.org>',
        to: [email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: 'Your Meeting Room Consultation Summary',
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
