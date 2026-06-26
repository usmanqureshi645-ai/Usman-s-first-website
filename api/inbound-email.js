import { createHmac, timingSafeEqual } from 'node:crypto';
import { buildMeetingSystemPrompt } from '../lib/meetingPersonas.js';
import { buildQuizSystemPrompt } from '../lib/quizCoach.js';

const SIGNUP_NUDGE = 'Want the full experience — saved history, resuming any conversation anytime, and a personal workspace? Sign up free at https://usman-s-first-website.vercel.app (it stays free after signing up too).';

const MODES = {
  meetingroom: {
    kvPrefix: 'mrconv',
    fromHeader: 'Meeting Room <meetingroom@uqconsulting.org>',
    replyAddr: id => `meetingroom+${id}@uqconsulting.org`,
    subject: 'Re: Your Meeting Room Consultation Summary',
    ownerSubject: email => `Meeting Room follow-up from ${email}`,
    buildSystem: conversation => buildMeetingSystemPrompt(conversation.agents) + `

IMPORTANT — this session is a continuation of an earlier completed Meeting Room conversation, resumed via the user replying to their summary email. The full prior discussion is in the message history below; the user has already introduced themselves and the panel has already greeted them. Do NOT re-greet, do NOT re-ask for their name, and do NOT treat this as a fresh session — just pick the discussion back up naturally and respond directly to their new message.

IMPORTANT — this response will be sent as a plain email reply, not rendered in the chat UI, so the usual markdown formatting must NOT be used here. Specifically: do not use ** for bold, do not use # headings, do not use > blockquotes, and do not use markdown link syntax like [text](url). Write each panel member's contribution as their plain name followed by a colon (e.g. "Sarah Chen: ..."), in plain prose, exactly as it would read in a normal email someone typed by hand. If you reference a source, write the organisation/standard name in prose and put the full URL in plain parentheses, e.g. "(see ifrs.org/issued-standards/list-of-standards/ifrs-16-leases)".

IMPORTANT — end your reply with this exact line on its own paragraph: "${SIGNUP_NUDGE}"`,
    buildRecord: (conversation, history) => JSON.stringify({ email: conversation.email, agents: conversation.agents, history }),
  },
  quiz: {
    kvPrefix: 'qzconv',
    fromHeader: 'Interview Prep Coach <coach@uqconsulting.org>',
    replyAddr: id => `quiz+${id}@uqconsulting.org`,
    subject: 'Re: Your Interview Prep Feedback',
    ownerSubject: email => `Interview Coach follow-up from ${email}`,
    buildSystem: () => buildQuizSystemPrompt() + `

IMPORTANT — this session is a continuation of an earlier interview-prep conversation, resumed via the user replying to their feedback email. The full prior discussion is in the message history below; do NOT re-introduce yourself or re-ask their role/experience — just pick the coaching back up naturally and respond directly to their new message.

IMPORTANT — this response will be sent as a plain email reply, not rendered in the chat UI, so the usual markdown formatting must NOT be used here: do not use ** for bold, do not use # headings, do not use markdown link syntax. Write in plain prose exactly as it would read in a normal email someone typed by hand.

IMPORTANT — end your reply with this exact line on its own paragraph: "${SIGNUP_NUDGE}"`,
    buildRecord: (conversation, history) => JSON.stringify({ email: conversation.email, history }),
  },
};

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Verifies Resend's Svix-style webhook signature when RESEND_WEBHOOK_SECRET is configured
function isValidSignature(req, rawBody, secret) {
  if (!secret) return true; // signing not yet configured — accept (conversation IDs are UUIDs, low abuse risk)
  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  return svixSignature.split(' ').some(part => {
    const sig = part.split(',')[1];
    if (!sig) return false;
    try {
      return timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(expected, 'base64'));
    } catch {
      return false;
    }
  });
}

