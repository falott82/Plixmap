import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Two run modes:
//  - Default (CI): no E2E_BASE_URL → boot a throwaway server on a fresh temp DB, and the
//    `setup` project completes first-run + seeds a plan so the `authed` project runs
//    against a real authenticated session. Requires `npm run build` first (server serves dist).
//  - External: set E2E_BASE_URL to point at an already-running server; no webServer/seed,
//    and the authed spec logs in via E2E_USERNAME/E2E_PASSWORD instead.
const explicitBase = process.env.E2E_BASE_URL;
const usingFixture = !explicitBase;
const PORT = Number(process.env.E2E_PORT || 8899);
const baseURL = explicitBase || `http://127.0.0.1:${PORT}`;
const AUTH_FILE = path.join(process.cwd(), 'e2e', '.auth', 'state.json');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: { baseURL, trace: 'on-first-retry' },
  reporter: [['list']],
  ...(usingFixture
    ? {
        webServer: {
          command: `rm -f .e2e-tmp/e2e.db* && PORT=${PORT} PLIXMAP_DB_PATH=.e2e-tmp/e2e.db node server/index.cjs`,
          url: `${baseURL}/api/auth/bootstrap-status`,
          reuseExistingServer: false,
          timeout: 60_000
        }
      }
    : {}),
  projects: [
    ...(usingFixture ? [{ name: 'setup' as const, testMatch: /global\.setup\.ts/ }] : []),
    {
      name: 'reliable',
      testIgnore: [/global\.setup\.ts/, /editor\.authed\.spec\.ts/]
    },
    {
      name: 'authed',
      testMatch: /editor\.authed\.spec\.ts/,
      use: usingFixture ? { storageState: AUTH_FILE } : {},
      dependencies: usingFixture ? ['setup'] : []
    }
  ]
});
