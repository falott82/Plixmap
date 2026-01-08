# Deskly — Floor Plan Management (Drag & Drop)

Current version: **1.4.12**

Deskly is a modern web app to manage company floor plans using a fixed hierarchy **Client → Site → Floor plan**, with draggable objects, logical rooms, saved views, revision history, search/highlight, and PDF exports.

The UI supports **Italian and English**. When you change language from the user menu, the app performs a full refresh to ensure every screen (including tooltips/modals) is consistently translated.

## Tech Stack
- **Frontend:** React + TypeScript (Vite), TailwindCSS, Zustand, react-konva, lucide-react
- **Export:** jsPDF + html2canvas
- **Backend:** Node.js + Express + SQLite (better-sqlite3), cookie-based sessions (HttpOnly)

## Core Data Model (high level)
- `Client { id, shortName, name, address?, phone?, email?, vatId?, pecEmail?, description?, logoUrl?, attachments?[], sites[] }`
- `Site { id, clientId, name, coords?, floorPlans[] }` where `coords` is an optional `lat, lng` string
- `FloorPlan { id, siteId, name, imageUrl, width?, height?, printArea?, objects[], rooms?, views?, revisions? }`
- `MapObject { id, type, name, description?, x, y, scale?, roomId? }`
- `Room { id, name, color?, kind: 'rect'|'poly', ... }` (rectangles and polygons supported)
- `FloorPlanView { id, name, description?, zoom, pan, isDefault? }`
- `FloorPlanRevision { id, createdAt, revMajor, revMinor, name, description?, imageUrl, objects, rooms?, views? }`

## Authentication & Roles
### First run (bootstrap)
On the very first run, Deskly creates **one** default superadmin:
- **username:** `superadmin`
- **password:** `deskly`

On first login you are **forced to change the password** and choose the UI language (IT/EN). The initial credentials are shown on the login page **only during first-run**; after the password change they are never shown again.
After the first password change, Deskly shows a confirmation prompt (in the chosen language) and can take you directly to the **Users** tab to create additional accounts.

### Password policy
New passwords must be **strong**:
- at least 8 characters
- at least 1 uppercase letter
- at least 1 lowercase letter
- at least 1 number
- at least 1 symbol

### Roles
- **Superadmin:** full access + can create admin users + can view audit logs (login/logout attempts)
- **Admin:** full read/write access to all data (no per-scope permissions required)
- **User:** can be granted **read-only** or **read/write** access per Client / Site / Floor plan

## Main Features
### Realtime collaboration (safe editing)
- **Exclusive lock per floor plan**: only one user can edit a floor plan at a time (prevents conflicts).
- **Presence**: shows who is currently online on the same floor plan.
- If a floor plan is locked by someone else, it opens in **read-only** automatically.

### Navigation
- Tree sidebar with fixed hierarchy **Client → Site → Floor plan**
- Quick search in the sidebar (filters clients/sites/floor plans by name)
- Per-user client ordering (drag & drop clients); ordering is saved on the user profile
- The default **ACME** demo client shows a small info badge in the sidebar; you can keep it for testing or remove it safely.

### Settings (Admin / Superadmin)
- CRUD for **Clients**, **Sites**, **Floor plans**
- Client details: short name (shown in workspace), full legal name, address, VAT/PEC, phone, email, description
- Client notes: right-click a client in the sidebar and open **Client notes** to write formatted documentation (text, images, tables) — powered by **Lexical** for Word-like stability; supports **multiple notes per client** (titles, create/delete, search); editable by admins and by users with **read/write** permission on that client; includes **Export PDF** and **PDF attachments management**
  - Client notes modal uses the full available height for easier reading
- Client logo upload (auto-resized)
- Client PDF attachments upload:
  - download
  - open in a new browser tab
- Site optional coordinates (`lat, lng`) with **Google Maps** link
- Floor plan image upload (JPG/PNG only), replace image with automatic archival as a revision
- Object types management (custom types + icon mapping), updating type/icon updates all objects
- Object requests:
  - users can submit a **request** with custom fields and icon
  - superadmin receives a pending prompt and manages approvals in a dedicated modal
  - approved requests become immediately available in the object list
- New objects default to a 0.50 scale on placement
- Workspace backup:
  - **Export JSON workspace** (optionally embed images/attachments)
  - **Import JSON workspace** (replace workspace on this server)
  - **Export Excel** workbook (object types, clients, sites, floor plans, layers, rooms, views, objects)