// Strips common quoted-reply trailers ("On ... wrote:", "-----Original Message-----") so only the new reply text is used
function extractNewReplyText(text) {
  if (!text) return '';
  const cutMarkers = [/\nOn .+ wrote:\n/i, /\n-{2,}\s*Original Message\s*-{2,}/i, /\n_{5,}\n/];
  let body = text;
  for (const marker of cutMarkers) {
    const match = body.match(marker);
    if (match) body = body.slice(0, match.index);
  }
  return body.trim();
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
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  const rawBody = await readRawBody(req);

  if (!isValidSignature(req, rawBody, webhookSecret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  if (payload.type !== 'email.received' || !apiKey || !kvUrl || !kvToken || !resendKey) {
    res.status(200).json({ ok: true }); // acknowledge and ignore — nothing actionable
    return;
  }

  const data = payload.data || {};
  const toAddresses = Array.isArray(data.to) ? data.to : [data.to].filter(Boolean);

  let modeKey, conversationId;
  for (const addr of toAddresses.map(String)) {
    const meetingMatch = addr.match(/meetingroom\+([0-9a-f-]+)@uqconsulting\.org/i);
    const quizMatch = addr.match(/quiz\+([0-9a-f-]+)@uqconsulting\.org/i);
    if (meetingMatch) { modeKey = 'meetingroom'; conversationId = meetingMatch[1]; break; }
    if (quizMatch) { modeKey = 'quiz'; conversationId = quizMatch[1]; break; }
  }
  const mode = modeKey && MODES[modeKey];

  if (!mode) {
    // Not a Meeting Room continuation thread (e.g. a reply to the Interview Coach or
    // GAAP Compare sender address) — these have no conversation state to resume, so
    // just forward the raw reply to the owner instead of silently dropping it.
    try {
      let bodyText = '';
      if (data.email_id && resendKey) {
        const emailResp = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
          headers: { authorization: `Bearer ${resendKey}` },
        });
        if (emailResp.ok) {
          const emailData = await emailResp.json();
          bodyText = emailData.text || (emailData.html ? emailData.html.replace(/<[^>]+>/g, ' ') : '') || '';
        }
      }
      const replyText = extractNewReplyText(bodyText) || '(no readable body)';
      const fromAddr = Array.isArray(data.from) ? data.from[0] : data.from;
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Website Replies <noreply@uqconsulting.org>',
            to: ['usmanqureshi645@gmail.com'],
            subject: `Reply received: ${data.subject || '(no subject)'} (from ${fromAddr || 'unknown'})`,
            html: `<p><strong>${fromAddr || 'Someone'}</strong> replied to <strong>${toAddresses.join(', ')}</strong>:</p>
<blockquote style="margin:0;padding-left:12px;border-left:3px solid #ccc;color:#333">${replyText.replace(/\n/g, '<br>')}</blockquote>`,
          }),
        });
      }
    } catch (err) {
      console.error('[inbound-email] fallback forward failed', err);
    }
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const getResp = await fetch(`${kvUrl}/get/${mode.kvPrefix}:${conversationId}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const getData = await getResp.json();
    if (!getData?.result) {
      console.error('[inbound-email] no conversation found for', conversationId);
      res.status(200).json({ ok: true }); // conversation expired or unknown — silently ignore
      return;
    }

    const conversation = JSON.parse(getData.result);

    // The webhook payload only carries metadata — the actual body must be fetched separately
    let bodyText = '';
    if (data.email_id) {
      const emailResp = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
        headers: { authorization: `Bearer ${resendKey}` },
      });
      if (emailResp.ok) {
        const emailData = await emailResp.json();
        bodyText = emailData.text || (emailData.html ? emailData.html.replace(/<[^>]+>/g, ' ') : '') || '';
      } else {
        console.error('[inbound-email] failed to fetch received email body', emailResp.status, await emailResp.text());
      }
    } else {
      console.error('[inbound-email] webhook payload had no email_id', JSON.stringify(data));
    }

    const replyText = extractNewReplyText(bodyText);
    if (!replyText) {
      console.error('[inbound-email] empty replyText after extraction, raw body was:', bodyText);
      res.status(200).json({ ok: true });
      return;
    }

    const history = [...conversation.history, { role: 'user', content: replyText }];
    const system = mode.buildSystem(conversation);

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system,
        messages: history.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const upstreamData = await upstream.json();
    if (!upstream.ok) {
      console.error('[inbound-email] Anthropic call failed', upstream.status, JSON.stringify(upstreamData));
      res.status(200).json({ ok: true });
      return;
    }

    const replyContent = upstreamData?.content?.[0]?.text || '';
    history.push({ role: 'assistant', content: replyContent });

    const updatedRecord = mode.buildRecord(conversation, history);
    await fetch(`${kvUrl}/set/${mode.kvPrefix}:${conversationId}/${encodeURIComponent(updatedRecord)}/EX/2592000`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });

    const replyToVisitor = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: mode.fromHeader,
        to: [conversation.email],
        reply_to: mode.replyAddr(conversationId),
        subject: mode.subject,
        html: replyContent.replace(/\n/g, '<br>'),
        headers: data.message_id ? { 'In-Reply-To': data.message_id, References: data.message_id } : undefined,
      }),
    });
    if (!replyToVisitor.ok) {
      console.error('[inbound-email] visitor reply send failed', replyToVisitor.status, await replyToVisitor.text());
    }

    // Notify the site owner of every visitor follow-up reply (not just the auto-reply sent back to the visitor)
    const notifyOwner = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: mode.fromHeader,
        to: ['usmanqureshi645@gmail.com'],
        subject: mode.ownerSubject(conversation.email),
        html: `<p><strong>${conversation.email}</strong> replied to their ${modeKey === 'quiz' ? 'Interview Prep feedback' : 'Meeting Room summary'}:</p>
<blockquote style="margin:0 0 16px;padding-left:12px;border-left:3px solid #ccc;color:#333">${replyText.replace(/\n/g, '<br>')}</blockquote>
<p><strong>Reply (already sent to them):</strong></p>
<blockquote style="margin:0;padding-left:12px;border-left:3px solid #C8A96E;color:#333">${replyContent.replace(/\n/g, '<br>')}</blockquote>`,
      }),
    });
    if (!notifyOwner.ok) {
      console.error('[inbound-email] owner notification send failed', notifyOwner.status, await notifyOwner.text());
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[inbound-email] unexpected error', err);
    res.status(200).json({ ok: true }); // webhook must ack 200 or Resend will retry indefinitely
  }
}
