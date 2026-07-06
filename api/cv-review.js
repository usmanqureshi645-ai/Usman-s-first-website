import { logAndCheckUsage } from '../lib/ipUsage.js';
import { getUserFromRequest } from '../lib/auth.js';
import { logFeatureUse } from '../lib/featureLog.js';
import { synthesize } from '../lib/tts.js';

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

const MAX_TEXT_LENGTH = 100000; // ~25k tokens, safe limit per doc

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
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // mode:'validate' is a free, cheap pre-check called during file upload (before the
  // user has clicked "Score My CV") and stays ungated, consistent with letting
  // preparatory actions through; only the actual scoring/coaching modes require signup.
  const user = getUserFromRequest(req);
  if (mode !== 'validate' && !user) {
    res.status(401).json({ error: mode === 'chat' ? 'Sign up free to talk this through with Eleanor' : 'Sign up free to score your CV' });
    return;
  }

  // Enforce text-size limits to prevent token-bombing
  if (mode === 'validate' && text && typeof text === 'string' && text.length > MAX_TEXT_LENGTH) {
    res.status(413).json({ error: 'Document too large — please upload a file under ~25k words' });
    return;
  }
  if ((mode === 'score' || mode === 'chat') && cv && typeof cv === 'string' && cv.length > MAX_TEXT_LENGTH) {
    res.status(413).json({ error: 'CV too large — please provide a document under ~25k words' });
    return;
  }
  if ((mode === 'score' || mode === 'chat') && coverLetter && typeof coverLetter === 'string' && coverLetter.length > MAX_TEXT_LENGTH) {
    res.status(413).json({ error: 'Cover letter too large — please provide a document under ~25k words' });
    return;
  }
  if ((mode === 'score' || mode === 'chat') && jobDescription && typeof jobDescription === 'string' && jobDescription.length > MAX_TEXT_LENGTH) {
    res.status(413).json({ error: 'Job description too large — please provide under ~25k words' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl, kvToken }, 'cv-review');
  if (usage.limited) { res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' }); return; }

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
      const { priorScoring } = req.body || {};
      const context = [
        cv ? `THE CANDIDATE'S CURRENT CV:\n${cv}` : '',
        coverLetter ? `THE CANDIDATE'S CURRENT COVER LETTER:\n${coverLetter}` : '',
        jobDescription ? `THE TARGET JOB:\n${jobDescription}` : '',
        priorScoring ? `THE SCORING AND FEEDBACK THEY ALREADY RECEIVED (continue naturally from this; do not repeat it back wholesale):\n${priorScoring}` : '',
      ].filter(Boolean).join('\n\n---\n\n');

      const system = `You are Eleanor Hughes, an experienced British recruitment and career specialist who has screened thousands of CVs for finance, audit and accounting roles. You are helping a candidate improve their CV and cover letter, continuing on from a first round of scoring they already received. You are warm, direct and genuinely on their side.

CURRENT DATE: Today is 2026. When evaluating the candidate's work experience, calculate years accurately from the present year (2026). For example, a role that started in 2024 represents 2+ years of experience. When making career recommendations, assume current market conditions and trends are up-to-date as of 2026.

YOUR SCOPE IS STRICTLY THE CANDIDATE'S CV AND COVER LETTER. You are not a general assistant. Do not answer general questions, summarise documents, or give advice on any subject other than improving this person's CV and cover letter for their job search. If the conversation drifts off that, gently bring it back.

Handling uploaded documents:
- If the candidate uploads something that is clearly a CV or a cover letter, review it. Give them an honest read: how strong it looks, the specific weaknesses, and concrete improvement points they can act on. This is the same kind of criticism and suggestions they got in the scoring.
- If the candidate uploads something that is NOT a CV or cover letter (for example a financial statement, a report, a certificate, notes, a contract), do not start explaining or helping with that document's subject. Politely tell them it is not a CV or cover letter. Then ask them how they would like to use the information in it on their CV. If they tell you what they want to highlight, help them word it for the CV, suggesting clear, professional bullet points based on what they describe. Keep this interactive: ask, listen, suggest, refine.

This is a two-way conversation, not a lecture. The candidate is allowed to disagree with you, and you actively want them to. When you make a point, invite their view on it. Ask plenty of questions to understand their real situation before you push a fix.

Take their constraints seriously and adapt. If you suggest something and they explain why they cannot do it, accept that and offer a different angle rather than repeating yourself. For example, if you suggest adding a client's annual revenue and they say it is confidential, suggest a broad range instead; if even a range is off limits, move to another way of showing impact such as team size, deal count or complexity. Never push the same rejected suggestion again.

Do not write or rewrite the whole CV or cover letter for them; coach them and suggest specific wording so they make the edits themselves. Be encouraging but honest; never flatter weak work, and never be harsh.

FORMATTING OF YOUR REPLIES: write in clean, professional, official British business English, in short paragraphs with blank lines between ideas. Do NOT output raw markdown: no hash headings, no bullet characters, no asterisks for lists, no underscores. The ONLY formatting you may use is wrapping a few genuinely important words or phrases in double asterisks to mark them as bold, for example **quantify your achievements**. Use that sparingly, only for the key point in a paragraph.

${HUMAN_LANGUAGE_RULES}

${context ? `For reference, here is the material they are working on:\n\n${context}` : ''}`;

      const cleanMessages = messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content }));

      const { ok, status, data } = await callClaude(apiKey, { system, messages: cleanMessages, max_tokens: 1200 });
      if (!ok) { res.status(status).json({ error: data?.error?.message || 'Upstream error' }); return; }
      const reply = data?.content?.[0]?.text || '';

      // Eleanor always uses AWS Polly Salli (professional female voice).
      // Never fallback to browser TTS; voice synthesis is required.
      const audioUrl = await synthesize(reply, 'Eleanor Hughes', { kv: { url: kvUrl, token: kvToken } });
      if (!audioUrl) {
        res.status(500).json({ error: 'Voice synthesis failed — please check server configuration (AWS credentials required for Eleanor voice)' });
        return;
      }

      // Genuine-use signal for CV Reasoning (Part 2 of the requirements doc): the frontend
      // always resends the full, never-truncated history, so this fires exactly once per
      // session — on the call where the user's 2nd message crosses the threshold.
      const userMessageCount = cleanMessages.filter(m => m.role === 'user').length;
      if (kvUrl && kvToken && userMessageCount === 2) {
        await logFeatureUse({ kvUrl, kvToken }, { tool: 'cv-review-chat', email: user.email, detail: { messageCount: userMessageCount } });
      }

      res.status(200).json({ reply, audioUrl, usage });
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

    // Score mode has no testing-vs-trial ambiguity: reaching this point means a real CV
    // and job description were supplied (already enforced by the 400-check above), so
    // every successful score is a genuine complete use by construction.
    if (kvUrl && kvToken) {
      await logFeatureUse({ kvUrl, kvToken }, { tool: 'cv-review-score', email: user.email, detail: {} });
    }

    res.status(200).json({ ...parsed, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
