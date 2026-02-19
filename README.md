# Plixmap - Floor Plan Management

Current version: 3.0.1

Plixmap is a web app to plan offices and infrastructure on floor plans using a fixed hierarchy **Client -> Site -> Floor plan**. It combines drag & drop editing, rooms, layers, walls, racks, measurements, and PDF exports in one workspace.

## What's new in 3.0.1
- Repository hygiene/security: removed historical `data/` runtime artifacts from Git history (SQLite DB/WAL/SHM, uploads, backups).
- Added sensitive-data guard script (`npm run sensitive:check`) and wired it into CI quality gate.
- Added versioned pre-commit hook (`.githooks/pre-commit`) to block staged SQLite/backup/upload files and likely plaintext SMTP/WebAPI/import secrets.
- Hardened ignore rules so operational instance data under `data/` remains local-only (`data/.gitkeep` excluded).

## What's new in 3.0.0
- Brand migration step 2 completed: project identity is now Plixmap across runtime/UI/PWA assets.
- Session/CSRF/runtime keys are now standardized on 'plixmap_*' (legacy Deskly fallbacks removed in active paths).
- Runtime cache/export/log prefixes updated from Deskly to Plixmap (files, CSV/PDF exports, service-worker caches, logger scope).
- Backup workspace export now uses 'plixmap-workspace' kind (import still accepts legacy 'deskly-workspace').
- Login and sidebar now use the new PNG logo (public/plixmap-logo.png) with favicon/PWA icon alignment.

## What's new in 2.9.5
- Rooms: improved label rendering so newly created room labels stay inside room bounds and auto-wrap better without manual shrinking.
- Rooms: refined room label panel spacing and adaptive text layout for clearer readability across narrow/small rooms.
- Keyboard UX: pressing `R` on the map now opens the room-creation mode modal.
- Keyboard UX in room-creation modal: press `R` to start `Rectangle` room drawing or `P` to start `Polygon` room drawing.
- Room creation modal copy/UI refreshed with explicit keyboard hints (`R`/`P`) for faster workflow.

## What's new in 2.9.3
- Layers: fixed `Real user` visibility so it no longer depends on generic user visibility; real users now resolve their dedicated layer mapping correctly.
- Layers: fixed `Show all` behavior when disabling `Rooms`; rooms now disappear correctly from the map instead of staying visible.
- Layer routing audit: normalized layer resolution now consistently handles legacy `real_user` objects created with old default layer assignments.
- Reliability: added server-side atomic SQLite backups (`sqlite backup`) with retention policy and downloadable backup list in Settings -> Backup.
- Reliability: added health probes (`/api/health/live`, `/api/health/ready`) and DB migration status endpoint (`/api/settings/db/migrations`).
- Security: secrets hardening with support for `*_FILE` env vars and optional strict mode `PLIXMAP_REQUIRE_ENV_SECRETS=1`.
- Security: CSP is now stricter by default; MediaPipe/eval allowances are opt-in via env flags.
- Performance: PlanView now lazy-loads heavy routing/gallery modals; CanvasStage now uses `FastLayer` for static background and viewport culling for offscreen objects.
- Security hardening on export stack: removed `exceljs` and migrated table export to Excel-compatible SpreadsheetML (`.xls`) to eliminate runtime dependency chain vulnerabilities (`archiver/minimatch`).

## What's new in 2.9.1
- Added `connecting doors between rooms`: select Room A + Room B, right-click a selected room, and use `Create connecting door`; placement is allowed only on an overlapping shared side.
- Added full editing flow for room-connection doors: dedicated marker on map, right-click menu, double-click to edit door properties, and delete action.
- Routing engine update (Internal Map + Escape Route): room-door connectors are now considered when start/end points are inside rooms not directly facing a corridor.
- Route persistence/revisions/clone now include room-connection doors to keep behavior consistent across save, restore, duplicate, and history operations.
- Layers UX: fixed `Show all` + single-layer toggles so disabling one layer correctly hides its items.
- User directory: `Export PDF` now opens a column-selection modal before generating the final document.
- Link editing: fixed modal state reset while typing, so link names/descriptions can be edited without input being overwritten.
- Safety panel: removed `Door ID` from the emergency-doors table and CSV export.
- WebAPI import modal: moved settings gear into the helper message, removed the top-right settings button, and added guards so `Test WebAPI` / `Sync import` are disabled until WebAPI is configured; `Clear import` and `Update settings` are enabled only after at least one import.

