import { createHmac, timingSafeEqual } from 'node:crypto';
import { buildMeetingSystemPrompt } from '../lib/meetingPersonas.js';

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
  const match = toAddresses.map(String).find(addr => /meetingroom\+[0-9a-f-]+@uqconsulting\.org/i.test(addr));
  const conversationId = match && match.match(/meetingroom\+([0-9a-f-]+)@uqconsulting\.org/i)?.[1];

  if (!conversationId) {
    res.status(200).json({ ok: true }); // not a Meeting Room reply — ignore
    return;
  }

  try {
    const getResp = await fetch(`${kvUrl}/get/mrconv:${conversationId}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const getData = await getResp.json();
    if (!getData?.result) {
      res.status(200).json({ ok: true }); // conversation expired or unknown — silently ignore
      return;
    }

    const conversation = JSON.parse(getData.result);
    const replyText = extractNewReplyText(data.text || '');
    if (!replyText) {
      res.status(200).json({ ok: true });
      return;
    }

    const history = [...conversation.history, { role: 'user', content: replyText }];
    const system = buildMeetingSystemPrompt(conversation.agents) + `

IMPORTANT — this session is a continuation of an earlier completed Meeting Room conversation, resumed via the user replying to their summary email. The full prior discussion is in the message history below; the user has already introduced themselves and the panel has already greeted them. Do NOT re-greet, do NOT re-ask for their name, and do NOT treat this as a fresh session — just pick the discussion back up naturally and respond directly to their new message.`;

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
      res.status(200).json({ ok: true });
      return;
    }

    const replyContent = upstreamData?.content?.[0]?.text || '';
    history.push({ role: 'assistant', content: replyContent });

    const updatedRecord = JSON.stringify({ email: conversation.email, agents: conversation.agents, history });
    await fetch(`${kvUrl}/set/mrconv:${conversationId}/${encodeURIComponent(updatedRecord)}/EX/2592000`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Meeting Room <meetingroom@uqconsulting.org>',
        to: [conversation.email],
        reply_to: `meetingroom+${conversationId}@uqconsulting.org`,
        subject: 'Re: Your Meeting Room Consultation Summary',
        html: replyContent.replace(/\n/g, '<br>'),
        headers: data.message_id ? { 'In-Reply-To': data.message_id, References: data.message_id } : undefined,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: true }); // webhook must ack 200 or Resend will retry indefinitely
  }
}
