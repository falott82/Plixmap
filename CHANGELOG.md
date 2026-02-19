# Changelog

All notable changes are listed here in reverse chronological order.

## 3.0.3 - 2026-02-19
- Documentation refresh: expanded `README.md` screenshot gallery with new workflow captures for workspace, internal map route, escape route modal, and escape route PDF preview.
- Release alignment: bumped project version references to `3.0.3` across package metadata and release history.
- Branding/UI links: top-left sidebar logo now opens `www.plixmap.com`; login and Donations areas now include an explicit website reference.
- Donations/support links aligned to the new PayPal URL: `https://www.paypal.com/paypalme/falott82`.
- Governance/docs: added `MIT` license, plus README sections for open-source licensing, free usage terms, voluntary support, disclaimer, and GitHub issue/PR reporting flow.

## 3.0.2 - 2026-02-19
- First setup: renamed seed client from `ACME` to `PlayGround`.
- First setup: post-login prompt now explains that the visible customer is an example customer and can be removed from `Settings > Clients`.
- Clients settings: added an explicit example badge (`cliente di esempio` / `example client`) next to the seed customer name.
- WiFi antenna custom mode: `Model` is no longer required.
- Rooms and corridors: added optional English names and localized map label rendering (`IT/EN`).
- Documentation cleanup: moved release notes out of `README.md`, linked this file from README, and added superadmin password recovery instructions for Docker and npm deployments.

## 3.0.1
- Repository hygiene/security: removed historical `data/` runtime artifacts from Git history (SQLite DB/WAL/SHM, uploads, backups).
- Added sensitive-data guard script (`npm run sensitive:check`) and wired it into CI quality gate.
- Added versioned pre-commit hook (`.githooks/pre-commit`) to block staged SQLite/backup/upload files and likely plaintext SMTP/WebAPI/import secrets.
- Hardened ignore rules so operational instance data under `data/` remains local-only (`data/.gitkeep` excluded).

## 3.0.0
- Brand migration step 2 completed: project identity is now Plixmap across runtime/UI/PWA assets.
- Session/CSRF/runtime keys are now standardized on `plixmap_*` (legacy Deskly fallbacks removed in active paths).
- Runtime cache/export/log prefixes updated from Deskly to Plixmap (files, CSV/PDF exports, service-worker caches, logger scope).
- Backup workspace export now uses `plixmap-workspace` kind (import still accepts legacy `deskly-workspace`).
- Login and sidebar now use the new PNG logo (`public/plixmap-logo.png`) with favicon/PWA icon alignment.

## 2.9.5
- Rooms: improved label rendering so newly created room labels stay inside room bounds and auto-wrap better without manual shrinking.
- Rooms: refined room label panel spacing and adaptive text layout for clearer readability across narrow/small rooms.
- Keyboard UX: pressing `R` on the map now opens the room-creation mode modal.
- Keyboard UX in room-creation modal: press `R` to start `Rectangle` room drawing or `P` to start `Polygon` room drawing.
- Room creation modal copy/UI refreshed with explicit keyboard hints (`R`/`P`) for faster workflow.

## 2.9.3
- Layers: fixed `Real user` visibility so it no longer depends on generic user visibility; real users now resolve their dedicated layer mapping correctly.
- Layers: fixed `Show all` behavior when disabling `Rooms`; rooms now disappear correctly from the map instead of staying visible.
- Layer routing audit: normalized layer resolution now consistently handles legacy `real_user` objects created with old default layer assignments.
- Reliability: added server-side atomic SQLite backups (`sqlite backup`) with retention policy and downloadable backup list in `Settings -> Backup`.
- Reliability: added health probes (`/api/health/live`, `/api/health/ready`) and DB migration status endpoint (`/api/settings/db/migrations`).
- Security: secrets hardening with support for `*_FILE` env vars and optional strict mode `PLIXMAP_REQUIRE_ENV_SECRETS=1`.
- Security: CSP is now stricter by default; MediaPipe/eval allowances are opt-in via env flags.
- Performance: PlanView now lazy-loads heavy routing/gallery modals; CanvasStage now uses `FastLayer` for static background and viewport culling for offscreen objects.
- Security hardening on export stack: removed `exceljs` and migrated table export to Excel-compatible SpreadsheetML (`.xls`) to eliminate runtime dependency chain vulnerabilities (`archiver/minimatch`).

