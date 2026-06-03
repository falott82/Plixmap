import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// CI fixture: against the throwaway server (fresh DB) the bootstrap superadmin/deskly is in
// first-run mode. We log in, complete first-run to a known password (clearing
// mustChangePassword), best-effort seed a plan so the editor renders, then save the
// authenticated storage state for the `authed` project. No real credentials needed.
const AUTH_FILE = path.join(process.cwd(), 'e2e', '.auth', 'state.json');
const SEED_PASSWORD = 'E2e!seedPass1';

setup('authenticate + seed', async ({ page, baseURL }) => {
  // The server stores the csrf cookie URL-encoded but compares the header against the
  // decoded value (double-submit), so the header must be decodeURIComponent'd — exactly
  // what the real frontend does when it reads document.cookie.
  const csrf = async () => {
    const c = await page.context().cookies();
    const raw = c.find((x) => x.name === 'plixmap_csrf')?.value || '';
    return decodeURIComponent(raw);
  };

  const login = await page.request.post('/api/auth/login', {
    data: { username: 'superadmin', password: 'deskly' },
    failOnStatusCode: false
  });
  // 200 on a fresh DB (first-run). If the DB is not fresh, this fixture isn't applicable.
  expect(login.status(), 'fresh-DB superadmin/deskly login').toBe(200);

  const firstRun = await page.request.post('/api/auth/first-run', {
    headers: { 'x-csrf-token': await csrf() },
    data: { newPassword: SEED_PASSWORD, language: 'en' },
    failOnStatusCode: false
  });
  expect([200, 400]).toContain(firstRun.status()); // 400 = already past first-run (reused server)

  // Best-effort: seed a minimal plan at the superadmin's defaultPlanId so '/' opens an editor.
  try {
    const state = await (await page.request.get('/api/state')).json();
    const plan = {
      id: 'seed-plan-floor-0',
      name: 'E2E Plan',
      objects: [],
      revisions: [],
      views: []
    };
    const clients = [
      { id: 'e2e-client', name: 'E2E Client', shortName: 'E2E', sites: [{ id: 'e2e-site', name: 'E2E Site', floorPlans: [plan] }] }
    ];
    await page.request.put('/api/state', {
      headers: { 'x-csrf-token': await csrf() },
      data: { clients, updatedAt: Number(state?.updatedAt || 0) || undefined },
      failOnStatusCode: false
    });
  } catch {
    // ignore seed failures — the editor canvas test skips gracefully without a plan.
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