## What's new in 2.9.0
- Escape route directions refined: the checkered flag is now used only for the final step (assembly point when present).
- Escape route directions now include Google Maps coordinates for the assembly point.
- Escape route PDF layout updated: `Emergency card` moved to the end (after step-by-step directions), with updated additional guidance text for assembly-point follow-up and emergency-number reminder.

## What's new in 2.8.6
- Escape route PDF: added an `Emergency card` page with useful emergency numbers and configured assembly points.
- Escape route map/PDF: when an assembly point is configured on the destination floor, a dashed guidance line is drawn from the emergency exit to the assembly point.
- Escape route modal: added `Fullscreen` action for the route map.

## What's new in 2.8.5
- Doors: added new property `Esterno` in door settings to mark exits that lead outside the building.
- New `Via di fuga` flow from right-click menu on map, room, or corridor: computes the fastest route to the nearest door with both `Emergenza` and `Esterno` enabled.
- Multi-floor escape routing now enforces stairs-only transitions (elevators are excluded), while preserving corridor centerline path logic.
- Added dedicated `Via di fuga` modal with floor-by-floor navigation, direction arrow guidance, and step-by-step instructions.
- Added in-app PDF preview/export for escape routes, using the same multi-page capture approach as internal map export.

## What's new in 2.8.3
- Internal Map now supports direct in-room routes without corridors: if A and B are inside the same room, the route is a simple dashed A→B line.
- Fixed false `No corridors configured in the selected floor plan` in valid same-room scenarios.
- Direct in-room route rendering now hides orange door markers to keep the path clean and readable.
- In same-room scenarios, step-by-step directions are collapsed to a single message with the checkered-flag arrival icon.

## What's new in 2.8.2
- Internal Map PDF export from preview is now stable: clicking `Stampa / Salva PDF` no longer closes the modal and reliably starts the download.
- Added a redesigned step-by-step section with contextual SVG guidance icons (start traffic light, left/right turns, corridor, stairs/elevator, checkered finish).
- Refined the step list style by removing numeric badges and increasing icon size/definition for better readability.

## What's new in 2.8.1
- Internal Map route export now opens an in-app preview first; from there you can use `Stampa / Salva PDF` or `Chiudi` directly without popup windows.
- Fixed multi-floor route PDF rendering: exported pages now include the full floor plan background (not only corridors/rooms), with robust SVG/image inlining before capture.
- Removed the old `about:blank/blob` export dependency and inline-script path, improving compatibility with stricter CSP setups.

## What's new in 2.8.0
- Internal Map: multi-floor routing with corridor connection points, per-floor route segments, floor indicator, and `previous/next floor` arrows in the route result.
- Corridor inter-floor points: configurable transition type (`Stairs` / `Elevator`) and ETA penalties (`+15s` stairs, `+30s` elevator).
- Internal Map routing constraints: destination keeps the same Client/Site selected at start; only destination floor can change.
- Corridor routing refinement: when both A and B are inside corridors, path stays on corridor centerline and connects with final oblique access lines.
- Corridor inter-floor hover: tooltip now uses descriptive labels (no technical IDs) with connected floor names highlighted.
- Assembly point updates: Google Maps coordinates are managed under notes, shown as clickable links in the emergency directory, and available via right-click action `Open in Google Maps`.
- Multi-floor routing resilience: mixed corridor/non-corridor segments now use a walkable-corridor fallback to avoid false `Path not found` errors when floor connection points are valid.
- Internal Map export PDF: one page per route floor segment (`Start` / `Transit` / `Arrival`) plus final page with step-by-step directions.
- Mixed-route correction: when one endpoint is inside a corridor and the other is outside, routing now keeps the red path on corridor centerline and avoids door-to-connection jumps.
- Internal Map export now generates and downloads the PDF directly (no popup preview page), avoiding CSP issues with `about:blank/blob` windows.
- Safety card UX: removed static `+/-` buttons, added dedicated right-click menu (`Show/Hide`, `Emergency directory`), and safety-card helper toast is dismissed when selection changes.
- Corridor editing UX: middle mouse button now inserts junction points (replacing the contextual `+` button) and guide toast updated.
- Rooms: label rendering is clipped to room polygon/rect bounds so labels never overflow outside the room.
- Fix: `Duplicate floor plan` crash resolved (React hook order issue).
- Fix: object modal initialization stabilized to avoid input reset while editing fields (including camera name entry flow).

