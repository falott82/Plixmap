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
    // A 1x1 PNG so the editor mounts its Konva <Stage> (CanvasStage reads plan.imageUrl).
    const onePxPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const plan = {
      id: 'seed-plan-floor-0',
      name: 'E2E Plan',
      imageUrl: onePxPng,
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

  // Boot the SPA with the valid session. useAuthStore.hydrate() only calls /api/auth/me when
  // localStorage.plixmap_session_hint === '1' (a cold-start 401-noise guard), so we set the
  // hint and reload: hydrate then fetches /me, populates the user, and the router stays
  // authenticated. storageState must capture this localStorage (origins) + the cookies,
  // otherwise the client-side gate redirects to /login despite a valid session cookie.
  // (waitUntil 'networkidle' never settles here — the realtime WebSocket keeps the network
  // active — so we gate on the URL instead.)
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.setItem('plixmap_session_hint', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // hydrate() now fetches /me; the app briefly shows /login during the async call, then
  // settles on an authenticated route. Wait for that, then let the persist middleware flush.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(500);

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
