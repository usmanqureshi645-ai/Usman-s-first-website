import { randomUUID } from 'node:crypto';

// Experimental feature: a live, two-person shared Meeting Room session, polled
// (not pushed) by both browsers every few seconds. Short TTL since it's only
// meant to live for the duration of one sitting, not a persistent record —
// the joint summary email + workspace save is what actually persists.
const SESSION_TTL_SECONDS = 6 * 60 * 60; // 6 hours

export async function createMeetingSession({ kvUrl, kvToken, hostEmail, hostName, agents }) {
  const session = {
    id: randomUUID(),
    hostEmail,
    hostName,
    agents: Array.isArray(agents) ? agents : [],
    history: [],
    invitee: null,
    ended: false,
    createdAt: new Date().toISOString(),
  };
  await saveMeetingSession({ kvUrl, kvToken, session });
  return session;
}

export async function getMeetingSession({ kvUrl, kvToken, id }) {
  const r = await fetch(`${kvUrl}/get/mrsession:${id}`, { headers: { authorization: `Bearer ${kvToken}` } });
  const data = await r.json();
  if (!data?.result) return null;
  try { return JSON.parse(data.result); } catch { return null; }
}

export async function saveMeetingSession({ kvUrl, kvToken, session }) {
  await fetch(`${kvUrl}/set/mrsession:${session.id}/${encodeURIComponent(JSON.stringify(session))}/EX/${SESSION_TTL_SECONDS}`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
}
