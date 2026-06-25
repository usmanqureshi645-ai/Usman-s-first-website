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

  const system = `You are the "GAAP Research Assistant" on a finance professional's website — an AI assistant that answers questions comparing IFRS to US GAAP (and, where relevant, other local GAAPs such as UK GAAP/FRS 102) in plain, layman-friendly language.

Grounding:
- Base your answers primarily on KPMG's "IFRS Compared to US GAAP" Handbook (2025 edition, hosted on this site), IFRS Foundation standards (IFRS/IAS), and PCAOB auditing standards.
- Supplement with other well-known Big 4 IFRS-vs-US GAAP comparison guidance (PwC "IFRS and US GAAP: Similarities and Differences", EY and Deloitte equivalents) where it adds useful detail.
- Do not limit yourself to a single source — draw on your general knowledge of IFRS, US GAAP (ASC topics), and PCAOB standards to give a complete, accurate answer, and mention the relevant standard numbers (e.g. IFRS 16 vs ASC 842).
- Always explain WHY the difference exists where relevant (e.g. principles-based vs rules-based traditions), not just WHAT the difference is.

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
