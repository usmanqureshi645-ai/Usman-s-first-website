// Auth-gate tests: anonymous visitors can see tools but the AI-invoking action
// opens the signup widget instead of proceeding. We assert the gate behaviour
// and widget wiring WITHOUT creating accounts or spending Anthropic tokens.
import { test, expect } from '@playwright/test';

test.describe('signup / login gate', () => {
  test('anonymous session: getSiteUser returns no user', async ({ page }) => {
    await page.goto('/index.html');
    const user = await page.evaluate(() => window.getSiteUser?.());
    expect(user == null).toBeTruthy();
  });

  test('signup widget opens via window.toggleSignup(true)', async ({ page }) => {
    await page.goto('/index.html');
    const panel = page.locator('#signupPanel');
    await expect(panel).not.toHaveClass(/open/);
    await page.evaluate(() => window.toggleSignup?.(true));
    await expect(panel).toHaveClass(/open/);
  });

  test('gated AI action opens signup when logged out', async ({ page }) => {
    await page.goto('/index.html');
    // Spy on the gate the tools use (mrStartMeeting/qzStart/... all call this).
    await page.evaluate(() => {
      window.__signupOpened = false;
      const orig = window.toggleSignup;
      window.toggleSignup = (force) => { if (force === true) window.__signupOpened = true; return orig?.(force); };
    });
    // Invoke a representative gated action directly (no UI-path fragility).
    // mrStartMeeting()'s FIRST line is the login gate, so it's the cleanest probe.
    await page.evaluate(() => window.mrStartMeeting?.());
    const opened = await page.evaluate(() => window.__signupOpened);
    expect(opened).toBeTruthy();
  });
});
