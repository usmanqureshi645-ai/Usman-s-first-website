const TOOL_LABELS = {
  meeting: 'Meeting Room consultation',
  quiz: 'Interview Prep session',
};

const SIGNUP_LINE = 'If you haven\'t already, signing up is free and unlocks your personal workspace — every consultation saved, and you can resume any conversation right where you left off. It stays free after signing up too.';

export default async function handler(req, res) {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!kvUrl || !kvToken || !resendKey) {
    res.status(200).json({ ok: true, processed: 0 });
    return;
  }

  try {
    const now = Date.now();
    const dueResp = await fetch(`${kvUrl}/zrangebyscore/followups_zset/-inf/${now}`, {
      headers: { authorization: `Bearer ${kvToken}` },
    });
    const dueData = await dueResp.json();
    const dueMembers = Array.isArray(dueData?.result) ? dueData.result : [];

    let processed = 0;
    for (const member of dueMembers) {
      let item;
      try {
        item = JSON.parse(member);
      } catch {
        await fetch(`${kvUrl}/zrem/followups_zset/${encodeURIComponent(member)}`, {
          headers: { authorization: `Bearer ${kvToken}` },
        });
        continue;
      }

      const toolLabel = TOOL_LABELS[item.tool] || 'session';
      const firstName = (item.name || '').split(' ')[0] || 'there';
      const html = `
        <p>Hi ${firstName},</p>
        <p>Just checking in — thanks again for using the ${toolLabel} yesterday. Hope it was helpful!</p>
        <p>If you've got any more questions or want to keep going, just reply to this email${item.replyTo ? ' and we\'ll pick the conversation back up' : ''}.</p>
        <p>${SIGNUP_LINE}</p>
        <p>Talk soon,<br>Usman</p>
      `;

      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: item.replyTo ? `${item.tool === 'quiz' ? 'Interview Prep Coach' : 'Meeting Room'} <${item.tool === 'quiz' ? 'coach' : 'meetingroom'}@uqconsulting.org>` : 'Usman Qureshi | Audit & Advisory <noreply@uqconsulting.org>',
          to: [item.email],
          ...(item.replyTo ? { reply_to: item.replyTo } : {}),
          subject: `Following up on your ${toolLabel}`,
          html,
        }),
      });
      if (!emailResp.ok) {
        console.error('[cron-followups] send failed for', item.email, await emailResp.text());
      }

      await fetch(`${kvUrl}/zrem/followups_zset/${encodeURIComponent(member)}`, {
        headers: { authorization: `Bearer ${kvToken}` },
      });
      processed++;
    }

    res.status(200).json({ ok: true, processed });
  } catch (err) {
    console.error('[cron-followups] unexpected error', err);
    res.status(500).json({ error: 'Request failed' });
  }
}
