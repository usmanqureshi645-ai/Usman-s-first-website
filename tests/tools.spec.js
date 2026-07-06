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
});
