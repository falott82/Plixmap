# Changelog

All notable changes are listed here in reverse chronological order.

## 3.6.3 - 2026-03-18
- Meeting notes close-confirm dialog now supports a third explicit path: `Continue without saving`, preventing save/cancel loops when exiting with unsaved edits.
- Client notes now support OpenAI text actions on selected text (`Translate selection`, `Correct selection`) with backend validation and client-scope access checks.
- Added keyboard shortcuts for AI note actions on both meeting and client notes: `Cmd/Ctrl+Shift+C` (correct) and `Cmd/Ctrl+Shift+T` (translate).
- Updated in-app Help and README documentation for the new note workflows and shortcuts.
- Security maintenance: upgraded `jspdf` to `^4.2.1` to address newly reported critical advisories.
- MegaUpdate evidence: `npm audit` (runtime and full), `sensitive:check`, lint, tests, build, and release version checks all succeeded.

## 3.6.2 - 2026-03-17
- Security hardening on the build supply chain: forced `@rollup/plugin-terser@1.0.0` and `serialize-javascript@7.0.4`, removing high-severity `npm audit` findings in the PWA/workbox dependency path.
- Website security headers upgraded with a strict server-side `Content-Security-Policy` in `.htaccess`, allowing only local scripts plus explicit SHA-256 hashes for inline JSON-LD blocks.
- Re-ran full validation after hardening (`npm audit`, lint, tests, build), confirming stable release behavior for 3.6.2.

## 3.6.0 - 2026-03-12
- Removed all residual presentation-webcam gesture paths: deleted the dedicated webcam hook, related UI store fields/setters, PlanView webcam prompt/assistant flow, and CanvasStage webcam/calibration controls.
- Simplified presentation behavior by keeping only fullscreen presentation toggling and removing dead conditional branches tied to webcam-specific onboarding and calibration.
- Ran a full MegaUpdate verification pass with evidence: `quality:check` succeeded end-to-end and `npm audit --omit=dev --audit-level=high` reported `0` vulnerabilities.

## 3.5.9 - 2026-03-12
- Reworked object-layer selection UX in `ObjectModal`: by default it now shows only the primary layer, while full multi-layer selection is available by clicking the layer chip itself or the dedicated `+ More` control.
- Hardened object-layer assignment logic: selected IDs are normalized against currently available layers and the editor now preserves at least one selected layer to avoid invalid empty states.
- Stabilized presentation webcam flows after React 19 migration by making webcam/calibration setters and teardown paths idempotent, reducing redundant updates that could trigger runtime React `#185` loops in production bundles.

## 3.5.6 - 2026-03-09
- Hardened WebAPI import reliability for both users and devices: `Test` and `Preview/Compare` now use the live configuration shown in the modal (URL/username/method/body/password override) instead of relying only on the last saved backend copy.
- Refined the shared import transport for unstable local-network environments: direct-IP connection after URL validation, no shared agent/pool, retry in a fresh child Node process, and final `curl` fallback when the long-lived backend hits transient reachability errors such as `EHOSTUNREACH`.
- Preserved security guarantees while improving resilience: credentials are still never embedded in URLs, saved passwords remain encrypted at rest, and the fallback subprocess paths pass secrets through `stdin` instead of command-line arguments.
- Expanded regression coverage for custom import with tests on live-config merging, resolved-address handling, and the strengthened transport behavior used by WebAPI employee/device imports.
- Applied a final UX/documentation pass on the import section with more explicit password-field browser hints and synchronized release notes across app documentation and website.

## 3.5.5 - 2026-03-09
- Added read-only LDAP user import with configurable server/authentication/base-DN/filter/attribute mapping, explicit connection testing, comparison against the local container by email, and selective import of only chosen users.
- LDAP import UX is now multi-step and more controllable: compare runs in a dedicated modal, import opens a second selection modal, incomplete LDAP rows can be completed manually before import, and imported users can now be edited locally after synchronization.
- Hardened LDAP persistence and normalization: fixed the config-store field ordering bug that could corrupt saved LDAP settings such as `Base DN`/password state, normalized imported/local user fields more consistently (uppercase names/roles/departments, lowercase email, compact phone), and kept LDAP strictly read-only (`bind/search/unbind` only).
- Improved operator guidance with more explicit tooltips and a focus-safe LDAP guide modal that explains every configuration field and the meaning of filter/mapping/limit settings.
- Ran a broader release pass for code quality, security, translations, and tooltip coverage, with updated regression tests for LDAP config storage, LDAP import overrides, and imported-user local editing.

