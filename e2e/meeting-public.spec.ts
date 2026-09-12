import { expect, test } from '@playwright/test';

// Covers the H2 fix: public meeting endpoints are rate-limited.
// help-request is the strictest bucket (max 5 / 60s, keyed by ip:roomId), so a short
// burst to a unique room id reliably trips a 429 without needing auth or a real room.
test('public help-request endpoint is rate limited (H2)', async ({ request }) => {
  const roomId = `e2e-rl-${Date.now()}`;
  const statuses: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    const res = await request.post(`/api/meeting-room/${roomId}/help-request`, {
      data: { kind: 'it' },
      failOnStatusCode: false
    });
    statuses.push(res.status());
  }
  // After the 5/min budget is exhausted, further requests must be 429.
  expect(statuses).toContain(429);
  // And it should never 5xx.
  expect(statuses.every((s) => s < 500)).toBe(true);
});

test('public schedule endpoint responds without auth and without 5xx', async ({ request }) => {
  const res = await request.get(`/api/meeting-room/e2e-${Date.now()}/schedule`, { failOnStatusCode: false });
  expect(res.status()).toBeLessThan(500);
});
