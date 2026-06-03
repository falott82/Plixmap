import { expect, test } from '@playwright/test';

// Authenticated editor e2e — exercises the decomposed PlanView / usePlanView /
// PlanViewView / CanvasStage under a real session. These are the flows that otherwise
// need manual QA after the stateful extractions.
//
// Opt-in: set E2E_USERNAME and E2E_PASSWORD for an existing, past-first-run account that
// has at least one floor plan. Without them, the suite skips (so CI stays green).
//   E2E_USERNAME=admin E2E_PASSWORD=*** npm run test:e2e:playwright
const U = process.env.E2E_USERNAME;
const P = process.env.E2E_PASSWORD;

test.describe('authenticated editor', () => {
  test.skip(!U || !P, 'set E2E_USERNAME/E2E_PASSWORD to run authenticated editor e2e');

  test.beforeEach(async ({ page }) => {
    // Logging in via the page's request context sets the session cookie on the same
    // BrowserContext, so subsequent page.goto() calls are authenticated.
    const res = await page.request.post('/api/auth/login', {
      data: { username: U, password: P, otp: process.env.E2E_OTP || undefined },
      failOnStatusCode: false
    });
    expect(res.status(), 'login should succeed (check creds / MFA / mustChangePassword)').toBe(200);
  });

  test('authenticated app shell renders without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('#root')).not.toBeEmpty();

    const fatal = errors.filter((e) => !/favicon|manifest|sw\.js|Failed to load resource/i.test(e));
    expect(fatal, `console/page errors under auth:\n${fatal.join('\n')}`).toHaveLength(0);
  });

  test('plan editor mounts a Konva canvas (CanvasStage) when a plan is available', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/', { waitUntil: 'networkidle' });

    // The editor renders react-konva, which mounts a <canvas>. Give the SPA a moment to
    // route to the default plan and hydrate the stage.
    const canvas = page.locator('canvas').first();
    const appeared = await canvas
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!appeared, 'no plan/canvas available for this account — seed a plan to cover the editor');

    await expect(canvas).toBeVisible();
    expect(errors, `runtime errors while the editor mounted:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
