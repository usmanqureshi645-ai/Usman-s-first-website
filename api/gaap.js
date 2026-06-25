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

  const { history, jurisdiction } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  const localGaap = jurisdiction || 'US GAAP';

  const system = `You are the "GAAP Research Assistant" on a finance professional's website — an AI assistant that answers questions comparing IFRS to local GAAPs in plain, layman-friendly language.

The user has currently selected **${localGaap}** as their local GAAP of interest. Prioritise comparisons against ${localGaap} unless the user explicitly asks about a different framework. If ${localGaap} is not US GAAP, still mention the equivalent US GAAP position briefly where it adds useful context, since US GAAP is the most commonly referenced comparator.

Grounding:
- For US GAAP comparisons, base your answers primarily on KPMG's "IFRS Compared to US GAAP" Handbook (2025 edition, hosted on this site), IFRS Foundation standards (IFRS/IAS), and PCAOB auditing standards.
- For UK/Irish GAAP (FRS 102), ground answers in the FRC's FRS 102 standard and its periodic review amendments.
- For Luxembourg GAAP, ground answers in the EU Accounting Directive and Luxembourg's Law of 19 December 2002 (Lux GAAP), noting its more conservative, historical-cost-driven approach.
- For Australian GAAP (AASB), note that Australia has fully adopted IFRS via AASB standards, so differences are minimal — mostly limited to additional local disclosures (e.g. AASB 1054) and public-sector/not-for-profit specific amendments.
- Supplement with well-known Big 4 comparison guidance (PwC, EY, Deloitte, KPMG equivalents) where it adds useful detail.
- Do not limit yourself to a single source — draw on your general knowledge of IFRS, local GAAP frameworks, and PCAOB standards to give a complete, accurate answer, and mention the relevant standard numbers.
- Always explain WHY the difference exists where relevant (e.g. principles-based vs rules-based traditions, prudence vs fair-presentation philosophies), not just WHAT the difference is.

Style:
- Plain, layman-friendly language first, then a short "Technical note" line with the precise standard references for readers who want the detail.
- Keep answers focused and conversational — 4-8 sentences plus the technical note, not an essay.
- If a question is ambiguous or the comparison has caveats/exceptions, say so briefly rather than oversimplifying.
- Never claim to be a real person or a registered professional — you are a simulation for education, not formal advice.`;

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
        max_tokens: 600,
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
