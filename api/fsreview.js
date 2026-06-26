import { buildMeetingSystemPrompt } from '../lib/meetingPersonas.js';
import { buildAnnotatedDocx } from '../lib/docxComments.js';
import { logAndCheckUsage } from '../lib/ipUsage.js';
import { getUserFromRequest } from '../lib/auth.js';
import { saveConsultation } from '../lib/consultations.js';

const FRAMEWORKS = new Set(['FRS 101', 'FRS 102', 'Full IFRS', 'US GAAP', 'AICPA']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }
  if (!resendKey) {
    res.status(500).json({ error: 'Email service not configured yet' });
    return;
  }

  const { text, fileName, fileBase64, framework, email } = req.body || {};
  const selectedFramework = FRAMEWORKS.has(framework) ? framework : 'Full IFRS';
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    res.status(400).json({ error: 'Please upload financial statements with enough text to review' });
    return;
  }
  if (!email || !String(email).includes('@')) {
    res.status(400).json({ error: 'Please provide an email address to send the reviewed document to' });
    return;
  }

  const usage = await logAndCheckUsage(req, { kvUrl, kvToken }, 'fsreview');

  const panelSystem = buildMeetingSystemPrompt();
  const system = `${panelSystem}

OVERRIDE FOR THIS TASK — ignore the conversational "Meeting Room" response format above. You are jointly reviewing a client's financial statements for compliance with **${selectedFramework}**, in the style of a Big 4 audit partner review (the kind that happens before statements go out the door). The panel of specialists above is jointly responsible for this review, each focusing on their own area (audit/disclosure, tax, IFRS/FRS technical interpretation, forensic/valuation, ESG, legal, technical accounting).

Review the full text for:
1. Compliance discrepancies against ${selectedFramework} — missing or incorrect disclosures, misapplied recognition/measurement, presentation errors.
2. Cross-reference discrepancies — e.g. a note referenced in the primary statements that doesn't exist, or numbers that don't tie between statements and notes.
3. Spelling mistakes and wording issues — treat this like a professional proofread, not just a technical review.
4. Anything else a partner reviewing this before sign-off would flag.

For every issue that can be pinned to a specific piece of text, you MUST be able to quote a short, EXACT, VERBATIM substring (5-15 words) from the document text below so it can be located and commented on directly — do not paraphrase the quote. If an issue is a broader risk/reservation that isn't anchored to one specific sentence (e.g. "going concern disclosures should be expanded given the facts described"), put it in additionalNotes instead.

Respond with ONLY valid JSON, no markdown fencing, in this exact shape:
{
  "inlineComments": [{ "quote": "<exact verbatim substring from the document>", "comment": "<the issue and what should change>", "persona": "<panel member name>", "standard": "<standard/clause reference, e.g. IAS 1.82>" }],
  "additionalNotes": [{ "persona": "<panel member name>", "note": "<broader risk or reservation, not anchored to specific text>" }],
  "summary": "<2-4 sentence overview of the review, written as if from the panel>"
}`;

  const userMessage = `FRAMEWORK TO REVIEW AGAINST: ${selectedFramework}\n\nFINANCIAL STATEMENTS TEXT:\n${text}`;

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
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    let review;
    try {
      review = JSON.parse(data?.content?.[0]?.text || '{}');
    } catch {
      res.status(500).json({ error: 'Could not parse the panel review — please try again' });
      return;
    }

    const inlineComments = Array.isArray(review.inlineComments) ? review.inlineComments : [];
    const additionalNotes = Array.isArray(review.additionalNotes) ? review.additionalNotes : [];
    const summary = review.summary || 'The panel completed its review — see attached document for inline comments.';

    const isDocx = (fileName || '').toLowerCase().endsWith('.docx') && fileBase64;
    const originalBuffer = isDocx ? Buffer.from(fileBase64, 'base64') : null;

    const { buffer: annotatedBuffer, unmatched } = await buildAnnotatedDocx(
      originalBuffer,
      text,
      inlineComments.map(c => ({ quote: c.quote, comment: `[${c.persona || 'Panel'}${c.standard ? ` — ${c.standard}` : ''}] ${c.comment}` }))
    );

    const outFileName = isDocx
      ? `Reviewed - ${fileName}`
      : `Reviewed - ${(fileName || 'financial-statements').replace(/\.[^.]+$/, '')}.docx`;

    const allNotes = [
      ...additionalNotes,
      ...unmatched.map(u => ({ persona: 'Panel', note: `Could not anchor this comment to exact text — ${u.comment}` })),
    ];

    const notesHtml = allNotes.length
      ? `<h3>Additional risks &amp; reservations (not anchored to specific text)</h3><ul>${allNotes
          .map(n => `<li><strong>${n.persona || 'Panel'}:</strong> ${n.note}</li>`)
          .join('')}</ul>`
      : '';

    const html = `
      <h2>Financial Statement Review — ${selectedFramework}</h2>
      <p>${summary}</p>
      <p>The full review is attached as a Word document (<strong>${outFileName}</strong>) with inline comments from Usman Qureshi anchored to the specific text in question${isDocx ? '' : " — since the original wasn't a Word file, we've rebuilt it as a commentable Word document so the comments can be anchored directly"}.</p>
      ${notesHtml}
      <p style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;color:#555">This is an AI-simulated panel review for educational purposes, not formal assurance or audit opinion.</p>
    `;

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Financial Statement Review <fsreview@uqconsulting.org>',
        to: [email],
        subject: `Your Financial Statement Review (${selectedFramework})`,
        html,
        attachments: [{ filename: outFileName, content: annotatedBuffer.toString('base64') }],
      }),
    });

    if (!emailResp.ok) {
      const emailData = await emailResp.json().catch(() => ({}));
      res.status(emailResp.status).json({ error: emailData?.message || 'Email send failed' });
      return;
    }

    const user = getUserFromRequest(req);
    if (user && kvUrl && kvToken) {
      try {
        await saveConsultation({
          kvUrl,
          kvToken,
          email: user.email,
          tool: 'fsreview',
          title: `${selectedFramework} review — ${fileName || 'financial statements'}`.slice(0, 80),
          summaryHtml: html,
          transcript: { framework: selectedFramework, fileName, inlineComments, additionalNotes: allNotes, summary, emailedAt: new Date().toISOString() },
        });
      } catch {
        // non-fatal — the deliverable was already emailed regardless
      }
    }

    res.status(200).json({ summary, additionalNotes: allNotes, emailed: true, usage });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
