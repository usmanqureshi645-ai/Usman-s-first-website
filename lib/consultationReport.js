import { blogCatalogPrompt } from './blogCatalog.js';

// Full menu of sections a Big 4-style technical consultation report can cover. Not every
// section applies to every discussion — the model is told to include only what's genuinely
// relevant rather than padding every heading out, but a handful are always kept (see the
// "always include" note in the prompts below) so every report has a consistent spine.
const SECTION_MENU = [
  'Executive Summary', 'Background and Facts', 'Scope of the Consultation', 'Key Assumptions',
  'Issues Identified', 'Accounting Analysis', 'Applicable IFRS / IAS / FRS / UK GAAP / US GAAP Standards',
  'Audit Risks', 'Financial Statement Risks', 'Risk of Material Misstatement (RMM)',
  'Significant Judgements', 'Critical Accounting Estimates', 'Internal Control Considerations',
  'Tax Risks', 'Corporation Tax Considerations', 'VAT Considerations', 'Deferred Tax Considerations',
  'FRC Considerations', 'ISA Considerations', 'PCAOB Considerations', 'SEC Considerations (where relevant)',
  'Companies Act Considerations', 'Regulatory Risks', 'Alternative Accounting Treatments',
  'Pros and Cons of Each Treatment', 'Management Considerations', 'Disclosure Requirements',
  'Practical Implementation Steps', 'Action Points', 'Items Requiring Management Judgement',
  'Areas Requiring Legal Advice (where appropriate)', 'Remaining Risks After Implementation',
  'Overall Recommendation', 'Final Conclusion',
];

const ALWAYS_INCLUDE = ['Executive Summary', 'Issues Identified', 'Accounting Analysis', 'Overall Recommendation', 'Final Conclusion'];

const SHARED_INSTRUCTIONS = (label) => `You write premium technical consultation reports on behalf of "${label}" — a virtual panel of finance specialists on a personal website — in the style of a Big 4 technical accounting, audit, tax, or advisory partner's written output following a client consultation. This is not a meeting recap; it is a full technical consultation report giving 360° coverage of the discussion, structured and professional throughout.

SECTIONS — choose from this menu, using only the ones genuinely relevant to what was actually discussed (never pad out a section with generic filler just to include it): ${SECTION_MENU.join(', ')}. Always include: ${ALWAYS_INCLUDE.join(', ')}. Order sections logically (context and facts first, technical analysis and risks in the middle, recommendations and conclusion last).

CITATIONS — be as granular as possible. Reference the exact supporting material: specific IFRS/IAS paragraph numbers, IFRIC agenda decisions, IASB educational material, ISA paragraph numbers, FRC guidance sections, Companies Act provisions/sections, HMRC manual references or GOV.UK guidance pages, PCAOB standard numbers, SEC guidance, ASC/US GAAP references, tax legislation sections, and relevant accounting interpretations — never a bare homepage link where a specific paragraph or section is available. Apply the same reference-accuracy discipline as the live conversation: if not confident in an exact paragraph number, cite the standard/section you ARE confident in rather than inventing a precise-sounding but wrong one. Never fabricate a citation.

UQ CONSULTING KNOWLEDGE BASE — Usman's own published articles are part of your knowledge base. Where a resource below is genuinely relevant to an issue discussed, mention it naturally in the body where it helps (e.g. "There's a worked example covering a very similar IFRS 15 issue — the section on identifying performance obligations would be particularly relevant") with a real hyperlink, the way a colleague would recommend further reading, not as a sales pitch. Only recommend what is genuinely relevant — never force a mention.

${blogCatalogPrompt()}

TONE: professional, warm, clearly human-written consultation style — not robotic, not AI-generated-sounding. Do not mention that this was AI-generated.`;

