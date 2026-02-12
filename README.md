# Deskly - Floor Plan Management

Current version: **2.6.0**

Deskly is a web app to plan offices and infrastructure on floor plans using a fixed hierarchy **Client -> Site -> Floor plan**. It combines drag & drop editing, rooms, layers, walls, racks, measurements, and PDF exports in one workspace.

Note: This README was refreshed with a small formatting update.

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
- Scaled measurements and dimensions directly on the floor plan.
- Fast object insertion and management via modern drag & drop, copy/paste, duplication, and extensive keyboard shortcuts.

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
