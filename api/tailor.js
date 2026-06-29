import { logAndCheckUsage } from '../lib/ipUsage.js';
import { getUserFromRequest } from '../lib/auth.js';

// Fetch a company web page and reduce it to plain text we can feed the model.
// Best-effort only: a failure or timeout just means we fall back to model knowledge.
async function fetchCompanyText(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; UQConsultingBot/1.0)' },
    });
    clearTimeout(timer);
    if (!resp.ok) return '';
    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 6000);
  } catch {
    return '';
  }
}

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

  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Sign up free to write a tailored cover letter' }); return; }

  const { cv, jobDescription, companyName, companyUrl, existingCoverLetter } = req.body || {};
  if (!cv || !jobDescription) {
    res.status(400).json({ error: 'Missing CV or job description text' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'tailor');
  if (usage.limited) { res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' }); return; }

  let companyText = '';
  if (companyUrl && /^https?:\/\//i.test(companyUrl)) {
    companyText = await fetchCompanyText(companyUrl);
  }

  const system = `You are writing one cover letter for a candidate applying to a specific role. Write it as a real, experienced professional would, not as an AI. It must be genuinely specific to this company and this role, and the motivation for wanting to work there must feel real and grounded in something true about the firm.

Hard rules on language:
- Write in plain, natural British business English.
- Do NOT use em dashes or en dashes (— or –). Use commas, full stops or brackets.
- Do NOT use generic AI filler such as "I am excited to", "passionate about", "in today's fast-paced world", "leverage", "delve into", "tapestry", "robust", "seamless", "navigate the landscape", "I am writing to express my interest". Open in a way a thoughtful human actually would.
- Vary sentence length. Mix short, direct sentences with longer ones so it does not read like a template.
- Reference 2 to 3 genuinely relevant achievements drawn ONLY from the candidate's CV. Never invent employers, qualifications, metrics or skills they did not provide.
- Keep it under 350 words. No markdown, no bullet points, just clean paragraphs with a greeting and a sign off.

${companyText ? `Here is text scraped from the company's own website. Use it to ground the motivation in something specific and true about them (their values, work, sectors, recent activity). Do not quote it verbatim or stuff it in; weave one or two genuine points in naturally:\n\n${companyText}` : 'No company website was provided, so draw on what you reliably know about the named company and the job description. If you are not sure about a specific fact, keep the motivation grounded in the role and sector rather than inventing claims about the firm.'}

Respond with ONLY the cover letter text, nothing else.`;

  const userMessage = `CANDIDATE CV:\n${cv}\n\n---\n\n${companyName ? `COMPANY: ${companyName}\n\n---\n\n` : ''}${existingCoverLetter ? `THEIR EXISTING COVER LETTER (improve on it, keep what works):\n${existingCoverLetter}\n\n---\n\n` : ''}JOB POSTING:\n${jobDescription}`;

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

    const coverLetter = (data?.content?.[0]?.text || '').trim();
    res.status(200).json({ coverLetter, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
