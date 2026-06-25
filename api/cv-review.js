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

  const system = `Act as a skeptical recruiter and ATS reviewer. You are reviewing a candidate's CV against a specific job description. Be brutally honest. Tell them the top 5 reasons they may not be getting interviews. Identify weak achievements, missing metrics, missing keywords, vague statements, and anything a recruiter would miss during a 6-second scan.

Respond with ONLY valid JSON, no markdown fencing, in this exact shape:
{
  "score": <integer 0-100, an honest ATS + recruiter-appeal score>,
  "review": "<markdown-formatted review using ## headings and bullet points, covering: an honest one-line verdict, then 'Top 5 Reasons You May Not Be Getting Interviews' as a numbered list with specific quotes/examples from THIS cv, then 'Missing Keywords for This Role' listing exact terms from the job description not present in the CV, then a brief closing note on whether the candidate is a strong/moderate/weak match for this specific role>"
}

Be specific and reference actual content from the CV provided — never generic advice. Quote weak phrases directly and explain exactly why they're weak (e.g. no metric, passive voice, buzzword with no evidence).`;

  const userMessage = `CANDIDATE CV:\n${cv}\n\n---\n\nJOB DESCRIPTION:\n${jobDescription}`;

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
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    const text = data?.content?.[0]?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { score: null, review: text };
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
