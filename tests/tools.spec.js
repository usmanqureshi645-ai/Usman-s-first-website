// Tool preparatory-action tests: the free, no-API, no-login actions each tool
// allows anonymous visitors (pick a jurisdiction/framework, type into inputs).
// These never call an AI endpoint, matching the "anonymous can prep, not invoke"
// design — so they're fast and cost nothing.
import { test, expect } from '@playwright/test';

test.describe('anonymous preparatory actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('GAAP Compare: jurisdiction dropdown has options and is selectable', async ({ page }) => {
    const select = page.locator('#gaapJurisdiction');
    await expect(select).toBeVisible();
    const optionCount = await select.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);
    // Select the last option and confirm the value takes.
    const values = await select.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    await select.selectOption(values[values.length - 1]);
    await expect(select).toHaveValue(values[values.length - 1]);
  });

  test('Financial Statement Review: framework dropdown has options and is selectable', async ({ page }) => {
    const select = page.locator('#fsFramework');
    await expect(select).toBeVisible();
    const values = await select.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    expect(values.length).toBeGreaterThan(1);
    await select.selectOption(values[1]);
    await expect(select).toHaveValue(values[1]);
  });

  test('Meeting Room section renders its persona picker', async ({ page }) => {
    const section = page.locator('#meetingroom');
    await expect(section).toBeVisible();
    // Personas are selectable checkboxes/cards; at least one control should exist.
    const controls = section.locator('input, button, [role="checkbox"]');
    expect(await controls.count()).toBeGreaterThan(0);
  });

  test('Interview coach exposes optional CV upload, JD input and a difficulty toggle', async ({ page }) => {
    const section = page.locator('#knowledgetest');
    await expect(section.locator('#qzCvFile')).toHaveCount(1);
    await expect(section.locator('#qzJdInput')).toHaveCount(1);
    // The mid-session difficulty selector offers all three levels.
    const values = await section.locator('#qzLevelSelect option').evaluateAll((opts) => opts.map((o) => o.value));
    expect(values).toEqual(['Beginner', 'Intermediate', 'Expert']);
  });

  test('AI Tools nav dropdown links to real in-page tool sections', async ({ page }) => {
    const items = page.locator('.nav-links li.has-dropdown').first().locator('.nav-dropdown a');
    const hrefs = await items.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    // Every AI-tool dropdown item is an in-page anchor whose target section exists.
    for (const href of hrefs) {
      expect(href.startsWith('#')).toBeTruthy();
      await expect(page.locator(href)).toHaveCount(1);
    }
    expect(hrefs).toContain('#meetingroom');
    expect(hrefs).toContain('#jobhub');
  });

  test('Hot Market Topics nav dropdown is populated from the live articles', async ({ page }) => {
    const menu = page.locator('#hotTopicsDropdown');
    // Built from the static curated briefings on load (news fetch may add more).
    await expect
      .poll(async () => await menu.locator('a').count())
      .toBeGreaterThan(1);
    await expect(menu.locator('a', { hasText: 'View all topics' })).toHaveCount(1);
  });
});
