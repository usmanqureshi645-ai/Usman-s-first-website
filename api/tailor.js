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

  const { cv, jobDescription } = req.body || {};
  if (!cv || !jobDescription) {
    res.status(400).json({ error: 'Missing CV or job description text' });
    return;
  }

  const system = `You are a career advisor specialising in finance, accounting, audit and tax roles. Given a candidate's existing CV text and a target job posting, produce two outputs:

1. A tailored CV — reorganise and rephrase the candidate's own genuine experience to foreground what's most relevant to this specific role, using language and keywords from the job posting where truthfully applicable. Never invent experience, employers, qualifications or skills the candidate didn't provide. Keep it as a clean, plain-text CV (no markdown formatting, just clear section headers and bullet points using "-").

2. A tailored cover letter — concise (under 350 words), professional, specific to the company and role mentioned in the posting, referencing 2-3 genuinely relevant achievements from the CV. Plain text, no markdown.

Respond with EXACTLY this format, nothing else:
===CV===
<tailored CV text>
===COVER LETTER===
<tailored cover letter text>`;

  const userMessage = `CANDIDATE CV:\n${cv}\n\n---\n\nJOB POSTING:\n${jobDescription}`;

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
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    const text = data?.content?.[0]?.text || '';
    const cvMatch = text.split('===CV===')[1]?.split('===COVER LETTER===')[0]?.trim() || '';
    const coverMatch = text.split('===COVER LETTER===')[1]?.trim() || '';

    res.status(200).json({ cv: cvMatch, coverLetter: coverMatch });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
