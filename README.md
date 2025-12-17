# Deskly – Gestione planimetrie con oggetti trascinabili

Web app moderna per gestire planimetrie aziendali per Cliente → Sede → Planimetria, con inserimento e gestione di persone/asset sulla mappa, stanze logiche, viste, revisioni, ricerca (highlight) ed export PDF.

## Stack
- React + TypeScript (Vite)
- Zustand per stato UI; persistenza dati su SQLite via API
- TailwindCSS per UI
- react-konva per canvas e drag, lucide-react per le icone
- jspdf + html2canvas per export PDF
- Backend Node + SQLite (better-sqlite3) + autenticazione

## Struttura dati
- `Client { id, name, logoUrl?, sites: Site[] }`
- `Site { id, clientId, name, floorPlans: FloorPlan[] }`
- `FloorPlan { id, siteId, name, imageUrl, width?, height?, objects, rooms?, views?, revisions? }`
- `MapObject { id, floorPlanId, type, name, description?, x, y, scale?, roomId? }`
- `Room { id, name, x, y, width, height }`
- `FloorPlanView { id, name, zoom, pan, isDefault? }`
- `FloorPlanRevision { id, createdAt, revMajor, revMinor, imageUrl, objects, rooms?, views? }`

## Login (default)
Al primo avvio vengono creati 2 admin:
- `admin` / `C3g_room01`
- `admin2` / `C3g_backup01` (backup)

I due utenti iniziali sono **superadmin**: possono vedere i logs, creare utenti admin e resettare password dei superadmin.

- **Admin**: accesso completo RW su tutti i clienti (nessun permesso da configurare).
- **Utenti**: permessi RO/RW assegnabili per Cliente/Sede/Planimetria.

Gestione utenti e permessi da **Settings → Utenti**.

## Avvio locale (macOS)
1) Installare Node 18+ (es. `brew install node`).
2) Installare dipendenze:
```bash
npm install
```
3) Avviare API (SQLite + auth):
```bash
npm run dev:api
```
4) Avviare in sviluppo (Vite + proxy su /api):
```bash
npm run dev -- --host 0.0.0.0 --port 5173
# poi apri http://localhost:5173
```
Da un altro PC in LAN: `http://IP_DEL_MAC:5173`

5) Produzione (server unico: API + UI):
```bash
npm run build
npm start
# poi apri http://localhost:8787
```
Da un altro PC in LAN: `http://IP_DEL_MAC:8787`

## Docker
Build e run in locale (SQLite persistente su volume):
```bash
docker compose up --build
# app su http://localhost:8787
```

Per rendere l’app accessibile in LAN: usa `http://IP_DEL_PC:8787`.

## Uso rapido
- Login con un utente valido.
- Naviga dalla sidebar (Cliente → Sede → Planimetria).
- Settings (admin): CRUD clienti/sedi/planimetrie, upload immagine, logo cliente, gestione utenti e permessi.
- Settings (superadmin): Logs (login/logout) e Nerd Area (stack/dipendenze).
- Planimetria: drag&drop icone, menu contestuale oggetti (modifica/duplica/scala/elimina), selezione multipla (Ctrl/⌘), stanze logiche (rettangolo).
- Ricerca: evidenzia (blink/highlight) l’oggetto trovato; se ci sono più match puoi scegliere.
- Esporta PDF: snapshot mappa + lista oggetti (opzionale) e orientamento configurabile.
- Changelog: apri badge versione e scarica PDF della history.

## Note
- I dati sono condivisi via SQLite quando l’app gira sul server (`npm start` o Docker). Se apri l’app da un altro PC, vedrai gli stessi dati.
- Password in DB: hash `scrypt` + salt; sessione firmata in cookie HttpOnly.

## Security
- Abilitato `Dependabot` per aggiornamenti npm/Docker: `.github/dependabot.yml`
- GitHub Action `npm audit --omit=dev` su PR e `main`: `.github/workflows/security-audit.yml`
- Consigliato localmente (prima di rilasciare): `npm audit --omit=dev` e aggiornamenti mirati in base alle CVE raggiungibili.