export function buildReportEmailPrompt({ label }) {
  return `${SHARED_INSTRUCTIONS(label)}

OUTPUT FORMAT — this is critical: respond with ONLY raw inline-styled HTML (use <h2> for section headings, <h3> for subsections, <p>, <ul>, <li>, <a>, <strong> — no external CSS, no markdown fences, no preamble or commentary about the transcript). Start directly with the opening <h2>Executive Summary</h2> or an introductory <p> before it.

Finish with a section titled "Relevant Resources", itself split into two subsections:
1. "Technical Standards" — only the standards/guidance actually cited above, each with its document title, specific paragraph/section, and a direct link where a real one exists (IFRS Foundation, FRC, PCAOB, SEC, GOV.UK/HMRC, Companies Act legislation.gov.uk pages).
2. "UQ Consulting Resources" — only articles from the knowledge base above that were genuinely relevant to this discussion, each with its title, a short one-sentence explanation of why it's relevant, and its direct link.
Only include resources that are directly relevant — never a generic padded list. If genuinely nothing relevant exists in a subsection, omit that subsection rather than writing a placeholder.

Even if the transcript is short, incomplete, or seems to cut off mid-conversation, write the best honest, complete report you can directly in the HTML — never comment on the transcript's quality or completeness outside of the HTML itself.`;
}

export function buildReportMemoPrompt({ label }) {
  return `${SHARED_INSTRUCTIONS(label)}

OUTPUT FORMAT — this is critical: respond with ONLY valid JSON (no markdown fences, no commentary before or after), in this exact shape:
{
  "title": "<a short, specific report title, e.g. 'Technical Consultation: IFRS 16 Lease Modification Treatment'>",
  "sections": [
    { "heading": "<one of the section names from the menu above>", "bodyHtml": "<the section's content as simple HTML: <p>, <ul>, <li>, <strong> only — no headings inside bodyHtml>" }
  ],
  "relevantResources": {
    "technicalStandards": [ { "title": "<document title>", "reference": "<specific paragraph/section>", "link": "<url or empty string if none>" } ],
    "uqResources": [ { "title": "<article title>", "reason": "<one short sentence on why it's relevant>", "link": "<url>" } ]
  }
}
Only include resources that are directly relevant; use empty arrays for a subsection with nothing genuinely relevant rather than padding it. Even if the transcript is short or incomplete, produce the best honest, complete report you can — never comment on the transcript's quality inside the JSON content itself.`;
}

// Renders the memo-format JSON report as simple HTML — used for the workspace preview/summaryHtml
// when a user chose the Memo output (the real letterhead .docx is what actually gets emailed).
export function renderReportJsonToHtml(report) {
  const esc = s => String(s ?? '');
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  let html = `<h2>${esc(report?.title || 'Consultation Memo')}</h2>`;
  for (const s of sections) {
    if (!s?.heading) continue;
    html += `<h3>${esc(s.heading)}</h3>${s.bodyHtml || ''}`;
  }
  const standards = report?.relevantResources?.technicalStandards;
  const uqResources = report?.relevantResources?.uqResources;
  if ((Array.isArray(standards) && standards.length) || (Array.isArray(uqResources) && uqResources.length)) {
    html += `<h2>Relevant Resources</h2>`;
    if (Array.isArray(standards) && standards.length) {
      html += `<h3>Technical Standards</h3><ul>${standards.map(s => `<li><strong>${esc(s.title)}</strong> — ${esc(s.reference)}${s.link ? ` — <a href="${esc(s.link)}">${esc(s.link)}</a>` : ''}</li>`).join('')}</ul>`;
    }
    if (Array.isArray(uqResources) && uqResources.length) {
      html += `<h3>UQ Consulting Resources</h3><ul>${uqResources.map(r => `<li><strong>${esc(r.title)}</strong> — ${esc(r.reason)}${r.link ? ` — <a href="${esc(r.link)}">${esc(r.link)}</a>` : ''}</li>`).join('')}</ul>`;
    }
  }
  return html;
}
