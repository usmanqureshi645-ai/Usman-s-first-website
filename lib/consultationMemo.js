import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Header, Footer,
  PageNumber, AlignmentType, ExternalHyperlink, BorderStyle,
} from 'docx';

const OWNER = {
  name: 'Usman Qureshi',
  org: 'UQ Consulting',
  email: 'usmanqureshi645@gmail.com',
  phone: '+44 7447 747 254',
  linkedin: 'https://www.linkedin.com/in/usmanqureshi645',
  website: 'https://uqconsulting.org',
};

// Strips the simple inline HTML the report prompt produces (<p>, <ul>, <li>, <strong>) down
// to plain runs with bold spans preserved — docx paragraphs don't consume HTML directly.
function htmlToRuns(html) {
  if (!html) return [new TextRun('')];
  const withoutTags = String(html).replace(/<\/(p|li)>/gi, '\n').replace(/<li>/gi, '• ').replace(/<ul>|<\/ul>/gi, '');
  const parts = withoutTags.split(/(<strong>.*?<\/strong>)/gis).filter(Boolean);
  return parts.map(part => {
    const boldMatch = part.match(/^<strong>(.*?)<\/strong>$/is);
    const text = (boldMatch ? boldMatch[1] : part).replace(/<[^>]+>/g, '');
    return new TextRun({ text, bold: !!boldMatch });
  });
}

function htmlToParagraphs(html) {
  if (!html) return [new Paragraph('')];
  const lines = String(html).split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [new Paragraph(htmlToRuns(html))];
  return lines.map(line => new Paragraph({ children: htmlToRuns(line), spacing: { after: 120 } }));
}

function buildHeader() {
  return new Header({
    children: [
      new Paragraph({ children: [new TextRun({ text: OWNER.name, bold: true, size: 32 })] }),
      new Paragraph({ children: [new TextRun({ text: OWNER.org, size: 20, color: '555555' })] }),
      new Paragraph({
        children: [
          new TextRun({ text: `${OWNER.email}  |  ${OWNER.phone}  |  `, size: 18, color: '777777' }),
          new ExternalHyperlink({ link: OWNER.linkedin, children: [new TextRun({ text: 'LinkedIn', size: 18, color: '1155cc', underline: {} })] }),
          new TextRun({ text: '  |  ', size: 18, color: '777777' }),
          new ExternalHyperlink({ link: OWNER.website, children: [new TextRun({ text: 'uqconsulting.org', size: 18, color: '1155cc', underline: {} })] }),
        ],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B08D57' } },
        spacing: { after: 200 },
      }),
    ],
  });
}

function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
        children: [
          new TextRun({ text: `${OWNER.name}  |  ${OWNER.email}  |  Page `, size: 16, color: '777777' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '777777' }),
          new TextRun({ text: ' of ', size: 16, color: '777777' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '777777' }),
        ],
      }),
    ],
  });
}

export async function buildConsultationMemoDocx({ title, sections, relevantResources, recipientName }) {
  const children = [
    new Paragraph({ text: title || 'Technical Consultation Memo', heading: HeadingLevel.TITLE, spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: `Prepared for: ${recipientName || 'Client'}`, italics: true, color: '555555' })], spacing: { after: 300 } }),
  ];

  for (const section of Array.isArray(sections) ? sections : []) {
    if (!section?.heading) continue;
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
    children.push(...htmlToParagraphs(section.bodyHtml));
  }

  const standards = relevantResources?.technicalStandards;
  const uqResources = relevantResources?.uqResources;
  if ((Array.isArray(standards) && standards.length) || (Array.isArray(uqResources) && uqResources.length)) {
    children.push(new Paragraph({ text: 'Relevant Resources', heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));

    if (Array.isArray(standards) && standards.length) {
      children.push(new Paragraph({ text: 'Technical Standards', heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 80 } }));
      for (const s of standards) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${s.title || ''} — ${s.reference || ''}`, bold: true }),
            ...(s.link ? [new TextRun({ text: '  ' }), new ExternalHyperlink({ link: s.link, children: [new TextRun({ text: s.link, color: '1155cc', underline: {} })] })] : []),
          ],
          spacing: { after: 100 },
        }));
      }
    }

    if (Array.isArray(uqResources) && uqResources.length) {
      children.push(new Paragraph({ text: 'UQ Consulting Resources', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
      for (const r of uqResources) {
        children.push(new Paragraph({ children: [new TextRun({ text: r.title || '', bold: true })], spacing: { after: 20 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: r.reason || '' })], spacing: { after: 20 } }));
        if (r.link) {
          children.push(new Paragraph({ children: [new ExternalHyperlink({ link: r.link, children: [new TextRun({ text: r.link, color: '1155cc', underline: {} })] })], spacing: { after: 100 } }));
        }
      }
    }
  }

  const doc = new Document({
    sections: [{
      headers: { default: buildHeader() },
      footers: { default: buildFooter() },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
