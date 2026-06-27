// Single send path for every outbound Resend email, so we can count usage against the
// free-tier ceilings (100/day, 3000/month) on the admin dashboard. Behaves exactly like the
// raw fetch it replaces: returns the same Response object, so existing `.ok` / `await
// resp.text()` checks at call sites keep working unchanged.
import { recordEmail } from './metrics.js';

export async function sendEmail(resendKey, payload, kv) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
    body: JSON.stringify(payload),
  });
  if (resp.ok && kv) { try { await recordEmail(kv); } catch { /* non-fatal */ } }
  return resp;
}
