import { randomUUID } from 'node:crypto';
import { getUserFromRequest } from '../lib/auth.js';
import { saveConsultation, scheduleFollowup } from '../lib/consultations.js';
import { sendEmail } from '../lib/email.js';
import { isMeaningfulSession, logFeatureUse } from '../lib/featureLog.js';

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

  const { email, transcript, resumed } = req.body || {};
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

    let htmlBody = summaryData?.content?.[0]?.text || '<p>No feedback available.</p>';

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
        htmlBody += `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;color:#555">Have another question, or want to keep practising? Just reply to this email.</p>`;
      } catch {
        // non-fatal — feedback email still sends without reply capability
      }
    }

    const emailResp = await sendEmail(resendKey, {
        from: 'Interview Prep Coach <coach@uqconsulting.org>',
        to: [email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: 'Your Interview Prep Feedback — Great Work!',
        html: htmlBody,
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
        if (replyTo) {
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
