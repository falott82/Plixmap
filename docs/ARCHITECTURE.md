# Deskly Architecture

## Runtime split
- `src/`: frontend React + Zustand + Konva editor.
- `server/`: API + auth + websocket presence/locks + SQLite persistence.
- `data/`: runtime database/uploads.

## Frontend modules
- `src/components/plan/PlanView.tsx`: main editor orchestration (tools, selections, overlays, modals).
- `src/components/layout/SidebarTree.tsx`: workspace navigation and plan-level actions.
- `src/store/`: state domains (data/auth/ui/chat/custom fields).
- `src/utils/`: shared logic (PDF export, perf metrics, files, websocket helpers, layer-visibility helpers, logging).

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

## Build and quality gates
- `npm run lint`: TypeScript typecheck.
- `npm run test`: node:test suite for release/version guard logic.
- `npm run build`: production bundle.
- `npm run release:check`: verifies version consistency across:
  - `package.json`
  - `README.md`
  - `src/version/history.ts`
- `npm run quality:check`: aggregate quality gate used by CI.

## CI workflows
- `i18n-lint.yml`: translation key consistency.
- `security-audit.yml`: production dependency audit.
- `quality-gate.yml`: lint + tests + build + release consistency + smoke e2e.
