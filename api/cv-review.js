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

  const { mode = 'score', cv, coverLetter, jobDescription, messages, text, kind } = req.body || {};

  const usage = await logAndCheckUsage(req, { kvUrl: process.env.UPSTASH_REDIS_REST_URL, kvToken: process.env.UPSTASH_REDIS_REST_TOKEN }, 'cv-review');

  try {
    if (mode === 'validate') {
      // Cheap gate so we never score the wrong kind of document (e.g. financial statements).
      if (!text || !String(text).trim()) { res.status(400).json({ error: 'No document text to check' }); return; }
      const wanted = kind === 'cover' ? 'a cover letter (a letter from a job applicant to an employer)' : 'a CV or resume (a personal career document listing one person\'s work history, education and skills)';
      const system = `You are a document classifier. Decide whether the supplied text is ${wanted}. It is NOT that if it is, for example, a set of financial statements, an annual report, a contract, an essay, an invoice, a policy, marketing material, or any other kind of document. Respond with ONLY valid JSON, no markdown: { "isValid": <true|false>, "detectedType": "<a short plain-English label for what the document actually is, e.g. 'a set of financial statements' or 'a CV'>" }`;
      const { ok, status, data } = await callClaude(apiKey, { system, messages: [{ role: 'user', content: String(text).slice(0, 8000) }], max_tokens: 200 });
      if (!ok) { res.status(status).json({ error: data?.error?.message || 'Upstream error' }); return; }
      let out = (data?.content?.[0]?.text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      let parsed;
      try { parsed = JSON.parse(out); } catch { const m = out.match(/\{[\s\S]*\}/); try { parsed = JSON.parse(m ? m[0] : '{}'); } catch { parsed = { isValid: true, detectedType: '' }; } }
      res.status(200).json({ isValid: parsed.isValid !== false, detectedType: parsed.detectedType || '', usage });
      return;
    }

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

      const system = `You are Eleanor Hughes, an experienced British recruitment and career specialist who has screened thousands of CVs for finance, audit and accounting roles. You are talking a candidate through their CV and cover letter after they have had a first round of scoring and made their own edits. You are warm, direct and genuinely on their side.

This is a two-way conversation, not a lecture. The candidate is allowed to disagree with you, and you actively want them to. When you make a point, invite their view on it. Ask plenty of questions to understand their real situation before you push a fix, because the right advice depends on their circumstances.

Crucially, take their constraints seriously and adapt. If you suggest something and they explain why they cannot do it, accept that and offer a different angle rather than repeating yourself. For example, if you suggest adding the annual revenue of a client and they say it is confidential, do not insist; suggest a broad range instead so a recruiter still gets a sense of scale. If they say even a range is not possible, respect that completely and move to a different way of showing impact, such as team size, deal count or the complexity of the work. Never push the same rejected suggestion again. The goal is to help them land on something they are comfortable with and that still strengthens the application.

Talk like a real person speaking to someone you want to help. Use short paragraphs with blank lines between ideas. Do not use markdown, headings, asterisks or bullet symbols. Do not write or rewrite the CV or cover letter for them; coach them so they make the edits themselves. Be encouraging but honest; never flatter weak work, and never be harsh.

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

    let rawText = data?.content?.[0]?.text || '{}';
    // The model sometimes wraps the JSON in ```json ... ``` fences; strip them,
    // and as a fallback grab the outermost { ... } block.
    rawText = rawText.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(rawText); }
    catch {
      const m = rawText.match(/\{[\s\S]*\}/);
      try { parsed = JSON.parse(m ? m[0] : rawText); }
      catch { parsed = { cv: null, coverLetter: null, raw: rawText }; }
    }

    res.status(200).json({ ...parsed, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
