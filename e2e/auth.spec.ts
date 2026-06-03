import { expect, test } from '@playwright/test';

test('bootstrap-status is reachable and well-formed', async ({ request }) => {
  const res = await request.get('/api/auth/bootstrap-status');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(typeof body.showFirstRunCredentials).toBe('boolean');
});

test('login rejects bad credentials with 401 (no session leak)', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { username: `e2e-nobody-${Date.now()}`, password: 'definitely-wrong' },
    failOnStatusCode: false
  });
  // Either unauthorized or rate-limited, never a 5xx or a 200.
  expect([401, 429]).toContain(res.status());
});

test('protected endpoint requires auth', async ({ request }) => {
  const res = await request.get('/api/auth/me', { failOnStatusCode: false });
  expect(res.status()).toBe(401);
});
