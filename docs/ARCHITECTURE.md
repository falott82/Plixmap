# Plixmap Architecture

## Runtime split
- `src/`: frontend React + Zustand + Konva editor.
- `server/`: API + auth + websocket presence/locks + SQLite persistence.
- `data/`: runtime database/uploads.

## Frontend modules
- `src/components/plan/PlanView.tsx`: main editor orchestration (tools, selections, overlays, modals).
- `src/components/layout/SidebarTree.tsx`: workspace navigation and plan-level actions.
- `src/store/`: state domains (data/auth/ui/chat/custom fields).
- `src/utils/`: shared logic (PDF export, perf metrics, files, websocket helpers, layer-visibility helpers, logging).
- Shared meeting time SSOT now lives in `src/utils/meetingTime.ts` and is reused by mobile agenda, meeting timelines, and follow-up views.
- Routing is split into `internalMapTypes.ts`, `internalMapGeometry.ts`, `internalMapGrid.ts` and `internalMapPathfinding.ts`. `internalMapRouting.ts` preserves the public API. Internal maps, escape routes and room allocation reuse the same polygon and door geometry.

## Server shared services
- `server/config.cjs`: shared runtime env/config parsing with defaults for server modules.
- `server/email.cjs`: SMTP settings, portal public URL SSOT, and email logging.
- `server/publicUrls.cjs`: shared public URL builders for kiosk, mobile, and public uploads.
- `server/services/users.cjs`: user-link normalization, imported-user conflict checks, and shared permission replacement helpers.
- `server/services/meetings.cjs`: meeting domain logic reused by extracted meeting routes.
- `server/utils/mail.cjs`: shared SMTP transport and sender configuration for settings, meeting notifications and user provisioning.
- `server/routes/maintenance.cjs`, `updates.cjs`, `capacity.cjs` and `operations.cjs`: operational endpoints kept separate from server startup. Capacity permission resolution receives its database explicitly.
- `server/services/packageChecks.cjs`: npm execution, report validation and last-check metadata. Exit code 1 denotes findings; process failures and npm error payloads are rejected.
- `server/services/codeAnalysis.cjs`: source scanning and ranking, independent of HTTP handling.

## Realtime flow
- WebSocket endpoint: `/ws`.
- Presence/locks are pushed from server to clients using `global_presence` and plan-scoped events.
- Connection teardown uses shared helper `closeSocketSafely` to avoid CONNECTING-close race warnings.

## Layer visibility model
- `ALL_ITEMS_LAYER_ID` is a virtual "show all" selector.
- Security layer is intentionally excluded from default visible set.
- Shared normalization lives in `src/utils/layerVisibility.ts` and is reused by both PlanView and Sidebar.

## Error handling and observability
- Global app boundary: `src/components/app/AppErrorBoundary.tsx`.
- Structured logger: `src/utils/logger.ts`.
- Browser-level listeners in `src/main.tsx` capture unhandled errors/rejections.
- Server request tracing: `X-Request-Id` is generated/preserved on each request and logged with status/duration.
- Runtime probes: `GET /api/health/live` and `GET /api/health/ready`.
- Migration status probe (superadmin): `GET /api/settings/db/migrations`.

## Data reliability
- SQLite backups are generated server-side using atomic `db.backup(...)` snapshots.
- Backup directory/retention are configurable via:
  - `PLIXMAP_BACKUP_DIR`
  - `PLIXMAP_BACKUP_KEEP`
- Backup API (superadmin):
  - `GET /api/settings/backups`
  - `POST /api/settings/backups`
  - `GET /api/settings/backups/:fileName`

## Security hardening
- Secret resolution supports direct env values and Docker/Kubernetes style file mounts (`*_FILE`).
- Strict secret policy can be enabled with `PLIXMAP_REQUIRE_ENV_SECRETS=1`.
- CSP defaults are strict; optional allowances for MediaPipe/eval are explicit env toggles.

## Build and quality gates
- `npm run lint`: TypeScript typecheck.
- `npm run lint:server`: rejects undefined symbols in backend modules.
- `npm run test:unit`: frontend helper and component regressions, including shared routing geometry and connected paths.
- `npm run test`: node:test suite for release/version guards plus focused shared-rule regressions (`access`, DB migrations, portal URL SSOT, public URL builders).
- `npm run build`: production bundle.
- `npm run release:check`: verifies version consistency across:
  - `package.json`
  - `README.md`
  - `src/version/history.ts` and its first referenced release-history chunk
- `npm run quality:check`: aggregate quality gate used by CI.
- `./plix.sh release`: closes matching local Chrome tabs, stops the configured port, rebuilds and restarts. The page reopens after both the frontend and database readiness probe respond successfully.

## CI workflows
- `i18n-lint.yml`: translation key consistency.
- `security-audit.yml`: production dependency audit.
- `quality-gate.yml`: lint + tests + build + release consistency + smoke e2e.
