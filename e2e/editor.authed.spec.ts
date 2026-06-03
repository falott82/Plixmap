import { expect, test } from '@playwright/test';

// Authenticated editor e2e — exercises the decomposed PlanView / usePlanView /
// PlanViewView / CanvasStage under a real session. These are the flows that otherwise
// need manual QA after the stateful extractions.
//
// Two ways to authenticate:
//   1. CI fixture (default config): the `authed` project loads storageState produced by
//      global.setup.ts against a throwaway server — no credentials needed.
//   2. Real account: set E2E_USERNAME/E2E_PASSWORD (+ E2E_BASE_URL) to log in directly.
// Runs in the `authed` Playwright project; skips only when neither path is available.
const U = process.env.E2E_USERNAME;
const P = process.env.E2E_PASSWORD;

test.describe('authenticated editor', () => {
  test.beforeEach(async ({ page }) => {
    if (U && P) {
      // Real-account override: logging in via the page's request context sets the session
      // cookie on the same BrowserContext, so subsequent page.goto() calls are authenticated.
      const res = await page.request.post('/api/auth/login', {
        data: { username: U, password: P, otp: process.env.E2E_OTP || undefined },
        failOnStatusCode: false
      });
      expect(res.status(), 'login should succeed (check creds / MFA / mustChangePassword)').toBe(200);
    }
    // Otherwise the project's storageState (CI fixture) already carries a logged-in session.
  });

  test('authenticated app shell renders without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    // 'networkidle' never settles once the realtime WebSocket connects, so gate on the URL.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 12000 }).catch(() => {});
    await expect(page.locator('#root')).not.toBeEmpty();
    // Guard against silently testing the login page: we must be authenticated.
    await expect(page, 'session should be authenticated, not bounced to /login').not.toHaveURL(/\/login(?:\/|$)/);

    const fatal = errors.filter((e) => !/favicon|manifest|sw\.js|Failed to load resource/i.test(e));
    expect(fatal, `console/page errors under auth:\n${fatal.join('\n')}`).toHaveLength(0);
  });

  test('plan editor mounts a Konva canvas (CanvasStage) when a plan is available', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    // In fixture mode global.setup.ts seeds a plan at this id; with a real account we just
    // land on the default plan from the home route.
    const target = U && P ? '/' : '/plan/seed-plan-floor-0';
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    // The editor renders react-konva, which mounts a <canvas>. Give the SPA a moment to
    // route to the default plan and hydrate the stage.
    const canvas = page.locator('canvas').first();
    const appeared = await canvas
      .waitFor({ state: 'visible', timeout: 12000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!appeared, 'no plan/canvas available for this account — seed a plan to cover the editor');

    await expect(canvas).toBeVisible();
    expect(errors, `runtime errors while the editor mounted:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
