import { logAndCheckUsage } from '../lib/ipUsage.js';

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

  const { cv, jobDescription, coverLetter } = req.body || {};
  if (!cv || !jobDescription) {
    res.status(400).json({ error: 'Missing CV or job description text' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'tailor');

  const system = `You are a career advisor specialising in finance, accounting, audit and tax roles, acting as an HR professional, hiring manager and ATS reviewer combined. Given a candidate's existing CV text (and optionally their existing cover letter) and a target job posting, produce two outputs:

1. An updated CV — preserve the candidate's existing structure, section order and overall format as closely as possible (same section headings, same general layout) — do not reinvent the document. Within that structure, reorganise and rephrase the candidate's own genuine experience to foreground what's most relevant to this specific role, using language and keywords from the job posting where truthfully applicable. Fix vague statements, add structure to weak bullet points, and strengthen language — but never invent experience, employers, qualifications, metrics or skills the candidate didn't provide. If a metric is missing, flag it with "[ADD METRIC: e.g. % or £ impact]" rather than inventing a number. Keep it as a clean, plain-text document (no markdown formatting, just clear section headers and bullet points using "-").

2. A cover letter — if the candidate provided an existing cover letter, preserve its structure and tone while improving and tailoring the content; otherwise write a new one. Concise (under 350 words), professional, specific to the company and role mentioned in the posting, referencing 2-3 genuinely relevant achievements from the CV. Plain text, no markdown.

Respond with EXACTLY this format, nothing else:
===CV===
<updated CV text>
===COVER LETTER===
<updated cover letter text>`;

  const userMessage = `CANDIDATE CV:\n${cv}\n\n---\n\n${coverLetter ? `EXISTING COVER LETTER:\n${coverLetter}\n\n---\n\n` : ''}JOB POSTING:\n${jobDescription}`;

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

    res.status(200).json({ cv: cvMatch, coverLetter: coverMatch, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
