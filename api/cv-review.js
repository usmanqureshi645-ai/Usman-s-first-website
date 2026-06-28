import { logAndCheckUsage } from '../lib/ipUsage.js';

// Shared language rules so neither the scoring nor the chat sounds like generic AI.
const HUMAN_LANGUAGE_RULES = `Write in plain, natural British business English. Do not use em dashes or en dashes (— or –); use commas, full stops or brackets instead. Avoid generic AI filler such as "I am excited to", "passionate about", "in today's fast-paced world", "leverage", "delve", "tapestry", "robust", "seamless", "navigate the landscape". Vary your sentence length so it reads like a real person wrote it. Be concrete and specific, never vague.`;

async function callClaude(apiKey, { system, messages, max_tokens }) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens, system, messages }),
  });
  const data = await upstream.json();
  return { ok: upstream.ok, status: upstream.status, data };
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

  const { mode = 'score', cv, coverLetter, jobDescription, messages } = req.body || {};

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'cv-review');

  try {
    if (mode === 'chat') {
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Missing chat messages' });
        return;
      }
      const context = [
        cv ? `THE CANDIDATE'S CURRENT CV:\n${cv}` : '',
        coverLetter ? `THE CANDIDATE'S CURRENT COVER LETTER:\n${coverLetter}` : '',
        jobDescription ? `THE TARGET JOB:\n${jobDescription}` : '',
      ].filter(Boolean).join('\n\n---\n\n');

      const system = `You are a sharp, honest recruiter and hiring manager helping a candidate improve their CV and cover letter through back-and-forth conversation. They have already had a first round of scoring and have now made their own edits. Your job is to read what they have changed, tell them honestly whether it is better or worse, and what to fix next.

Talk like a real person speaking to a colleague. Use short paragraphs and blank lines between ideas. Do not use markdown, headings, asterisks or bullet symbols. Do not generate a rewritten CV or cover letter for them; coach them to make the edits themselves. Stay encouraging but never flatter weak work.

${HUMAN_LANGUAGE_RULES}

${context ? `For reference, here is the material they are working on:\n\n${context}` : ''}`;

      const cleanMessages = messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content }));

      const { ok, status, data } = await callClaude(apiKey, { system, messages: cleanMessages, max_tokens: 1200 });
      if (!ok) { res.status(status).json({ error: data?.error?.message || 'Upstream error' }); return; }
      const reply = data?.content?.[0]?.text || '';
      res.status(200).json({ reply, usage });
      return;
    }

    // mode === 'score'
    if (!cv || !jobDescription) {
      res.status(400).json({ error: 'Missing CV or job description text' });
      return;
    }

    const system = `Act as three reviewers assessing a candidate against a specific job description: an HR screener, an applicant tracking system (ATS), and the hiring manager. Be brutally honest. Score from each of the three perspectives out of 100, and for each weakness pair a direct criticism with a concrete, specific suggestion the candidate can act on themselves.

${HUMAN_LANGUAGE_RULES}

Respond with ONLY valid JSON, no markdown fencing, in this exact shape:
{
  "cv": {
    "hr": <integer 0-100>,
    "ats": <integer 0-100>,
    "hiringManager": <integer 0-100>,
    "items": [
      { "criticism": "<a specific weakness, quoting the actual CV text where possible>", "suggestion": "<exactly what to change and how>" }
    ]
  },
  "coverLetter": <null if no cover letter was supplied, otherwise an object with the same shape: { "hr", "ats", "hiringManager", "items": [...] }>
}

Give between 5 and 8 items for the CV. The HR score reflects screening appeal and clarity, ATS reflects keyword and formatting match to the job, hiringManager reflects whether this person looks genuinely capable of the role. Quote real phrases from the documents in your criticisms and explain why each is weak (no metric, vague, buzzword without evidence, missing keyword). Never invent content the candidate did not provide.`;

    const userMessage = `CANDIDATE CV:\n${cv}\n\n---\n\n${coverLetter ? `CANDIDATE COVER LETTER:\n${coverLetter}\n\n---\n\n` : ''}JOB DESCRIPTION:\n${jobDescription}`;

    const { ok, status, data } = await callClaude(apiKey, { system, messages: [{ role: 'user', content: userMessage }], max_tokens: 2500 });
    if (!ok) { res.status(status).json({ error: data?.error?.message || 'Upstream error' }); return; }

    let text = data?.content?.[0]?.text || '{}';
    // The model sometimes wraps the JSON in ```json ... ``` fences; strip them,
    // and as a fallback grab the outermost { ... } block.
    text = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      try { parsed = JSON.parse(m ? m[0] : text); }
      catch { parsed = { cv: null, coverLetter: null, raw: text }; }
    }

    res.status(200).json({ ...parsed, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
