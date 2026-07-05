import { randomUUID } from 'node:crypto';
import { getUserFromRequest } from '../lib/auth.js';
import { saveConsultation, scheduleFollowup } from '../lib/consultations.js';
import { sendEmail } from '../lib/email.js';
import { isMeaningfulSession, logFeatureUse } from '../lib/featureLog.js';

const CONVERSATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Email framing varies by kind — this endpoint now serves both Meeting Room's "End
// meeting" button and GAAP Compare's "End session" button (kept on one function to
// respect the Vercel Hobby 12-function cap). The summary prompt's overall structure
// (Discussion Summary / References / Conclusion) works fine for both unchanged.
const KIND_CONFIG = {
  meeting: { label: "Usman Qureshi's Meeting Room", speakerLabel: 'Panel', fromName: 'Meeting Room', fromAddr: 'meetingroom@uqconsulting.org', subject: 'Your Meeting Room Consultation Summary' },
  gaap: { label: "Usman Qureshi's GAAP Compare", speakerLabel: 'GAAP Champion', fromName: 'GAAP Compare', fromAddr: 'gaap@uqconsulting.org', subject: 'Your GAAP Compare Session Summary' },
};

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

  const { email, transcript, kind, agents, resumed } = req.body || {};
  if (!email || !Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: 'Missing email or transcript' });
    return;
  }
  const cfg = KIND_CONFIG[kind] || KIND_CONFIG.meeting;

  const conversationText = transcript
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'User' : cfg.speakerLabel}: ${m.content}`)
    .join('\n\n');

  const system = `You write professional consultation summary emails on behalf of "${cfg.label}" — a virtual panel of finance specialists on a personal website. Given a raw conversation transcript, produce a polished HTML email body (use simple inline-styled HTML: <h2>, <p>, <ul>, <li>, <a>, no external CSS) with this exact structure:

1. A warm opening paragraph thanking the user for using ${cfg.label}.
2. A heading "Discussion Summary" followed by a clear, well-organised excerpt/summary of what was actually discussed (the user's question(s), the key points raised by each specialist, any risks flagged).
3. A heading "References & Further Reading" with a bullet list of any real source links mentioned during the discussion (IFRS Foundation, Big 4, FRC, PCAOB etc.) — only include real, plausible URLs that were actually referenced; if none were given, link to https://www.ifrs.org/ and https://pcaobus.org/ as general resources.
4. A heading "Other Resources You Might Find Useful" with 2-3 additional relevant links based on the topic discussed.
5. A heading "Conclusion" with a brief, professional closing summary and an invitation to return to the Meeting Room any time.

Tone: professional, warm, clearly human-written consultation style — not robotic. Do not mention that this was AI-generated.

Output format — this is critical: respond with ONLY the raw HTML body itself, starting directly with the opening paragraph's <p> tag. No markdown code fences (no \`\`\`html or \`\`\`), no preamble, no commentary about the transcript or its quality, no notes to the reader before or after the HTML. Even if the transcript is short, incomplete, or seems to cut off mid-conversation, just write the best honest summary you can directly in the HTML — never comment on the transcript's quality or completeness outside of the HTML itself.`;

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
    // Defensive cleanup — the model occasionally adds a markdown code fence or commentary
    // before/after the HTML despite the prompt forbidding it; strip those if present.
    htmlBody = htmlBody.replace(/^```html\s*|```\s*$/gi, '');
    const firstTagIndex = htmlBody.search(/<(p|h[1-6]|ul|div)[\s>]/i);
    if (firstTagIndex > 0) htmlBody = htmlBody.slice(firstTagIndex);
    htmlBody = htmlBody.trim();

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

    const emailResp = await sendEmail(resendKey, {
        from: `${cfg.fromName} <${cfg.fromAddr}>`,
        to: [email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: cfg.subject,
        html: htmlBody,
    }, { kvUrl, kvToken });
    const emailData = await emailResp.json();
    if (!emailResp.ok) {
      res.status(emailResp.status).json({ error: emailData?.message || 'Email send failed' });
      return;
    }

    const loggedInUser = getUserFromRequest(req);

    // Genuine-completion logging for the weekly Excel export (Part 2 of the requirements
    // doc) — "End session" was clicked AND the conversation had enough real back-and-forth
    // to count as actual use, not a quick test. Both kind values route through here.
    if (kvUrl && kvToken && isMeaningfulSession(transcript, { tool: kind })) {
      await logFeatureUse({ kvUrl, kvToken }, {
        tool: kind === 'gaap' ? 'gaap' : 'meeting',
        email: loggedInUser?.email || email,
        detail: { resumed: !!resumed },
      });
      if (resumed) {
        await logFeatureUse({ kvUrl, kvToken }, { tool: 'resume-session', email: loggedInUser?.email || email, detail: { originalTool: kind } });
      }
    }

    // If the visitor is logged in, save this to their permanent workspace history
    // and queue a 24h "did this help?" follow-up email. GAAP already has its own
    // separate gaapSaveConsultation() save path, so scope this to Meeting Room only —
    // otherwise a GAAP "End session" call here would mis-tag the save tool:'meeting'.
    if (kind === 'meeting' && loggedInUser && kvUrl && kvToken) {
      try {
        const firstUserMsg = transcript.find(m => m.role === 'user')?.content || 'Meeting Room consultation';
        const consultationId = await saveConsultation({
          kvUrl, kvToken,
          email: loggedInUser.email,
          tool: 'meeting',
          title: firstUserMsg.slice(0, 80),
          transcript,
          summaryHtml: htmlBody,
          agents: Array.isArray(agents) ? agents : [],
        });
        if (replyTo) {
          await scheduleFollowup({
            kvUrl, kvToken,
            email: loggedInUser.email,
            name: loggedInUser.name,
            tool: 'meeting',
            consultationId,
            replyTo,
          });
        }
      } catch {
        // non-fatal — the summary email already sent successfully
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