## 3.5.4 - 2026-03-08
- Centralized runtime server config in `server/config.cjs`: defaults, parsing, env normalization, and security-sensitive booleans now come from one source of truth, with strict validation and preserved `PORT=0` support for ephemeral binds.
- Continued backend modularization: extracted auth/MFA, admin settings, meeting public/notes/lifecycle routes, custom import network/config-store modules, and state-save guards to reduce risk in the monolithic server bootstrap.
- Hardened meetings/import flows: lifecycle updates now reject missing participant emails when notifications are enabled, cancel/update operations emit consistent global audit events, and custom import now blocks IPv4-mapped loopback targets and enforces byte limits more predictably.
- Refined PlanView/meeting UX internals: kiosk, room measures, room layout export, and duplicate/follow-up scheduling are split into dedicated modules; duplicate scheduling now uses local-day logic and invalid custom time windows no longer fall back to midnight.
- Added focused regression coverage across server config, auth/settings routes, meeting lifecycle/public flows, local-date handling, custom time parsing, custom import, chat services, and writable-plan state-save guards.

## 3.5.3 - 2026-03-07
- Provisioning from imported users is now safer and more deterministic: invite links use a centralized public portal URL source (`Settings > Email > Portal public URL`, with `PUBLIC_APP_URL` as fallback), user creation is wrapped in a DB transaction, and linked imported-user uniqueness is enforced at database level.
- Meeting visibility correctness improved for admin/superadmin flows: `/api/meetings/mine` now applies date filters before `LIMIT`, avoiding silent omissions on larger datasets.
- SSOT/DRY refactor continued across meetings and runtime URLs: shared frontend meeting-time helpers now drive mobile agenda badges, `My meetings`, follow-up timelines, sidebar/PlanView meeting timelines, and shared server public URL builders now cover kiosk/mobile/public-upload links from one place.
- Added focused regression coverage for the new shared rules: `scripts/ssot-dry-users-email.test.cjs` and `scripts/public-urls.test.cjs`.
- Documentation updated to reflect the new `Portal public URL` setting and the shared architecture modules introduced in this release.

## 3.5.2 - 2026-03-07
- Site hours management expanded: dedicated schedule modal from site context menu, weekly multi-range editing, separate holidays/closures modal, named holidays, support for applying hours to other sites of the same client, and selectable holiday calendars (`Italy`, `United States`, `United Kingdom`, `Germany`, `France`, `Spain`, `China`, `Saudi Arabia`, `United Arab Emirates`, or manual only).
- Meeting scheduling now uses site hours as the default suggested maximum end time for a meeting room, while still allowing admins/users to extend beyond site hours explicitly when needed.
- Mobile app chat startup and thread opening were accelerated with a dedicated mobile overview endpoint/caching flow; fixed repeated `/messages`, `/read`, and `/mobile/overview` request loops on mobile.
- Superadmin permissions aligned across backend/frontend: superadmins can again see the full users list and all meetings consistently, including `GET /api/meetings`, `GET /api/meetings/mine`, and related admin-only screens.
- Internal routing/escape path reliability improved: room-to-corridor doors now also work through geometric inference when the explicit saved link is missing (fixing cases like `Sales Office`), and the related PlanView runtime crash caused by helper initialization order was removed.
- Import/device modal UX hardened: nested configuration/import dialogs now keep correct focus and z-order, parent dialogs no longer close unexpectedly, and `Imported devices` now shows an explicit empty-state message when a client has no imported devices.
- Server refactor continued: extracted shared access helpers plus `users`, `chat`, `meetings`, `realtime`, admin logs, object-type requests, and static app serving from the monolithic server file to reduce maintenance risk.

## 3.5.1 - 2026-03-06
- Meeting manager modal reworked with clearer tab flow (`Topics and Summary`, `Actions`, `Timeline`, `Notes`) and improved nested-modal close behavior (closing a child returns to its parent modal instead of closing everything).
- Actions moved to a table-first workflow with a dedicated `Manage` modal per row: progress slider (0..100 step 5), deadline controls, `Not needed`/delete actions, and status-driven row coloring.
- Added save-time guards for data quality: notes now require a title, and task rows containing payload cannot be saved without a task title.
- Timeline/follow-up UX refined: `Create Follow-UP` entry promoted, future scheduled meetings now expose a gear menu (`Edit`/`Delete`), and chain insights are available from `My meetings`.
- PDF export flow enhanced with a report review modal, richer participant/task sections (including completion percentages and not-needed/completed rows), plus completion charts/statistics in the final report.
- Localization/UX polish pass on meeting modals: fixed mixed IT/EN labels, aligned tooltip coverage on key actions, and improved task deadline datepicker interaction.

## 3.4.1 - 2026-02-27
- Meeting center UX rework in PlanView: the green meeting button now opens a dedicated modal with two entry points: `Scheduling` and `My meetings`.
- Scheduling flow now opens the same client/site `Show meetings` timeline used in sidebar context menus, preserving the existing `+ New meeting` action from that screen.
- Added `My meetings` view for the logged-in user with past/current/future meetings, counters, and quick actions to open details or jump to scheduling.
- Meeting notes access tightened server-side: only meeting participants can read/write/export/AI-transform notes (admins/superadmins still allowed).
- Mobile app startup optimization: `/mobile` no longer waits for full `/api/state` hydration, removing the main 5-6s bottleneck seen during login bootstrap.

