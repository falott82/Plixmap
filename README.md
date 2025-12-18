# Deskly — Floor Plan Management (Drag & Drop)

Deskly is a modern web app to manage company floor plans using a fixed hierarchy **Client → Site → Floor plan**, with draggable objects, logical rooms, saved views, revision history, search/highlight, and PDF exports.

The UI supports **Italian and English**. When you change language from the user menu, the app performs a full refresh to ensure every screen (including tooltips/modals) is consistently translated.

## Tech Stack
- **Frontend:** React + TypeScript (Vite), TailwindCSS, Zustand, react-konva, lucide-react
- **Export:** jsPDF + html2canvas
- **Backend:** Node.js + Express + SQLite (better-sqlite3), cookie-based sessions (HttpOnly)

## Core Data Model (high level)
- `Client { id, shortName, name, address?, phone?, email?, vatId?, pecEmail?, description?, logoUrl?, attachments?[], sites[] }`
- `Site { id, clientId, name, coords?, floorPlans[] }` where `coords` is an optional `lat, lng` string
- `FloorPlan { id, siteId, name, imageUrl, width?, height?, objects[], rooms?, views?, revisions? }`
- `MapObject { id, type, name, description?, x, y, scale?, roomId? }`
- `Room { id, name, kind: 'rect'|'poly', ... }` (rectangles and polygons supported)
- `FloorPlanView { id, name, description?, zoom, pan, isDefault? }`
- `FloorPlanRevision { id, createdAt, revMajor, revMinor, name, description?, imageUrl, objects, rooms?, views? }`

## Authentication & Roles
### First run (bootstrap)
On the very first run, Deskly creates **one** default superadmin:
- **username:** `superadmin`
- **password:** `deskly`

On first login you are **forced to change the password** and choose the UI language (IT/EN). The initial credentials are shown on the login page **only during first-run**; after the password change they are never shown again.

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
### Navigation
- Tree sidebar with fixed hierarchy **Client → Site → Floor plan**
- Quick search in the sidebar (filters clients/sites/floor plans by name)
- Per-user client ordering (drag & drop clients); ordering is saved on the user profile

### Settings (Admin / Superadmin)
- CRUD for **Clients**, **Sites**, **Floor plans**
- Client details: short name (shown in workspace), full legal name, address, VAT/PEC, phone, email, description
- Client logo upload (auto-resized)
- Client PDF attachments upload:
  - download
  - open in a new browser tab
- Site optional coordinates (`lat, lng`) with **Google Maps** link
- Floor plan image upload (JPG/PNG only), replace image with automatic archival as a revision
- Object types management (custom types + icon mapping), updating type/icon updates all objects
- User management:
  - create/edit/disable users
  - language per user
  - CSV/Excel-style export of the users table
- Superadmin only:
  - audit logs (login/logout + failed attempts)
  - Nerd Area: packages and versions used by the app

### Workspace (Floor plan)
- Floor plan shown as background; objects rendered on top with an icon and always-visible label
- Add objects via palette or context menu (type → name required, description optional)
- Select / multi-select:
  - click to select
  - Ctrl/⌘ to multi-select
  - Esc clears selection
  - Arrow keys nudge selected objects
  - Delete key opens a confirm dialog (Enter confirms, Esc cancels)
- Object operations (right click / context menu):
  - edit name/description
  - duplicate (asks for new name/description; placed next to original)
  - scale per object (slider)
  - delete
- Pan & zoom:
  - zoom controls (+ / -)
  - pan the map (background + objects move together)
  - viewport is persisted per floor plan (reload-safe)
- Rooms:
  - create **rectangle** or **polygon** rooms
  - resize/edit room shape
  - objects inside the room are automatically linked
  - room list with assigned objects and quick highlight
- Search:
  - search objects (name/description) and rooms (name)
  - highlight/blink the selected item on the map
  - if multiple results exist, you can choose which one to focus
- Views:
  - save the current viewport as a named view (with description)
  - mark one view as default (only one default)
  - views dropdown + context menu integration
- Revisions (“Time Machine”):
  - save immutable revisions (read-only history)
  - revision numbering **Rev: X.Y** with Major/Minor bump
  - restore revisions, compare revisions, delete a revision, delete all revisions
  - when saving, you can add a note
- Export:
  - export to PDF (orientation selectable; object list optional)
  - export the changelog to PDF

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
- Recommended before releasing:
```bash
npm audit --omit=dev
```
