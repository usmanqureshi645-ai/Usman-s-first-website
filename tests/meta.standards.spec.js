// Standards-accuracy guard (see CLAUDE.md "Blog accuracy").
//
// A live blog once labelled inventory as "IFRS 2" (IFRS 2 is Share-based
// Payment; inventory is IAS 2), and others invented "IFRS 36" / "IFRS 37"
// (no such standards — impairment is IAS 36, provisions is IAS 37). For an
// ACA/ACCA audit brand a wrong standard number is credibility damage, so this
// pure-filesystem check hard-fails `npm test` on:
//   A. any `IFRS <n>` where <n> is not a real IFRS number, and
//   B. "IFRS 2" used in an inventory context (must be IAS 2).
//
// Runs once in the "meta" project, no browser. Extend REAL_IFRS / the
// collocation rules below as new standards ship or new traps are found.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Issued IFRS standards (numbers only). IAS standards are a separate series and
// are never written as "IFRS N". Update when a new IFRS is issued.
const REAL_IFRS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

// Files that carry standard references and are published/served.
function targetFiles() {
  const files = [];
  const blogDir = join(root, 'blog');
  for (const name of readdirSync(blogDir)) {
    if (name.endsWith('.html')) files.push(join(blogDir, name));
  }
  files.push(join(root, 'knowledge-hub.html'));
  files.push(join(root, 'lib', 'blogCatalog.js'));
  return files;
}

function rel(p) {
  return p.slice(root.length + 1).replace(/\\/g, '/');
}

// Legit pedagogical use: articles correctly say "there is no IFRS 37".
// A match is exempt only when its surrounding window carries an explicit
// negation/clarification cue, so accidental mislabels are still caught.
const NEGATION_CUE = /no such|there is no|not a real|no standard called|is not a|never renumbered|no "IFRS|credibility flag|IAS\s+\d{1,2}\s+or\s+IFRS/i;

test('no non-existent IFRS standard numbers are referenced', () => {
  const violations = [];
  const re = /\bIFRS\s+(\d{1,2})\b/g;
  for (const file of targetFiles()) {
    const text = readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = Number(m[1]);
      if (REAL_IFRS.has(n)) continue;
      const window = text.slice(Math.max(0, m.index - 120), m.index + 120);
      if (NEGATION_CUE.test(window)) continue;
      violations.push(`${rel(file)}: "IFRS ${n}" is not a real IFRS standard (did you mean IAS ${n}?)`);
    }
  }
  expect(
    violations,
    `Non-existent IFRS numbers found — IAS ≠ IFRS:\n${violations.join('\n')}`
  ).toEqual([]);
});

test('IFRS 2 is never used to label inventory (that is IAS 2)', () => {
  // IFRS 2 = Share-based Payment. Inventory is IAS 2. Flag "IFRS 2" appearing
  // in an inventory context, unless the share-based-payment sense is explicit.
  const inventoryCtx = /net realisable value|inventory valuation|lower of cost and net|lower of cost and market/i;
  const shareBasedCtx = /share-based|\(SBP\)/i;
  const violations = [];
  for (const file of targetFiles()) {
    const text = readFileSync(file, 'utf8');
    if (/\bIFRS\s*2\b/.test(text) && inventoryCtx.test(text) && !shareBasedCtx.test(text)) {
      violations.push(`${rel(file)}: "IFRS 2" in an inventory context — inventory is IAS 2.`);
    }
  }
  expect(
    violations,
    `IFRS 2 mislabelled for inventory:\n${violations.join('\n')}`
  ).toEqual([]);
});