## 3.4.0 - 2026-02-26
- Mobile app: improved initial loading and sync behavior by reducing overlapping requests, tightening polling cadence, and avoiding stale UI updates during agenda/chat refreshes.
- Mobile app: reworked chat UX with WhatsApp-like chat list ordering/preview, thread-first navigation (`list -> thread`), sticky header, fixed composer, unread dot updates, and better scrolling on small screens/notch devices.
- Mobile app: added richer meeting detail view with participant list and check-in actions, plus improved QR/check-in flows and synchronized state feedback across devices.
- Mobile app: voice notes support (record/playback), safer audio loading (`preload=none`), microphone permission handling, and layout fixes to keep the page shell fixed while scrolling only content.
- Meetings timeline: duplicate-meeting calendar stabilized (fixed modal focus/click-through and loading loops), improved room timeline styling (`NOW` marker, sticky room column), and room availability visual refinements.
- Import users (client-scoped): UI reworked for clearer WebAPI diff/import workflows, better imported-users table readability, and additional duplicate checks/normalization improvements.
- Refactor/cleanup: removed unused code, improved timestamp parsing robustness, and reduced duplicated import preview/diff mapping/search logic while preserving behavior.

## 3.3.0 - 2026-02-25
- Meetings: introduced a full meeting-room management workflow with room timelines (`Mostra meetings`), room-level scheduling, quick actions, and multi-day edit support.
- Meetings/Kiosk: added kiosk mode for meeting rooms (tablet/web), synchronized check-in (server-side), meeting progress, support/help requests, and room service/equipment visibility.
- Meetings: check-in reporting is now available in meeting details with timestamps, logos, and participant/guest breakdowns.
- Meetings: participant management improved with conflict warnings, remote/optional flags, business-partner integration for external guests, and richer edit workflows.
- SMTP: customer-specific SMTP configuration added (generic portal SMTP remains for generic portal communications); meeting/help notifications now require customer SMTP when client-scoped.
- Real users import: client-scoped import management reworked (WebAPI / CSV / Manual), WebAPI preview/diff with add/update/remove actions, duplicate detection, and better missing/hidden user handling.
- Capacity / placement: multiple refinements to placement suggestions, room metadata, and meeting-room aware workflows.
- UX/stability: several fixes for nested modals, focus management, kiosk fullscreen startup, and meeting timeline rendering/status colors.

## 3.1.2 - 2026-02-20
- `Find placement`: opening from client/site context menu now keeps the current floor plan instead of auto-switching to another one.
- `Capacity dashboard`: removed unstable PDF export and reworked the modal layout to avoid main vertical scrolling.
- `Capacity dashboard`: selected floor plans are now shown in a horizontal scrolling strip at the bottom.
- Selection hint toaster: fixed persistence after right-click on an already selected object.

## 3.1.1 - 2026-02-20
- Capacity dashboard PDF export now preserves combobox values correctly (no clipped text in `Client/Site/Floor plan` filters).
- Capacity dashboard PDF export pagination refined to avoid empty trailing pages and keep field blocks intact.
- Capacity dashboard UI now includes larger floor-plan detail cards with dedicated gauges for each floor plan.

## 3.1.0 - 2026-02-20
- Added `Capacity dashboard` in PlanView rooms menu with aggregated metrics across client/site/floor: total capacity, occupancy, room saturation, density (`users/mq`, `mq/user`), and over-capacity indicators.
- Added historical capacity trend chart by site, backed by server snapshots persisted in `app_settings` (`capacityHistoryV1`).
- Added backend capacity APIs:
  - `GET /api/capacity/history` (RBAC-filtered visibility)
  - `POST /api/capacity/snapshot` (superadmin-only, rate-limited)
- Reworked `Trova capienza` into a guided `Trova sistemazione` flow:
  - selection by `client -> site -> department`
  - requested headcount input
  - progressive fallback to empty offices and cross-department offices when no direct match exists
- Extended room model with department tags (`room.departmentTags`) and added room-modal UX to assign one or more departments, with suggestions sourced from imported real-user departments.
- Added technical documentation: `docs/CAPACITY_WORKFLOW.md`.

## 3.0.4 - 2026-02-20
- Update check UX moved from `Settings > Account` to the user menu (`Superadmin`) with a dedicated modal.
- Update checks are now enforced as superadmin-only also on backend API (`GET /api/update/latest` returns `403` for non-superadmin users).
- Added resilient update manifest resolution with fallback to raw GitHub manifest when `www.plixmap.com/updates/latest.json` is temporarily unavailable.
- Update modal now includes explicit safe-upgrade guidance and technical notes about migration behavior and data preservation.
- Security patch: upgraded `jspdf` to `4.2.0` to address known advisories.
- Release metadata aligned to version `3.0.4`.

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
