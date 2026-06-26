// Injects real, native Word comments (anchored to matched text) into a .docx file,
// or builds a fresh minimal .docx from plain text first if no original file was supplied
// (used for PDF/.txt uploads, which can't carry Word comments natively).
import JSZip from 'jszip';

const COMMENT_AUTHOR = 'Usman Qureshi';

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildBlankDocument(paragraphs) {
  const body = paragraphs
    .map(p => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(p)}</w:t></w:r></w:p>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr/></w:body>
</w:document>`;
}

async function buildBlankDocx(text) {
  const zip = new JSZip();
  const paragraphs = String(text || '').split(/\n+/).filter(p => p.trim().length > 0);

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file('word/document.xml', buildBlankDocument(paragraphs));
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

  return zip;
}

async function ensureCommentsParts(zip) {
  const contentTypesFile = zip.file('[Content_Types].xml');
  let contentTypesXml = contentTypesFile ? await contentTypesFile.async('string') : null;
  if (contentTypesXml && !contentTypesXml.includes('comments.xml')) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'
    );
    zip.file('[Content_Types].xml', contentTypesXml);
  }

  const relsPath = 'word/_rels/document.xml.rels';
  const relsFile = zip.file(relsPath);
  let relsXml = relsFile
    ? await relsFile.async('string')
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  if (!relsXml.includes('comments.xml')) {
    relsXml = relsXml.replace(
      '</Relationships>',
      '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'
    );
    zip.file(relsPath, relsXml);
  }
}

// Wraps the first <w:t> run containing `quote` with comment range/reference markup.
// Substring matching only (no fuzzy matching) — good enough for v1; unmatched quotes
// are reported back so the caller can fold them into the "additional notes" list instead.
function injectCommentIntoDocumentXml(documentXml, quote, commentId) {
  const tRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
  let match;
  while ((match = tRegex.exec(documentXml)) !== null) {
    const [fullMatch, attrs, rawText] = match;
    const decoded = rawText
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    const idx = decoded.indexOf(quote);
    if (idx === -1) continue;

    const before = xmlEscape(decoded.slice(0, idx));
    const matched = xmlEscape(decoded.slice(idx, idx + quote.length));
    const after = xmlEscape(decoded.slice(idx + quote.length));

    const replacement =
      `<w:commentRangeStart w:id="${commentId}"/>` +
      `<w:t${attrs} xml:space="preserve">${before}</w:t>` +
      `</w:r><w:r><w:t${attrs} xml:space="preserve">${matched}</w:t>` +
      `</w:r><w:commentRangeEnd w:id="${commentId}"/><w:r><w:commentReference w:id="${commentId}"/></w:r>` +
      `<w:r><w:t${attrs} xml:space="preserve">${after}</w:t>`;

    return { xml: documentXml.slice(0, match.index) + replacement + documentXml.slice(match.index + fullMatch.length), matched: true };
  }
  return { xml: documentXml, matched: false };
}

function buildCommentsXml(comments) {
  const date = new Date().toISOString();
  const body = comments
    .map(
      c => `<w:comment w:id="${c.id}" w:author="${xmlEscape(COMMENT_AUTHOR)}" w:date="${date}" w:initials="UQ"><w:p><w:r><w:t xml:space="preserve">${xmlEscape(c.comment)}</w:t></w:r></w:p></w:comment>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</w:comments>`;
}

/**
 * @param {Buffer|null} originalDocxBuffer - the uploaded .docx, or null to build one from text
 * @param {string} fallbackText - plain text to build a fresh docx from, when originalDocxBuffer is null
 * @param {Array<{quote: string, comment: string}>} items
 * @returns {Promise<{ buffer: Buffer, unmatched: Array<{quote: string, comment: string}> }>}
 */
export async function buildAnnotatedDocx(originalDocxBuffer, fallbackText, items) {
  const zip = originalDocxBuffer ? await JSZip.loadAsync(originalDocxBuffer) : await buildBlankDocx(fallbackText);

  const documentFile = zip.file('word/document.xml');
  let documentXml = await documentFile.async('string');

  const matchedComments = [];
  const unmatched = [];
  let nextId = 0;

  for (const item of items) {
    if (!item?.quote || !item?.comment) continue;
    const { xml, matched } = injectCommentIntoDocumentXml(documentXml, item.quote, nextId);
    if (matched) {
      documentXml = xml;
      matchedComments.push({ id: nextId, comment: item.comment });
      nextId++;
    } else {
      unmatched.push(item);
    }
  }

  zip.file('word/document.xml', documentXml);

  if (matchedComments.length > 0) {
    await ensureCommentsParts(zip);
    zip.file('word/comments.xml', buildCommentsXml(matchedComments));
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { buffer, unmatched };
}
