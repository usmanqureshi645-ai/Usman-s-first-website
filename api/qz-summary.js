import { randomUUID } from 'node:crypto';
import { getUserFromRequest } from '../lib/auth.js';
import { saveConsultation, scheduleFollowup } from '../lib/consultations.js';
import { sendEmail } from '../lib/email.js';
import { isMeaningfulSession, logFeatureUse } from '../lib/featureLog.js';
import { buildConsultationMemoDocx } from '../lib/consultationMemo.js';

const CONVERSATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const SHARED_RULES = `You write warm, encouraging, kind feedback on behalf of an "Interview Prep Coach" feature on a personal website. You are given a transcript of an interview-prep conversation between the coach and a candidate practising for a real job interview.

Your feedback must be:
- KIND and FLATTERING in tone throughout — never brutal, never harsh, never disappointing. The goal is to make the candidate feel good about practising and motivated to keep improving, never discouraged.
- SPECIFIC to this exact candidate and their actual answers in the transcript — never generic advice. Quote or reference specific things they said.
- Genuinely useful and constructive, just delivered softly — frame every development point as "something to sharpen further" or "an easy win" rather than a flaw.
Never use harsh words like "weak", "bad", "failed", "poor". Use "developing", "an opportunity", "worth strengthening" instead.

Cover, in this order: an opening thank-you and congratulations on taking prep seriously; how they came across (energy, confidence, tone — specific, referencing actual phrasing); what they did well (at least 3 specific genuine strengths); a few things to sharpen (2-4 softly-framed development points — clarity, use of specific examples/metrics via the STAR method, technical accuracy, confidence signals); and a warm, motivating final encouragement.`;

const SYSTEM_EMAIL = `${SHARED_RULES}

OUTPUT FORMAT: respond with ONLY the raw HTML email body (simple inline-styled HTML: <h2>, <p>, <ul>, <li>, no external CSS), starting directly with the opening <p>. No markdown fences, no preamble.`;

const SYSTEM_MEMO = `${SHARED_RULES}

OUTPUT FORMAT — this is critical: respond with ONLY valid JSON (no markdown fences, no commentary), in this exact shape:
{
  "title": "Interview Preparation Feedback Report",
  "sections": [
    { "heading": "<one of: How You Came Across / What You Did Well / A Few Things to Sharpen / Final Encouragement>", "bodyHtml": "<simple HTML: <p>, <ul>, <li>, <strong> only>" }
  ],
  "relevantResources": { "technicalStandards": [], "uqResources": [] }
}`;

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

function renderReportJsonToHtml(report) {
  const esc = s => String(s ?? '');
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  let html = `<h2>${esc(report?.title || 'Interview Preparation Feedback Report')}</h2>`;
  for (const s of sections) {
    if (!s?.heading) continue;
    html += `<h3>${esc(s.heading)}</h3>${s.bodyHtml || ''}`;
  }
  return html;
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

  const { email, transcript, resumed, format } = req.body || {};
  if (!email || !Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: 'Missing email or transcript' });
    return;
  }
  const wantsMemo = format === 'memo';

  const conversationText = transcript
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Candidate' : 'Coach'}: ${m.content}`)
    .join('\n\n');

  const system = wantsMemo ? SYSTEM_MEMO : SYSTEM_EMAIL;

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
        max_tokens: 2500,
        system,
        messages: [{ role: 'user', content: `Interview prep transcript:\n\n${conversationText}` }],
      }),
    });

    const summaryData = await summaryResp.json();
    if (!summaryResp.ok) {
      res.status(summaryResp.status).json({ error: summaryData?.error?.message || 'Summary generation failed' });
      return;
    }
    const rawText = summaryData?.content?.[0]?.text || '';

    // Persist the conversation so a reply to this email can resume coaching (mirrors Meeting Room)
    let replyTo;
    if (kvUrl && kvToken) {
      const conversationId = randomUUID();
      const record = JSON.stringify({ email, history: transcript });
      try {
        await fetch(`${kvUrl}/set/qzconv:${conversationId}/${encodeURIComponent(record)}/EX/${CONVERSATION_TTL_SECONDS}`, {
          headers: { authorization: `Bearer ${kvToken}` },
        });
        replyTo = `quiz+${conversationId}@uqconsulting.org`;
      } catch {
        // non-fatal — feedback email still sends without reply capability
      }
    }

    let htmlBody, attachments;
    if (wantsMemo) {
      const report = parseJsonReport(rawText);
      if (!report) { res.status(500).json({ error: 'Report generation failed — please try again' }); return; }
      htmlBody = renderReportJsonToHtml(report);
      const docxBuffer = await buildConsultationMemoDocx({ ...report, recipientName: email });
      attachments = [{ filename: 'Interview-Feedback-Memo.docx', content: docxBuffer.toString('base64') }];
    } else {
      htmlBody = rawText || '<p>No feedback available.</p>';
      if (replyTo) htmlBody += `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;color:#555">Have another question, or want to keep practising? Just reply to this email.</p>`;
    }

    const emailResp = await sendEmail(resendKey, {
        from: 'Interview Prep Coach <coach@uqconsulting.org>',
        to: [email],
        ...(replyTo && !wantsMemo ? { reply_to: replyTo } : {}),
        subject: wantsMemo ? 'Your Interview Prep Feedback Memo — Great Work!' : 'Your Interview Prep Feedback — Great Work!',
        html: wantsMemo ? `<p>Please find your feedback report attached.</p>` : htmlBody,
        ...(attachments ? { attachments } : {}),
    }, { kvUrl, kvToken });

    const emailData = await emailResp.json();
    if (!emailResp.ok) {
      res.status(emailResp.status).json({ error: emailData?.message || 'Email send failed' });
      return;
    }

    const loggedInUser = getUserFromRequest(req);

    // Genuine-completion logging for the weekly Excel export (Part 2 of the requirements doc).
    if (kvUrl && kvToken && isMeaningfulSession(transcript, { tool: 'quiz' })) {
      await logFeatureUse({ kvUrl, kvToken }, {
        tool: 'quiz',
        email: loggedInUser?.email || email,
        detail: { resumed: !!resumed },
      });
      if (resumed) {
        await logFeatureUse({ kvUrl, kvToken }, { tool: 'resume-session', email: loggedInUser?.email || email, detail: { originalTool: 'quiz' } });
      }
    }

    if (loggedInUser && kvUrl && kvToken) {
      try {
        const firstUserMsg = transcript.find(m => m.role === 'user')?.content || 'Interview prep session';
        const consultationId = await saveConsultation({
          kvUrl, kvToken,
          email: loggedInUser.email,
          tool: 'quiz',
          title: firstUserMsg.slice(0, 80),
          transcript,
          summaryHtml: htmlBody,
        });
        if (replyTo && !wantsMemo) {
          await scheduleFollowup({
            kvUrl, kvToken,
            email: loggedInUser.email,
            name: loggedInUser.name,
            tool: 'quiz',
            consultationId,
            replyTo,
          });
        }
      } catch {
        // non-fatal — the feedback email already sent successfully
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