## 2.9.1
- Added `connecting doors between rooms`: select Room A + Room B, right-click a selected room, and use `Create connecting door`; placement is allowed only on an overlapping shared side.
- Added full editing flow for room-connection doors: dedicated marker on map, right-click menu, double-click to edit door properties, and delete action.
- Routing engine update (Internal Map + Escape Route): room-door connectors are now considered when start/end points are inside rooms not directly facing a corridor.
- Route persistence/revisions/clone now include room-connection doors to keep behavior consistent across save, restore, duplicate, and history operations.
- Layers UX: fixed `Show all` + single-layer toggles so disabling one layer correctly hides its items.
- User directory: `Export PDF` now opens a column-selection modal before generating the final document.
- Link editing: fixed modal state reset while typing, so link names/descriptions can be edited without input being overwritten.
- Safety panel: removed `Door ID` from the emergency-doors table and CSV export.
- WebAPI import modal: moved settings gear into the helper message, removed the top-right settings button, and added guards so `Test WebAPI` / `Sync import` are disabled until WebAPI is configured; `Clear import` and `Update settings` are enabled only after at least one import.

## 2.9.0
- Escape route directions refined: the checkered flag is now used only for the final step (assembly point when present).
- Escape route directions now include Google Maps coordinates for the assembly point.
- Escape route PDF layout updated: `Emergency card` moved to the end (after step-by-step directions), with updated additional guidance text for assembly-point follow-up and emergency-number reminder.

## 2.8.6
- Escape route PDF: added an `Emergency card` page with useful emergency numbers and configured assembly points.
- Escape route map/PDF: when an assembly point is configured on the destination floor, a dashed guidance line is drawn from the emergency exit to the assembly point.
- Escape route modal: added `Fullscreen` action for the route map.

## 2.8.5
- Doors: added new property `Esterno` in door settings to mark exits that lead outside the building.
- New `Via di fuga` flow from right-click menu on map, room, or corridor: computes the fastest route to the nearest door with both `Emergenza` and `Esterno` enabled.
- Multi-floor escape routing now enforces stairs-only transitions (elevators are excluded), while preserving corridor centerline path logic.
- Added dedicated `Via di fuga` modal with floor-by-floor navigation, direction arrow guidance, and step-by-step instructions.
- Added in-app PDF preview/export for escape routes, using the same multi-page capture approach as internal map export.

## 2.8.3
- Internal Map now supports direct in-room routes without corridors: if A and B are inside the same room, the route is a simple dashed A->B line.
- Fixed false `No corridors configured in the selected floor plan` in valid same-room scenarios.
- Direct in-room route rendering now hides orange door markers to keep the path clean and readable.
- In same-room scenarios, step-by-step directions are collapsed to a single message with the checkered-flag arrival icon.

## 2.8.2
- Internal Map PDF export from preview is now stable: clicking `Stampa / Salva PDF` no longer closes the modal and reliably starts the download.
- Added a redesigned step-by-step section with contextual SVG guidance icons (start traffic light, left/right turns, corridor, stairs/elevator, checkered finish).
- Refined the step list style by removing numeric badges and increasing icon size/definition for better readability.

## 2.8.1
- Internal Map route export now opens an in-app preview first; from there you can use `Stampa / Salva PDF` or `Chiudi` directly without popup windows.
- Fixed multi-floor route PDF rendering: exported pages now include the full floor plan background (not only corridors/rooms), with robust SVG/image inlining before capture.
- Removed the old `about:blank/blob` export dependency and inline-script path, improving compatibility with stricter CSP setups.

## 2.8.0
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
