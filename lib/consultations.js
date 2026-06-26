import { randomUUID } from 'node:crypto';

const MAX_CONSULTATIONS = 200;
const FOLLOWUP_DELAY_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function saveConsultation({ kvUrl, kvToken, email, tool, title, transcript, summaryHtml, agents }) {
  const record = {
    id: randomUUID(),
    tool,
    title,
    transcript,
    summaryHtml,
    ...(agents ? { agents } : {}),
    createdAt: new Date().toISOString(),
  };
  await fetch(`${kvUrl}/lpush/consultations:${email}/${encodeURIComponent(JSON.stringify(record))}`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
  await fetch(`${kvUrl}/ltrim/consultations:${email}/0/${MAX_CONSULTATIONS - 1}`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
  return record.id;
}

export async function scheduleFollowup({ kvUrl, kvToken, email, name, tool, consultationId, replyTo }) {
  const member = JSON.stringify({ email, name, tool, consultationId, replyTo });
  const dueAt = Date.now() + FOLLOWUP_DELAY_MS;
  await fetch(`${kvUrl}/zadd/followups_zset/${dueAt}/${encodeURIComponent(member)}`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
}
