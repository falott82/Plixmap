# Deskly - Floor Plan Management

Current version: **2.4.3**

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
- Exclusive floor plan lock (no inactivity expiry), unlock requests with takeover window, and immutable revisions
- Client chat (per customer) with permissions, unread badge, exports, and attachments (images/docs)
- Multi-user roles with per-plan permissions

## Locks
- A floor plan can be edited by only one user at a time (exclusive lock).
- The lock does not expire due to inactivity: it stays active until the owner saves or grants an unlock.
- Any user can request an unlock from the lock owner (optional message + takeover window 0.5..60 minutes). When granted, the lock is released immediately and reserved for the requester for the selected time.
- Superadmins can start a force unlock with a countdown (0..60 minutes). During the countdown, the lock owner sees a non-dismissible warning and can only choose Save+release or Discard+release. The superadmin can cancel the request; if it expires/cancels, the lock remains with the owner. If it completes, the superadmin takes the lock (or gets an hourglass reservation).

## Client chat
- Each client can have a dedicated chat (permissions control who can access it for that client).
- Unread messages show a badge; entering the chat marks it as read (WhatsApp-like behavior).
- Messages support text + attachments (images/documents/videos, total max 5MB per message). Voice notes: up to 10 minutes.
- Images open in an in-app modal (with download).
- Users can edit their last messages within 30 minutes and delete their own messages; superadmins can delete any message or clear the whole chat.
- Chat export: TXT/JSON/HTML.

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
