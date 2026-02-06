# Deskly - Floor Plan Management

Current version: **2.3.1**

Deskly is a web app to plan offices and infrastructure on floor plans using a fixed hierarchy **Client -> Site -> Floor plan**. It combines drag & drop editing, rooms, layers, walls, racks, measurements, and PDF exports in one workspace.

Note: This README was refreshed with a small formatting update.

- UI supports **Italian and English** (language switch forces a full refresh for consistency)
- Drag & drop editor with objects, rooms, layers, and snap grid
- Walls with per-material attenuation (used for Wi-Fi range), scale calibration, measurements, and dimensions (quotes)
- CCTV field-of-view cones blocked by walls (glass/windows excluded), and Wi-Fi range rings affected by wall attenuation
- Annotations: text (fonts/colors/background), images, photos (gallery), and Post-it
- Keyboard shortcuts: move (arrows, Shift for bigger steps), rotate 90° (Ctrl/Cmd+Left/Right), scale (+/-), edit (E), link 2 selected (L), copy/paste (Ctrl/Cmd+C/V), undo/redo (Ctrl/Cmd+Z/Y)
- Client tools: imported "Real users" directory (place "Real user" objects; Ctrl/Cmd+M to email), plus an IP map grouped by /24 (U to open URL) with searchable lists and PDF export
- Rack editor with ports, links, and PDF export
- Saved views, revisions (restore/immutable), and search/highlight
- Exclusive floor plan lock with auto-renew (idle expires after ~60s), unlock requests, and immutable revisions
- Multi-user roles with per-plan permissions

## Screenshots
### Rack editor
![Rack editor](docs/screenshots/rack-editor.png)

### Plan view
![Plan view](docs/screenshots/plan-view.png)

## Tech stack
- React + TypeScript (Vite), TailwindCSS, Zustand, react-konva
- Node.js + Express + SQLite (better-sqlite3)
- Export: jsPDF + html2canvas

## Quickstart
### Prerequisites
- Node.js 20+ (18+ should work)

### Development
```bash
npm install

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
- `DESKLY_DB_PATH` (default `data/deskly.sqlite`)
- `DESKLY_AUTH_SECRET` (optional; if not provided it is stored in DB in production)

## Storage notes
- SQLite DB and uploads live in `./data` (or `DESKLY_DB_PATH`).
- Floor plan images, client logos, and PDFs are stored on disk and referenced by URL.

## LAN access
- Dev: `http://<YOUR_PC_IP>:5173`
- Prod: `http://<YOUR_PC_IP>:8787`

All users on the LAN share the same SQLite data on the server machine.