- User management:
  - create/edit/disable users
  - language per user
  - CSV/Excel-style export of the users table
- Superadmin only:
  - logs: login/logout + failed attempts, plus an **audit trail** of important events (optional Extended mode)
  - Nerd Area: packages and versions used by the app
  - Nerd Area: **Performance telemetry** toggle (local-only diagnostics panel)
  - Nerd Area: **Custom Import (Real users)** with a per-client status table, quick actions, and WebAPI/CSV configuration
- Settings modals dim the background to keep focus on the active form
- Settings tabs persist on refresh via the `?tab=` URL parameter

### Workspace (Floor plan)
- Floor plan shown as background; objects rendered on top with an icon and always-visible label
- Add objects via palette or context menu (type → name required, description optional)
- The palette can be customized per user (enabled objects + ordering) from **Settings → Objects**
- If a user has an empty palette, a quick CTA is shown to open **Settings → Objects** and add items
- The context menu works across the whole workspace area (even outside the visible plan image)
- Always-visible “Saved/Unsaved” indicator to track local changes
- Select / multi-select:
  - click to select
  - Ctrl/⌘ to multi-select
  - Ctrl/⌘ + A selects all objects in the floor plan
  - left-drag on an empty area to box-select (desktop-like)
  - Esc clears selection
  - Arrow keys nudge selected objects
  - Delete key opens a confirm dialog (Enter confirms, Esc cancels)
- Quick edit (multi-selection):
  - the top pencil opens a list that includes selected objects and the links between them
  - you can apply the same scale to all selected objects from the list
- Object operations (right click / context menu):
  - edit name/description
  - duplicate (asks for new name/description; placed next to original)
  - scale per object (slider)
  - delete
- Real users (optional):
  - once a client has imported users (WebAPI or CSV), a **Real user** object is available in the palette
  - dropping it opens a picker **scoped to the active Client** (client name + counts are shown), with search and filters
  - keyboard navigation: arrows to move, Enter to insert
  - the label shows first name and last name on two lines
- Pan & zoom:
  - zoom controls (+ / -)
  - pan the map (background + objects move together) using the **middle mouse button** or **Cmd/Alt + right-click**
  - viewport is persisted per floor plan (reload-safe)
- Layers, grid and links:
  - assign objects to one or more **layers** and toggle visibility (work by “layers”)
  - quick “Map only” toggle hides all layers (restores on reload)
  - optional **grid overlay** and configurable **grid snapping**
  - create **links** (arrows) between objects from the context menu
  - **double-click a link** to edit name/description and style (**color / width / dashed**)
- Rooms:
  - create **rectangle** or **polygon** rooms
  - resize/edit room shape
  - set a per-room color (helps visually separate areas)
  - adjust room label scale (name + capacity)
  - room modal tabs for Info, Users, Objects, Notes
  - rooms cannot overlap
  - objects inside the room are automatically linked
  - room list with assigned objects and quick highlight
  - placing a user in a full room asks for confirmation
- Rack management:
  - open racks from the map to manage **rack units** and devices
  - drag devices into the rack, choose unit size, move with arrow keys
  - drag a device onto another device with the same U size to swap positions
  - configure devices with host/IP, ports, power options, and notes
  - passive devices include **Passacavo**; Misc devices can be given a custom name
  - port configuration per device (switch/patch panel/optical drawer) with 1:1 links
  - link speeds: 100M/1G (copper) and 1G/10G/25G (fiber)
  - search inside the rack by **host name** or **device type**
  - delete single devices (with confirmation) or delete all devices
  - export a **portrait PDF** with rack name and notes
- Search:
  - search objects (name/description) and rooms (name)
  - highlight/blink the selected item on the map
  - if multiple results exist, you can choose which one to focus
  - keyboard navigation (arrows + Enter) inside results
- Views:
  - save the current viewport as a named view (with description)
  - mark one view as default (only one default)
  - views dropdown + context menu integration
- Revisions (“Time Machine”):
  - save immutable revisions (read-only history)
  - revision numbering **Rev: X.Y** with Major/Minor bump
  - **Cmd/Ctrl+S** creates a quick minor revision
  - restore revisions, compare revisions, delete a revision, delete all revisions
  - when saving, you can add a note
