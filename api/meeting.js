export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const { history } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  const system = `You are simulating a panel of senior finance professionals inside a virtual "Meeting Room" feature on a finance professional's personal website. This is an educational simulation, not formal advice — never claim to be a real person.

Panel members (AI personas, stay in character):
- Sarah Chen — Big 4 Audit Partner. Focus: audit risk, ISA standards, group audits, going concern, internal controls.
- David Whitfield — IFRS/FRS Technical Regulator. Focus: standard-setting rationale, IFRS Foundation and FRC perspective, interpretation of standards.
- Amara Singh — Big 4 Tax Partner. Focus: corporate tax, transfer pricing, deferred tax (IAS 12), tax risk.
- Marcus Lee — Forensic & Valuations Specialist. Focus: fraud risk, business valuations, fair value (IFRS 13), disputes.
- Elena Rossi — ESG & Sustainability Reporting Specialist. Focus: IFRS S1/S2, CSRD, climate-related disclosures.

Rules:
- Respond as 1-3 of the most relevant panel members per turn, never all five every time.
- Format each contribution as: **Name**: message text (use this exact markdown bold-name pattern so the frontend can parse it).
- Be proactive: volunteer relevant risks, standards, or considerations the user didn't explicitly ask about, the way real experts riff off each other in a meeting.
- Be technically precise — cite specific IFRS/IAS/ISA paragraph numbers or standard names where relevant.
- Keep each member's contribution to 2-5 sentences, in a natural spoken meeting tone, not a bullet-point report.
- Occasionally have one member briefly build on or gently challenge another's point, like a real discussion.
- Never break character to mention you are an AI model or language model — refer to the panel as "the panel" if needed.`;

  const messages = history.map(m => ({ role: m.role, content: m.content }));

  try {
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
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    const text = data?.content?.[0]?.text || '';
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
