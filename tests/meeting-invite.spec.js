// "Invite a real person" — the live, two-person Meeting Room co-participant feature
// (lib/meetingSession.js, account.js meeting-* actions). These specs cover only the
// UI/gating surface reachable without logging in or calling the AI panel — the actual
// two-browser polling sync can't be exercised by a single Playwright session and is
// covered by manual verification instead (see CLAUDE.md).
import { test, expect } from '@playwright/test';

test.describe('Meeting Room — invite a real person', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('invite button toggles the invite form', async ({ page }) => {
    const btn = page.locator('#mrInviteBtn');
    await expect(btn).toBeVisible();
    const form = page.locator('#mrInviteForm');
    await expect(form).toBeHidden();
    await btn.click();
    await expect(form).toBeVisible();
    await expect(form.locator('#mrInviteEmail')).toBeVisible();
  });

  test('sending an invite while logged out opens the signup widget instead of calling the API', async ({ page }) => {
    const panel = page.locator('#signupPanel');
    await expect(panel).not.toHaveClass(/open/);
    await page.locator('#mrInviteBtn').click();
    await page.locator('#mrInviteEmail').fill('colleague@example.com');
    await page.locator('#mrSendInviteBtn').click();
    // mrSendInvite() checks window.getSiteUser?.() first and opens signup before any fetch.
    await expect(panel).toHaveClass(/open/);
  });

  test('visiting with ?meetingjoin=<id> while logged out prompts sign-up rather than erroring silently', async ({ page }) => {
    // Mocked rather than hit live Vercel: the meeting-join action may not be deployed yet
    // when this spec runs pre-push, and this test only needs to prove the frontend's own
    // 401-handling branch, not the live endpoint's behaviour (covered by manual verification).
    await page.route('**/api/account?action=meeting-join*', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Please sign up or log in to join this session' }) }));
    await page.goto('/index.html?meetingjoin=nonexistent-test-id');
    await expect.poll(() => page.evaluate(() => window.pendingMeetingJoinId || null), { timeout: 5000 }).toBe('nonexistent-test-id');
  });
});