## Highlights
- Floor plan management starting from custom floor plan uploads, with a structured and centralized way to handle multiple clients, sites, and floor plans.
- Corporate asset/device management (PCs, telephony, users, workstations), including custom objects with user-configurable custom fields and advanced control via layers.
- PDF export and printing, with customizable print areas.
- Roles and permissions management for granular control of access and features.
- Creation and management of virtual offices and rooms.
- Wi‑Fi coverage and CCTV planning, with wall drawing and automatic signal attenuation calculations.
- Centralized client notes and documentation, easy to browse and consult.
- Internal messaging system with a dedicated interface.
- Real-user import via Web API and a centralized corporate directory.
- Rack configurator and structured cabling management.
- Corridor doors with room linking: right-click a door to link one or more rooms, with nearest-room preselection and door hover info for linked rooms.
- Internal map routing wizard: find a destination (users/devices/racks/rooms), set a start point, and compute a red orthogonal route through corridors and linked doors, with distance and ETA when scale is configured.
- Scaled measurements and dimensions directly on the floor plan.
- Fast object insertion and management via modern drag & drop, copy/paste, duplication, and extensive keyboard shortcuts.

## Safety and emergency
- Dedicated `Safety` layer with prevention/emergency object palette (extinguishers, AED, alarm points, sirens, hydrants, detectors, sprinklers, valves, first aid, etc.).
- Safety object modal with required name, description, notes, last check, verifier company, GPS coordinates.
- Safety documents and checks history in dedicated modals.
- Emergency contacts directory with scopes: `Global`, `Client`, `Site`, `Plan`.
- Emergency contacts support quick search, inline editing, sorting, and “Show in plan card” visibility flag.
- Safety settings panel includes catalogs for devices and emergency doors, with search/sort/export and map preview.
- Emergency/door verification history and revision details are tracked.

## Internal map routing
- 3-step internal map flow: `Partenza` -> `Destinazione` -> `Percorso`.
- Start and destination can be set by search or manual point on map.
- Route logic uses nearest doors + corridor centerline with orthogonal segments.
- Straight red corridor path + dashed start/end connectors.

## Locks
- A floor plan can be edited by only one user at a time (exclusive lock).
- The lock does not expire due to inactivity: it stays active until the owner saves or grants an unlock.
- Any user can request an unlock from the lock owner (optional message + takeover window 0.5..60 minutes). When granted, the lock is released immediately and reserved for the requester for the selected time.
- Superadmins can start a force unlock by setting a grace time (0..60 minutes). While the grace timer is running, the unlock buttons are disabled. When it ends, a 5-minute decision window starts where the superadmin can choose Save+unlock, Discard+unlock, or cancel the request. If it expires/cancels, the lock remains with the owner. If it completes, the superadmin takes the lock (or gets an hourglass reservation). Timers are shown as a seconds countdown.

## Customer chat
- WhatsApp Web-like dock with a 2-column layout: customer group chats on top, and user DMs below.
- You can DM only users that share at least one customer with you. If the shared customers are removed, the DM stays visible but becomes read-only.
- Groups show the customer logo (if available); you can toggle compact view and collapse/expand the Groups and Users sections.
- User DMs are ordered by last interaction; clicking a group jumps to the first unread message. Group messages do not show toast notifications.
- Unread messages show a badge; entering a chat marks it as read. DMs use WhatsApp-like checkmarks (sent/delivered/read).
- Messages support text + attachments (images/documents/videos, total max 5MB per message). Voice notes: up to 10 minutes.
- Images open in an in-app modal (with download). Chat export: TXT/JSON/HTML.
- You can block/unblock users (WhatsApp-like behavior). When blocked, messages stay with a single check while the block is active.

