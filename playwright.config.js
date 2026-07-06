// Playwright configuration for Usman's website.
// Source: https://github.com/microsoft/playwright (@playwright/test).
//
// Two target environments live in one suite via named projects:
//   local-*  -> http://localhost:5500 (the .claude/staticserver.cjs preview,
//               which proxies /api/* to the live Vercel deployment)
//   live-*   -> https://usman-s-first-website.vercel.app (post-deploy smoke)
//
// Usage (see package.json scripts):
//   npm test         -> local Chromium + WebKit + meta (pre-push gate)
//   npm run test:live -> live Chromium + WebKit (post-deploy smoke)
//   npm run test:firefox -> local Firefox (opt-in; see note)
//   npm run test:ui  -> interactive debugging
//
// NOTE: Firefox is defined below but excluded from the default `npm test`
// because it fails to launch on this Windows box ("spawn UNKNOWN" — a local
// security/permissions issue, not a test bug). Chromium + WebKit cover the
// Blink and WebKit engines; run `npm run test:firefox` where Firefox launches.
//
// The "meta" project runs pure-filesystem checks (e.g. the index.html <->
// "Latest Business card.html" mirror guard) exactly once, no browser needed.

import { defineConfig, devices } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5500';
const LIVE_URL = 'https://usman-s-first-website.vercel.app';

export default defineConfig({
  testDir: './tests',
  // AI-invoking flows go through the live Vercel API via the proxy; keep the
  // suite lean and never assert on real AI completions (they cost tokens).
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  // Auto-start the local static preview for the local-* projects.
  // Harmless (and reused) if a server is already running on 5500.
  webServer: {
    command: 'node .claude/staticserver.cjs',
    url: LOCAL_URL,
    reuseExistingServer: true,
    timeout: 30_000,
  },

  projects: [
    // Pure filesystem / non-browser checks — run once.
    {
      name: 'meta',
      testMatch: /meta\..*\.spec\.js/,
    },

    // ---- Local preview (pre-push gate) ----
    {
      name: 'local-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: LOCAL_URL },
      testIgnore: /meta\..*\.spec\.js/,
    },
    {
      name: 'local-firefox',
      use: { ...devices['Desktop Firefox'], baseURL: LOCAL_URL },
      testIgnore: /meta\..*\.spec\.js/,
    },
    {
      name: 'local-webkit',
      use: { ...devices['Desktop Safari'], baseURL: LOCAL_URL },
      testIgnore: /meta\..*\.spec\.js/,
    },

    // ---- Live Vercel (post-deploy smoke) ----
    {
      name: 'live-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL },
      testIgnore: /meta\..*\.spec\.js/,
    },
    {
      name: 'live-firefox',
      use: { ...devices['Desktop Firefox'], baseURL: LIVE_URL },
      testIgnore: /meta\..*\.spec\.js/,
    },
    {
      name: 'live-webkit',
      use: { ...devices['Desktop Safari'], baseURL: LIVE_URL },
      testIgnore: /meta\..*\.spec\.js/,
    },
  ],
});
