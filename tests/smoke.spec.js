// Smoke tests: the tools page (index.html) loads and its structure is intact.
// Navigate to /index.html explicitly: on live, "/" redirects to home.html
// (vercel.json), whereas the local preview serves index.html at "/". Using the
// explicit path makes local and live behave identically.
import { test, expect } from '@playwright/test';

test.describe('index.html — page loads and structure', () => {
  test('loads with the expected title', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/Free AI Tools for Accountants/i);
  });

  test('all four nav tabs are present', async ({ page }) => {
    await page.goto('/index.html');
    const nav = page.locator('nav, header');
    // "My Workspace" is display:none until logged in — a plain DOM locator (unlike
    // getByRole) still counts hidden elements, so assert presence in the DOM.
    for (const label of ['AI Tools', 'Hot Market Topics', 'My Workspace', 'Who am I']) {
      await expect(page.locator('a', { hasText: label }).first()).toHaveCount(1);
    }
    await expect(nav.first()).toBeVisible();
  });

  test('the six AI tool sections exist in the DOM', async ({ page }) => {
    await page.goto('/index.html');
    for (const id of ['meetingroom', 'knowledgetest', 'jobhub', 'fsreview', 'hottopics']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    // GAAP Compare has no section id but is identifiable by its control.
    await expect(page.locator('#gaapJurisdiction')).toHaveCount(1);
  });

  test('no uncaught JS exceptions on load', async ({ page }) => {
    // Only fail on genuine uncaught exceptions (pageerror). console.error noise
    // from expected 401s (anonymous /api/account?action=track etc.) and CDN
    // resources is not a code bug, so it is deliberately not asserted here.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto('/index.html');
    await page.waitForLoadState('load');
    expect(pageErrors, `uncaught exceptions:\n${pageErrors.join('\n')}`).toEqual([]);
  });
});
