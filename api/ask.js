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

  const { history, userName } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: 'Missing conversation history' });
    return;
  }

  const system = `You are a helpful, general-purpose AI assistant embedded on a personal/professional website (a personal "ChatGPT-style" assistant for whoever is visiting${userName ? `, currently chatting with ${userName}` : ''}). Answer any question helpfully, clearly and concisely, on any topic — not limited to finance or accounting, though the site owner is a Big 4 audit/advisory professional so finance questions are especially welcome.

Style:
- Be direct and helpful, like a knowledgeable friend, not overly formal.
- Use markdown formatting (headings, bold, lists) where it genuinely helps clarity.
- Keep responses reasonably concise unless the question calls for depth.
- If asked who you are, explain you're a general-purpose AI assistant on this website, separate from the site's specialised tools (Meeting Room, GAAP Compare, Knowledge Test).`;

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
        max_tokens: 1000,
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
