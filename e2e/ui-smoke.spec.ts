import { expect, test } from '@playwright/test';

// Unauthenticated UI smoke: the SPA must boot and render its shell without a runtime
// crash. This catches catastrophic breakage from the PlanView/CanvasStage decomposition
// (white screen / uncaught error) even without an authenticated editor session.
test('app shell renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const res = await page.goto('/', { waitUntil: 'networkidle' });
  expect(res?.status() || 0).toBeLessThan(500);

  // The app mounts into #root; expect it to contain rendered content.
  await expect(page.locator('#root')).not.toBeEmpty();

  // No uncaught runtime errors (ignore benign resource/network noise).
  const fatal = errors.filter((e) => !/favicon|manifest|sw\.js|Failed to load resource/i.test(e));
  expect(fatal, `console/page errors:\n${fatal.join('\n')}`).toHaveLength(0);
});