- Export:
  - export **plan-only** PDF (background only: no UI, no toolbars)
  - optional per-floor-plan **print area** (rectangle)
  - PDF options include orientation, clickable index (when exporting multiple plans), and a quality/size slider
  - export the changelog to PDF

## Custom Fields (per user)
Deskly supports **per-user custom fields** for objects:
- Define fields per object type in **Settings → Objects** (right-click an enabled object type)
- Field types: **Text**, **Number**, **Boolean**
- Values are stored **per user and per object** (not shared with other users)

### PWA (optional)
Deskly is a Progressive Web App:
- can be installed on supported browsers
- caches static assets and previously visited floor plan images (`/uploads`, `/seed`) for faster reloads

### Google Maps integration
- If a Site has valid coordinates (`lat, lng`):
  - a Google Maps icon appears in Settings
  - right-click on the Site name in the workspace tree shows **“View in Google Maps”**
  - right-click on a Floor plan also shows **“View in Google Maps”** (it uses the parent Site coordinates)

## Installation & Running

### Prerequisites (all OS)
- **Node.js 20+** recommended (Node 18+ should also work for this project)
- npm (bundled with Node.js)

### macOS
1) Install Node.js (recommended via Homebrew):
```bash
brew install node
```
2) Install dependencies:
```bash
npm install
```
3) Development (two processes):
```bash
# Terminal 1 — API + SQLite + auth
npm run dev:api

# Terminal 2 — Vite dev server
npm run dev -- --host 0.0.0.0 --port 5173
```
Open `http://localhost:5173`

4) Production-like (single server: API + built UI):
```bash
npm run build
npm start
```
Open `http://localhost:8787`

### Linux
1) Install Node.js (example with nvm):
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```
2) Install and run (same commands as macOS):
```bash
npm install
npm run dev:api
npm run dev -- --host 0.0.0.0 --port 5173
```
Or production:
```bash
npm run build
npm start
```

### Windows
1) Install Node.js 20+ from https://nodejs.org (LTS)
2) Open PowerShell in the project folder and run:
```powershell
npm install
npm run dev:api
npm run dev -- --host 0.0.0.0 --port 5173
```
Or production:
```powershell
npm run build
npm start
```

## Running in LAN
### Development (Vite)
Run Vite with `--host 0.0.0.0` and open from another machine:
- `http://<YOUR_PC_IP>:5173`

### Production (Node server)
The server binds to `0.0.0.0` by default and exposes:
- `http://<YOUR_PC_IP>:8787`

All users on the LAN will see the **same data**, because the backend persists state in SQLite on the server machine.

## Docker
Deskly ships with a Dockerfile and a docker-compose configuration.

Build and run:
```bash
docker compose up --build
```
Open:
- `http://localhost:8787`
- or from LAN: `http://<HOST_IP>:8787`

Data persistence:
- SQLite DB and uploaded assets are stored under `./data` (mapped as a volume in Docker Compose).

## Environment Variables
- `PORT` (default `8787`)
- `HOST` (default `0.0.0.0`)
- `DESKLY_DB_PATH` (default `data/deskly.sqlite`)
- `DESKLY_AUTH_SECRET` (optional, recommended in production): signing secret for sessions; if not provided, it is stored in DB in production mode

## Notes on Storage
- Floor plan images, client logos and PDF attachments are stored on the server and referenced by URL (to keep the JSON state small).
- Passwords are stored using **scrypt** (salted hash). Sessions are stored in an **HttpOnly** cookie.

## Security
- Dependabot is enabled: `.github/dependabot.yml`
- GitHub Action runs `npm audit --omit=dev`: `.github/workflows/security-audit.yml`
- Recommended before releasing (local/npm):
```bash
npm audit --omit=dev --audit-level=high
```
- Or via npm script:
```bash
npm run audit:prod
```
- If running via Docker:
```bash
docker compose exec deskly npm audit --omit=dev --audit-level=high
```
- Users: create accounts, import permissions from an existing user, and manage access; superadmin is highlighted and cannot be disabled.
- Users list shows the account creation timestamp to help auditing and onboarding.
- Objects: superadmin can create **custom object types** (name + icon). Any user can submit a **creation request** (with custom fields); requests are managed in a dedicated modal where the superadmin can approve/reject with a reason, and the requester sees the status with timestamps.
