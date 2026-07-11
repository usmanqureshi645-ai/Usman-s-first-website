import { randomUUID } from 'node:crypto';
import { getUserFromRequest } from '../lib/auth.js';
import { saveConsultation, scheduleFollowup } from '../lib/consultations.js';
import { sendEmail } from '../lib/email.js';
import { isMeaningfulSession, logFeatureUse } from '../lib/featureLog.js';
import { buildReportEmailPrompt, buildReportMemoPrompt, renderReportJsonToHtml } from '../lib/consultationReport.js';
import { buildConsultationMemoDocx } from '../lib/consultationMemo.js';

const CONVERSATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Email framing varies by kind — this endpoint now serves both Meeting Room's "End
// meeting" button and GAAP Compare's "End session" button (kept on one function to
// respect the Vercel Hobby 12-function cap).
const KIND_CONFIG = {
  meeting: { label: "Usman Qureshi's Meeting Room", speakerLabel: 'Panel', fromName: 'Meeting Room', fromAddr: 'meetingroom@uqconsulting.org', subject: 'Your Meeting Room Consultation Report' },
  gaap: { label: "Usman Qureshi's GAAP Compare", speakerLabel: 'GAAP Champion', fromName: 'GAAP Compare', fromAddr: 'gaap@uqconsulting.org', subject: 'Your GAAP Compare Consultation Report' },
};

function parseJsonReport(raw) {
  const text = String(raw || '').trim();
  try { return JSON.parse(text); } catch {}
  const fenced = text.replace(/^```json\s*|```\s*$/gi, '').trim();
  try { return JSON.parse(fenced); } catch {}
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  return null;
}

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

  const { email, transcript, kind, agents, resumed, coParticipant, format } = req.body || {};
  if (!email || !Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: 'Missing email or transcript' });
    return;
  }
  const cfg = KIND_CONFIG[kind] || KIND_CONFIG.meeting;
  const wantsMemo = format === 'memo';
  // coParticipant = { email, name } — set when this was a live, two-person Meeting Room
  // session (see lib/meetingSession.js); both people get the summary + a workspace save.
  const hasCoParticipant = kind === 'meeting' && coParticipant && coParticipant.email && coParticipant.email !== email;

  const conversationText = transcript
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'User' : cfg.speakerLabel}: ${m.content}`)
    .join('\n\n');

  const system = wantsMemo ? buildReportMemoPrompt({ label: cfg.label }) : buildReportEmailPrompt({ label: cfg.label });

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
        max_tokens: 6000,
        system,
        messages: [{ role: 'user', content: `Conversation transcript:\n\n${conversationText}` }],
      }),
    });

    const summaryData = await summaryResp.json();
    if (!summaryResp.ok) {
      res.status(summaryResp.status).json({ error: summaryData?.error?.message || 'Report generation failed' });
      return;
    }
    const rawText = summaryData?.content?.[0]?.text || '';

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
      } catch {
        // non-fatal — summary email still sends without reply capability
      }
    }

    const jointNoteFor = otherName => hasCoParticipant
      ? `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;color:#555">You attended this consultation together with <strong>${otherName}</strong> and the panel.</p>`
      : '';

    let htmlBody, attachments;
    if (wantsMemo) {
      const report = parseJsonReport(rawText);
      if (!report) { res.status(500).json({ error: 'Report generation failed — please try again' }); return; }
      htmlBody = renderReportJsonToHtml(report);
      const docxBuffer = await buildConsultationMemoDocx({ ...report, recipientName: email });
      attachments = [{ filename: 'Consultation-Memo.docx', content: docxBuffer.toString('base64') }];
    } else {
      htmlBody = rawText.replace(/^```html\s*|```\s*$/gi, '');
      const firstTagIndex = htmlBody.search(/<(p|h[1-6]|ul|div)[\s>]/i);
      if (firstTagIndex > 0) htmlBody = htmlBody.slice(firstTagIndex);
      htmlBody = htmlBody.trim();
      if (replyTo) htmlBody += `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;color:#555">Have a follow-up question? Just reply to this email and the panel will pick the discussion back up.</p>`;
    }

    const emailResp = await sendEmail(resendKey, {
        from: `${cfg.fromName} <${cfg.fromAddr}>`,
        to: [email],
        ...(replyTo && !wantsMemo ? { reply_to: replyTo } : {}),
        subject: wantsMemo ? `${cfg.subject} (Memo)` : cfg.subject,
        html: (wantsMemo ? `<p>Please find your consultation memo attached.</p>` : htmlBody) + jointNoteFor(coParticipant?.name || 'your colleague'),
        ...(attachments ? { attachments } : {}),
    }, { kvUrl, kvToken });
    const emailData = await emailResp.json();
    if (!emailResp.ok) {
      res.status(emailResp.status).json({ error: emailData?.message || 'Email send failed' });
      return;
    }
    if (hasCoParticipant) {
      await sendEmail(resendKey, {
        from: `${cfg.fromName} <${cfg.fromAddr}>`,
        to: [coParticipant.email],
        subject: wantsMemo ? `${cfg.subject} (Memo)` : cfg.subject,
        html: (wantsMemo ? `<p>Please find your consultation memo attached.</p>` : htmlBody) + jointNoteFor('your colleague'),
        ...(attachments ? { attachments } : {}),
      }, { kvUrl, kvToken }).catch(() => {});
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
        if (replyTo && !wantsMemo) {
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

    // Co-participant gets their own workspace save too, even though this request's
    // session cookie belongs to the host, not them
    if (hasCoParticipant && kvUrl && kvToken) {
      try {
        const firstUserMsg = transcript.find(m => m.role === 'user')?.content || 'Meeting Room consultation';
        await saveConsultation({
          kvUrl, kvToken,
          email: coParticipant.email,
          tool: 'meeting',
          title: firstUserMsg.slice(0, 80),
          transcript,
          summaryHtml: htmlBody + jointNoteFor(loggedInUser?.name || 'your colleague'),
          agents: Array.isArray(agents) ? agents : [],
        });
      } catch {
        // non-fatal
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