## Screenshots
### Rack editor
![Rack editor](docs/screenshots/rack-editor.png)

### Plan view
![Plan view](docs/screenshots/plan-view.png)

## Tech stack
- React + TypeScript (Vite), TailwindCSS, Zustand, react-konva
- Node.js + Express + SQLite (better-sqlite3)
- Export: jsPDF + html2canvas

## Architecture docs
- Technical architecture: `docs/ARCHITECTURE.md`
- Terminology reference: `docs/TERMINOLOGY.md`

## Quality and testing
```bash
# Type safety
npm run lint

# Unit checks (node:test)
npm run test

# Build validation
npm run build

# Release consistency check (package/readme/changelog version)
npm run release:check

# Full local quality gate
npm run quality:check
```

For runtime smoke validation against a running instance:
```bash
E2E_BASE_URL=http://127.0.0.1:8787 npm run test:e2e:smoke
```

Playwright scaffolding is available in `playwright.config.ts` + `e2e/`.
```bash
npm i -D @playwright/test
npx playwright install --with-deps
npm run test:e2e:playwright
```

## Quickstart
### Clone
```bash
git clone https://github.com/falott82/Plixmap.git
cd Plixmap
```

### Prerequisites
- Node.js 20+ (18+ should work)

### Development
```bash
npm install
npm run hooks:install

# Terminal 1 - API + SQLite
npm run dev:api

# Terminal 2 - Vite dev server
npm run dev -- --host 0.0.0.0 --port 5173
```

### Build
```bash
npm run build
```
Open `http://localhost:5173`

### Production
```bash
npm run build
npm start
```
Open `http://localhost:8787`

## Docker
```bash
docker compose up -d --build
```
Open `http://localhost:8787`

## First run
A default superadmin is created on first run:
- username: `superadmin`
- password: `deskly`

You are forced to change the password on first login.

## Environment variables
- `PORT` (default `8787`)
- `HOST` (default `0.0.0.0`)
- `PLIXMAP_DB_PATH` (default `data/plixmap.sqlite`)
- `PLIXMAP_AUTH_SECRET` (optional; recommended in production)
- `PLIXMAP_AUTH_SECRET_FILE` (optional path alternative to `PLIXMAP_AUTH_SECRET`)
- `PLIXMAP_DATA_SECRET` (optional; recommended in production)
- `PLIXMAP_DATA_SECRET_FILE` (optional path alternative to `PLIXMAP_DATA_SECRET`)
- `PLIXMAP_REQUIRE_ENV_SECRETS` (optional, `1/true` to require secrets from env/file and fail fast if missing)
- `PLIXMAP_SECRET_MIN_LENGTH` (optional, default `32`)
- `PLIXMAP_BACKUP_DIR` (optional, default `data/backups`)
- `PLIXMAP_BACKUP_KEEP` (optional, default `20`)
- `PLIXMAP_CSP_ALLOW_MEDIAPIPE` (optional, default `false`; enables jsdelivr/storage + wasm/eval allowances)
- `PLIXMAP_CSP_ALLOW_EVAL` (optional, default `false`; enables `unsafe-eval`/`wasm-unsafe-eval`)

## Storage notes
- SQLite DB and uploads live in `./data` (or `PLIXMAP_DB_PATH`).
- Floor plan images, client logos, and PDFs are stored on disk and referenced by URL.
- Database backups are stored in `PLIXMAP_BACKUP_DIR` (default `./data/backups`).

## Operations
- Create backup from CLI: `npm run backup:db`
- API liveness probe: `GET /api/health/live`
- API readiness probe: `GET /api/health/ready`

## LAN access
- Dev: `http://<YOUR_PC_IP>:5173`
- Prod: `http://<YOUR_PC_IP>:8787`

All users on the LAN share the same SQLite data on the server machine.
