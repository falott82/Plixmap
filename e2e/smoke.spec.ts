import { expect, test } from '@playwright/test';

test('workspace bootstrap endpoint is reachable', async ({ request }) => {
  const response = await request.get('/api/auth/bootstrap-status');
  expect(response.status()).toBeLessThan(500);
});

test('root page responds', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status() || 0).toBeLessThan(500);
});
