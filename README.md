# Deskly - Floor Plan Management

Current version: **2.2.6**

Deskly is a web app to plan offices and infrastructure on floor plans using a fixed hierarchy **Client -> Site -> Floor plan**. It combines drag & drop editing, rooms, layers, walls, racks, measurements, and PDF exports in one workspace.

Note: This README was refreshed with a small formatting update.

- UI supports **Italian and English** (language switch refreshes the app)
- Drag & drop objects with layers, rooms, and grids
- Walls with materials/attenuation, scale-based measurements, and quotes
- CCTV cones and Wi-Fi coverage with wall occlusion
- Text, image, photo, and Post-it annotations with custom styling
- Keyboard shortcuts for scaling (+/−), rotation (Cmd/Ctrl+arrows), rename (N), directory (Cmd/Ctrl+R), text font/color (F/C), and quick linking (L)
- Client directory for imported users (available after import) + IP map grouped by /24 with searchable lists and keyboard navigation (M/U)
- Rack editor with ports, links, and PDF export
- Saved views, revisions, search/highlight
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
