// Mirror guard: index.html and "Latest Business card.html" must stay
// byte-identical (see CLAUDE.md). This is a pure filesystem check with no
// browser — it runs in the "meta" project exactly once.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('index.html and "Latest Business card.html" are byte-identical', () => {
  const index = readFileSync(join(root, 'index.html'));
  const mirror = readFileSync(join(root, 'Latest Business card.html'));
  expect(
    Buffer.compare(index, mirror),
    'Mirror drift: run `cp index.html "Latest Business card.html"` before committing.'
  ).toBe(0);
});
