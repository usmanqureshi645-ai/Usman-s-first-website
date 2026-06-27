// Single send path for every outbound Resend email, so we can count usage against the
// free-tier ceilings (100/day, 3000/month) on the admin dashboard. Behaves exactly like the
// raw fetch it replaces: returns the same Response object, so existing `.ok` / `await
// resp.text()` checks at call sites keep working unchanged.
import { recordEmail, claimEmailAlerts, LIMITS } from './metrics.js';

const OWNER_EMAIL = 'usmanqureshi645@gmail.com';

export async function sendEmail(resendKey, payload, kv) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
    body: JSON.stringify(payload),
  });
  if (resp.ok && kv) {
    try { await recordEmail(kv); } catch { /* non-fatal */ }
    try { await maybeAlertOwner(resendKey, kv); } catch { /* non-fatal */ }
  }
  return resp;
}

// Emails the owner once when Resend usage crosses 80% of a free-tier cap. Sent via raw fetch
// (not sendEmail) so it can't recurse into another alert check, and isn't itself counted.
async function maybeAlertOwner(resendKey, kv) {
  if (!resendKey) return;
  const a = await claimEmailAlerts(kv);
  if (!a.day && !a.month) return;

  const items = [];
  if (a.day) items.push(`<li><strong>Daily:</strong> ${a.todayCount} of ${LIMITS.emailPerDay} emails sent today (${Math.round(a.todayCount / LIMITS.emailPerDay * 100)}%).</li>`);
  if (a.month) items.push(`<li><strong>This month:</strong> ${a.monthCount} of ${LIMITS.emailPerMonth} emails sent (${Math.round(a.monthCount / LIMITS.emailPerMonth * 100)}%).</li>`);

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Site Alerts <noreply@uqconsulting.org>',
      to: [OWNER_EMAIL],
      subject: '⚠️ Website email usage has crossed 80% of the Resend free tier',
      html: `<p>Heads up — your website is approaching its Resend free-tier email limit:</p><ul>${items.join('')}</ul><p>Free tier is ${LIMITS.emailPerDay}/day and ${LIMITS.emailPerMonth}/month. If you hit the cap, outgoing emails (welcome notes, summaries, follow-ups) will start failing until it resets. See the admin dashboard for the live figure. You'll only get one alert per day and per month.</p>`,
    }),
  });
}
