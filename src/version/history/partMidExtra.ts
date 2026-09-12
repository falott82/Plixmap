import type { ReleaseNote } from './types';
import { n } from './types';

// Second chunk of partMid release notes (split to keep each file < 1500 lines).
export const partMidExtra: ReleaseNote[] = [
  {
    version: '1.8.4',
    date: '2026-01-21',
    type: 'minor',
    notes: [
      n(
        'Realtime: fallback automatico se /ws non disponibile',
        'Realtime: automatic fallback when /ws is unavailable'
      ),
      n(
        'Muri: chiusura poligono apre una modale con lati e materiali + opzione crea stanza',
        'Walls: polygon close opens a modal with sides/materials + optional room creation'
      ),
      n(
        'Disegno muri: snap migliorato per evitare chiusure accidentali',
        'Wall drawing: improved snap to prevent accidental closes'
      ),
      n(
        'Scala: aggiunta voce “Cancella scala” dal menu contestuale',
        'Scale: added “Clear scale” in the context menu'
      ),
      n(
        'UI: modale stanza con altezza responsive per evitare overflow',
        'UI: room modal made responsive to prevent button overflow'
      )
    ]
  },
  {
    version: '1.8.2',
    date: '2026-01-19',
    type: 'minor',
    notes: [
      n(
        'Stanze: scelta dei materiali muro per lato (default mattoni) + flag stanza logica',
        'Rooms: choose wall materials per side (default brick) + logical room flag'
      ),
      n(
        'Mura: colori generati per tipo materiale e aggiornati al cambio tipo',
        'Walls: generated colors per material type, updated on type change'
      ),
      n(
        'Disegno muri: Shift vincola i segmenti dritti; scala salvabile con Invio',
        'Wall drawing: Shift constrains straight segments; scale can be saved with Enter'
      )
    ]
  },
  {
    version: '1.8.1',
    date: '2026-01-18',
    type: 'minor',
    notes: [
      n(
        'Mura: lettere agli angoli e menu con lati, perimetro e area (richiede scala impostata)',
        'Walls: corner labels and context menu with side lengths, perimeter, and area (requires scale)'
      ),
      n(
        'Palette: muri solo nella tab dedicata (Walls), esclusi dalla tab Oggetti',
        'Palette: walls only in the dedicated tab (Walls), removed from Objects tab'
      ),
      n(
        'Layers: pulsante “Nascondi livelli” al posto di “Solo mappa” e prompt eliminazione ripulito',
        'Layers: “Hide layers” button replaces “Map only” and cleaner delete prompt copy'
      ),
      n(
        'Hotkey: W per disegnare muri, M per misurare distanza',
        'Hotkey: W draws walls, M measures distance'
      )
    ]
  },
  {
    version: '1.8.0',
    date: '2026-01-17',
    type: 'minor',
    notes: [
      n(
        'Planimetria: scala per singola planimetria con righello visibile',
        'Floor plan: per-plan scale calibration with visible ruler'
      ),
      n(
        'Mura: nuovo layer, materiali con attenuazione dB e modifica tipo con doppio click o multi-selezione',
        'Walls: new layer, materials with dB attenuation, edit type via double-click or multi-selection'
      ),
      n(
        'Misurazioni: strumento distanza/area da menu contestuale + calcolo area stanza',
        'Measurements: distance/area tool from context menu + room area calculation'
      ),
      n(
        'Hotkey: M avvia/chiude il disegno muro',
        'Hotkey: M starts/finishes wall drawing'
      )
    ]
  },
  {
    version: '1.7.3',
    date: '2026-01-16',
    type: 'minor',
    notes: [
      n(
        'Import utenti: WebAPI supporta GET/POST, body opzionale e test con dettagli errore',
        'User import: WebAPI supports GET/POST, optional body, and detailed test errors'
      ),
      n(
        'Import utenti: accesso consentito a host privati quando la richiesta arriva da rete locale',
        'User import: private hosts allowed when the request comes from a local network'
      ),
      n(
        'Layers: gestione “Mostra Tutto” in cima all’elenco e indicatori colore aggiornati',
        'Layers: “Show All” pinned to the top and updated color indicators'
      ),
      n(
        'UI: toast migrati a Sonner',
        'UI: toasts migrated to Sonner'
      )
    ]
  },
  {
    version: '1.7.2',
    date: '2026-01-15',
    type: 'fix',
    notes: [
      n(
        'Layers: fix crash nella tab Settings → Layers con ricerca',
        'Layers: fixed crash in Settings → Layers tab with search'
      ),
      n(
        'Layers: visibilità salvata correttamente per utente dopo logout/login',
        'Layers: visibility is now saved per user after logout/login'
      ),
      n(
        'Login: form correttamente racchiuso per evitare warning del browser',
        'Login: inputs are now inside a form to avoid browser warnings'
      )
    ]
  },
  {
    version: '1.7.1',
    date: '2026-01-14',
    type: 'minor',
    notes: [
      n(
        'Settings: nuova tab Layers per creare, riordinare e configurare i layers per planimetria',
        'Settings: new Layers tab to create, reorder, and configure layers per floor plan'
      ),
      n(
        'Layers: mappatura tipologie oggetto per layer con aggiornamento degli oggetti esistenti',
        'Layers: object type mapping per layer with updates for existing objects'
      ),
      n(
        'Defaults: typeIds standard per i layers base (users/devices/desks/cctv/racks)',
        'Defaults: standard typeIds for base layers (users/devices/desks/cctv/racks)'
      )
    ]
  },
  {
    version: '1.7.0',
    date: '2026-01-13',
    type: 'minor',
    notes: [
      n(
        'Workspace: nuovo layer CCTV con telecamere e cono di visione regolabile (angolo/raggio/rotazione)',
        'Workspace: new CCTV layer with cameras and adjustable view cone (angle/range/rotation)'
      ),
      n(
        'Inserimento oggetti: anteprima che segue il mouse e click per piazzare anche fuori griglia',
        'Object placement: live preview follows the mouse and click places even outside the grid'
      ),
      n(
        'Accesso: se non c’è una planimetria predefinita si apre la prima disponibile; se non ce ne sono appare un messaggio per l’utente',
        'Access: if no default plan is set, the first available opens; if none, a user-facing notice is shown'
      ),
      n(
        'Users: guida azioni rapida + sblocco account bloccati da admin',
        'Users: quick actions guide + admin unlock for locked accounts'
      )
    ]
  },
  {
    version: '1.6.5',
    date: '2026-01-12',
    type: 'fix',
    notes: [
      n(
        'Security: lockout temporaneo dopo troppi tentativi di login falliti',
        'Security: temporary lockout after too many failed login attempts'
      ),
      n(
        'Security: validazione formati/limiti per immagini e PDF (upload sicuri)',
        'Security: format/size validation for images and PDFs (safe uploads)'
      ),
      n(
        'MFA: reset MFA da Settings → Users (admin) + script CLI per superadmin',
        'MFA: reset MFA from Settings → Users (admin) + CLI script for superadmin'
      ),
      n(
        'Security: header CSP e CSRF token per le richieste mutanti',
        'Security: CSP headers and CSRF tokens for mutating requests'
      )
    ]
  },
  {
    version: '1.6.4',
    date: '2026-01-12',
    type: 'fix',
    notes: [
      n(
        'Account: recovery superadmin offline con comando CLI dedicato',
        'Account: offline superadmin recovery with a dedicated CLI command'
      ),
      n(
        'Settings: pagina Donazioni con link PayPal',
        'Settings: Donations page with PayPal link'
      ),
      n(
        'Footer: aggiunto link PayPal',
        'Footer: added PayPal link'
      )
    ]
  },
  {
    version: '1.6.2',
    date: '2026-01-11',
    type: 'fix',
    notes: [
      n(
        'Sicurezza: permessi verificati per lock/presenza realtime delle planimetrie',
        'Security: permissions enforced for realtime plan locks/presence'
      ),
      n(
        'Sicurezza: asset /uploads accessibili solo con sessione valida',
        'Security: /uploads assets now require an authenticated session'
      ),
      n(
        'Sicurezza: import esterno con validazione URL e limite dimensione risposta',
        'Security: external import URL validation with response size limits'
      ),
      n(
        'Affidabilità: rate limit login con cleanup e IP proxy configurabile',
        'Reliability: login rate-limit cleanup with configurable proxy IPs'
      )
    ]
  },
  {
    version: '1.6.1',
    date: '2026-01-10',
    type: 'minor',
    notes: [
      n(
        'Palette: sezioni Scrivanie/Oggetti comprimibili e lista utenti online per superadmin',
        'Palette: collapsible Desks/Objects sections and online user list for superadmin'
      ),
      n(
        'Logs e security check: ultimo svuotamento/check con utente evidenziato',
        'Logs and security check: last cleared/check with highlighted user'
      ),
      n(
        'Email: porta impostata automaticamente in base a SSL/STARTTLS',
        'Email: port automatically set based on SSL/STARTTLS'
      ),
      n(
        'Quick help: export PDF senza tagli tra le sezioni',
        'Quick help: PDF export without cutting across sections'
      ),
      n(
        'Sidebar: avviso quando mancano sites/planimetrie con link alle impostazioni',
        'Sidebar: warning when sites/floor plans are missing with settings shortcut'
      )
    ]
  },
  {
    version: '1.6.0',
    date: '2026-01-10',
    type: 'minor',
    notes: [
      n(
        'Logs: tab Auth/Mail/Audit con svuotamento tracciato e conferma dedicata',
        'Logs: Auth/Mail/Audit tabs with tracked clears and dedicated confirmation'
      ),
      n(
        'Email: impostazioni SMTP con subject test editabile e gestione errori migliorata',
        'Email: SMTP settings with editable test subject and improved error handling'
      ),
      n(
        'Quick help: menu argomenti e download PDF con versione in evidenza',
        'Quick help: topic menu and PDF download with version reference'
      ),
      n(
        'Nerd Area: toggle telemetria stile iOS e ultimo security check salvato',
        'Nerd Area: iOS-style telemetry toggle and persisted last security check'
      )
    ]
  },
  {
    version: '1.5.6',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'Rack: salvataggio collegamenti porte corretto anche per utenti non admin',
        'Rack: port link save works for non-admin users'
      ),
      n(
        'Rack: modali collegamenti/rename senza focus trap e click fuori sempre gestito',
        'Rack: link/rename modals without focus trap and consistent outside click handling'
      ),
      n(
        'Toast: visibili sopra le modali rack',
        'Toasts: visible above rack modals'
      )
    ]
  },
  {
    version: '1.5.5',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'Login: cookie sicuro solo su HTTPS (accesso HTTP in LAN ok)',
        'Login: secure cookie only on HTTPS (HTTP LAN access works)'
      )
    ]
  },
  {
    version: '1.5.4',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'Bootstrap login: superadmin/deskly sempre valido al primo avvio',
        'Bootstrap login: superadmin/deskly always valid on first run'
      )
    ]
  },
  {
    version: '1.5.3',
    date: '2026-01-08',
    type: 'minor',
    notes: [
      n(
        'Sidebar: palette con tab Oggetti/Scrivanie, livelli comprimibili e “Mostra tutti” separato',
        'Sidebar: palette with Objects/Desks tabs, collapsible layers, and split “Show all”'
      ),
      n(
        'Impostazioni oggetti: tab Oggetti/Scrivanie, scrivanie predefinite (niente creazione/richieste)',
        'Object settings: Objects/Desks tabs, desks are built-in (no creation/requests)'
      ),
      n(
        'Scrivanie: rotazione Ctrl/⌘ + frecce più stabile',
        'Desks: more reliable Ctrl/⌘ + arrow rotation'
      )
    ]
  },
  {
    version: '1.5.2',
    date: '2026-01-08',
    type: 'minor',
    notes: [
      n(
        'Scrivanie: linee configurabili (spessore/colore) + ridimensionamento libero con maniglie',
        'Desks: configurable lines (weight/color) + free resize with handles'
      ),
      n(
        'Scrivanie: rotazione rapida con Ctrl/⌘ + freccia sinistra/destra',
        'Desks: quick rotation with Ctrl/⌘ + left/right arrow'
      ),
      n(
        'Palette: pulsanti Scrivanie/Oggetti adattati alla sidebar',
        'Palette: Desks/Objects buttons fit better in the sidebar'
      )
    ]
  },
  {
    version: '1.5.1',
    date: '2026-01-08',
    type: 'minor',
    notes: [
      n(
        'Scrivanie: nuove forme (rettangolare, doppia, banco lungo, trapezoidale) e rotazione a 90°',
        'Desks: new shapes (rectangular, double, long bench, trapezoid) and 90° rotation'
      ),
      n(
        'Scrivanie: inserimento diretto nel layer dedicato, senza nome/descrizione; niente ricerca o collegamenti',
        'Desks: direct placement in the dedicated layer, no name/description; not searchable or linkable'
      ),
      n(
        'PDF: opzione per includere/escludere le scrivanie (default attivo)',
        'PDF: option to include/exclude desks (default on)'
      )
    ]
  },
  {
    version: '1.5.0',
    date: '2026-01-08',
    type: 'minor',
    notes: [
      n(
        'Palette: aggiunta sezione Scrivanie con forme dedicate (tonda, quadrata, a L e a L rovesciata)',
        'Palette: added Desks section with dedicated shapes (round, square, L, reverse L)'
      ),
      n(
        'Oggetti: layer Scrivanie dedicato + controllo opacità per gli oggetti',
        'Objects: dedicated Desks layer + opacity control for objects'
      )
    ]
  },
  {
    version: '1.4.11',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'Rack: modale nota porta resa interattiva anche in produzione (focus e overlay corretti)',
        'Rack: port note modal is interactive again in production (focus + overlay fixed)'
      )
    ]
  },
  {
    version: '1.4.10',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'CI: run-name del workflow audit semplificato per evitare errori API',
        'CI: audit workflow run-name simplified to avoid API errors'
      )
    ]
  },
  {
    version: '1.4.9',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'CI: fix rename workflow run con chiamata GitHub API compatibile',
        'CI: fixed workflow run rename with a compatible GitHub API call'
      )
    ]
  },
  {
    version: '1.4.8',
    date: '2026-01-08',
    type: 'fix',
    notes: [
      n(
        'CI: fix lettura versione app nel workflow security-audit',
        'CI: fixed app version reading in the security-audit workflow'
      )
    ]
  },
  {
    version: '1.4.7',
    date: '2026-01-08',
    type: 'minor',
    notes: [
      n(
        'Rack: nomi apparati tradotti correttamente in inglese',
        'Rack: device labels now properly translated in English'
      )
    ]
  },
  {
    version: '1.4.6',
    date: '2026-01-08',
    type: 'minor',
    notes: [
      n(
        'Rack: selezione apparati resa stabile con click e menu contestuale',
        'Rack: device selection stabilized for click and context menu'
      ),
      n(
        'Rack: drag & drop ora consente lo scambio di apparati con la stessa U',
        'Rack: drag & drop now swaps devices with the same U size'
      ),
      n(
        'Rack: aggiunto apparato passivo Passacavo e nome per oggetti Varie',
        'Rack: added passive Passacavo device and name field for Misc items'
      ),
      n(
        'Rack: modale note porta ora riceve sempre il focus',
        'Rack: port note modal now always receives focus'
      )
    ]
  },
  {
    version: '1.4.5',
    date: '2026-01-07',
    type: 'minor',
    notes: [
      n(
        'Planimetria: tooltips aggiunti per menu contestuali, viste e azioni rapide',
        'Floor plan: tooltips added for context menus, views, and quick actions'
      ),
      n(
        'Rack: tooltips completi su porte, collegamenti e modali di configurazione',
        'Rack: comprehensive tooltips across ports, links, and configuration modals'
      )
    ]
  },
  {
    version: '1.4.4',
    date: '2026-01-05',
    type: 'minor',
    notes: [
      n(
        'Nerd Area: pulsante check sicurezza con npm audit e riepilogo vulnerabilita',
        'Nerd Area: security check button with npm audit and vulnerability summary'
      ),
      n(
        'Server: endpoint protetto per eseguire npm audit dal pannello admin',
        'Server: protected endpoint to run npm audit from the admin panel'
      )
    ]
  },
  {
    version: '1.4.3',
    date: '2026-01-05',
    type: 'minor',
    notes: [
      n(
        'Planimetria: collegamenti rack visibili anche con layer Cablaggi spento',
        'Floor plan: rack links visible even with Cabling layer hidden'
      ),
      n(
        'Planimetria: collegamenti multipli tra rack con linee parallele ordinate',
        'Floor plan: multiple rack links rendered as ordered parallel lines'
      ),
      n(
        'Rack: modale collegamenti persistente (non si chiude su click esterno/ESC)',
        'Rack: connections modal stays open (no close on backdrop/ESC)'
      ),
      n(
        'Rack: selezione porte con modale stato collegamenti (libera/collegata)',
        'Rack: port selection modal with link status (free/linked)'
      ),
      n(
        'Rack: stato porte corretto per apparati senza lato (es. switch)',
        'Rack: port status fixed for devices without sides (e.g., switches)'
      ),
      n(
        'Planimetria: menu collegamenti disabilitato sui rack',
        'Floor plan: link actions disabled for rack objects'
      )
    ]
  },
  {
    version: '1.4.2',
    date: '2026-01-04',
    type: 'minor',
    notes: [
      n(
        'Rack: note per porta con modale dedicata e focus automatico',
        'Rack: per-port notes with a dedicated modal and automatic focus'
      ),
      n(
        'Rack: collegamenti ripuliti e warning su porte già occupate con sostituzione',
        'Rack: link cleanup plus warnings and replacement on already-used ports'
      ),
      n(
        'Rack: vista collegamenti con filtri, legenda e percorso ordinato',
        'Rack: connections view with filters, legend, and ordered paths'
      ),
      n(
        'Rack: percorso collegamenti colorato e icone dedicate vicino alle porte',
        'Rack: colored connection paths and dedicated icons next to ports'
      ),
      n(
        'Planimetria: collegamenti tra rack con linea tratteggiata rame/fibra e apertura porte al click',
        'Floor plan: dashed copper/fiber rack links with port list on click'
      )
    ]
  },
  {
    version: '1.4.1',
    date: '2026-01-03',
    type: 'fix',
    notes: [
      n(
        'Rack: layer dedicato e preferiti palette aggiornati con “Rack rete”',
        'Rack: dedicated layer and palette favorites updated with “Network rack”'
      ),
      n(
        'Rack: modifica da mappa apre la modale di gestione rack',
        'Rack: editing from the map opens the rack management modal'
      ),
      n(
        'Rack: eliminazione rack ripulisce apparati e collegamenti associati',
        'Rack: deleting a rack cleans up associated devices and links'
      ),
      n(
        'Rack: dati inclusi in revisioni e duplicazione planimetrie',
        'Rack: data included in revisions and plan duplication'
      )
    ]
  },
  {
    version: '1.4.0',
    date: '2026-01-02',
    type: 'minor',
    notes: [
      n(
        'Rack: modale configurazione apparati con posizione attuale, ricerca per nome/host e selezione stabile',
        'Rack: device configuration modal with current position, name/host search and stable selection'
      ),
      n(
        'Rack: configurazione porte con collegamenti 1:1 e velocita per rame/fibra',
        'Rack: port configuration with 1:1 links and speed presets for copper/fiber'
      ),
      n(
        'Rack: conferme eliminazione con lista apparati e uscita drag con conferma',
        'Rack: delete confirmations with device list and drag-out deletion confirmation'
      ),
      n(
        'Rack: export PDF verticale con titolo/nota e layout più leggibile',
        'Rack: portrait PDF export with title/notes and improved readability'
      ),
      n(
        'Rack: tasti ESC gestiti per evitare chiusure involontarie della planimetria',
        'Rack: ESC handling prevents accidental closing of the floor plan'
      )
    ]
  },
  {
    version: '1.3.7',
    date: '2025-12-31',
    type: 'fix',
    notes: [
      n(
        'Utenti: superadmin unico (solo account superadmin) e ruoli corretti per gli altri utenti',
        'Users: single superadmin (superadmin account only) and correct roles for other users'
      ),
      n(
        'Utenti: evidenza solo per superadmin con nome in rosso e riga dedicata',
        'Users: highlight only for superadmin with red username and dedicated row styling'
      ),
      n(
        'Rack: nuovi apparati (UPS, ciabatta, varie), campi avanzati e note rack',
        'Rack: new devices (UPS, power strip, misc), advanced fields and rack notes'
      ),
      n(
        'Rack: inserimento guidato con drop, evidenza selezione e spostamento con frecce',
        'Rack: guided placement with drop, selection highlight and arrow-key moves'
      )
    ]
  },
  {
    version: '1.3.6',
    date: '2025-12-31',
    type: 'fix',
    notes: [
      n(
        'Oggetti: richiesta sempre pulita (campi reset) e campi custom con focus stabile',
        'Objects: request form resets cleanly and custom fields keep stable focus'
      ),
      n(
        'Oggetti: superadmin gestisce solo richieste utenti; approvazione aggiorna subito la lista oggetti',
        'Objects: superadmin manages user requests only; approvals update the object list immediately'
      ),
      n(
        'Oggetti: approvazione mantiene i campi custom e i nuovi oggetti partono con scala 0.50',
        'Objects: approvals keep custom fields and new objects default to 0.50 scale'
      ),
      n(
        'Oggetti: pulsante richiesta ripristinato e modale richiesta sempre completa',
        'Objects: request button restored and request modal always complete'
      ),
      n(
        'Settings: badge changelog e pulsante Aiuto visibili anche in impostazioni',
        'Settings: changelog badge and Help button are now visible in Settings'
      ),
      n(
        'Oggetti: creazione diretta superadmin con campi custom disponibili',
        'Objects: superadmin direct creation now supports custom fields'
      ),
      n(
        'Settings: tab persistente su refresh (URL) e prompt per richieste in pending',
        'Settings: tab persists on refresh (URL) and pending-request prompt added'
      ),
      n(
        'UI: toast più leggibili e modale richieste non si chiude su approvazione',
        'UI: toasts are more readable and request modal stays open on approval'
      ),
      n(
        'Login: layout più moderno con background sfumato azzurro',
        'Login: refreshed modern layout with blue gradient background'
      )
    ]
  },
  {
    version: '1.3.5',
    date: '2025-12-31',
    type: 'fix',
    notes: [
      n(
        'Oggetti: richieste e gestione spostate in una modale dedicata con tab',
        'Objects: requests and management moved into a dedicated modal with tabs'
      ),
      n(
        'Oggetti: richieste includono campi custom, modificabili e reinviabili prima dell’approvazione',
        'Objects: requests include custom fields, editable and resubmittable before approval'
      ),
      n(
        'Oggetti: icone suggerite escludono quelle già usate dai tipi di default',
        'Objects: suggested icons exclude those already used by default types'
      )
    ]
  },
  {
    version: '1.3.4',
    date: '2025-12-31',
    type: 'minor',
    notes: [
      n(
        'Utenti: tabella riallineata + superadmin sempre in cima',
        'Users: table realigned + superadmin always pinned first'
      ),
      n(
        'Oggetti: modale “Aggiungi oggetto” più ampia',
        'Objects: “Add object” modal widened'
      ),
      n(
        'Oggetti: creazione custom per superadmin con scelta icona',
        'Objects: custom creation for superadmin with icon picker'
      ),
      n(
        'Oggetti: richieste utenti con workflow approva/rifiuta e stati colorati',
        'Objects: user requests with approve/reject workflow and colored statuses'
      ),
      n(
        'Settings: modifica planimetria via matita con focus immediato',
        'Settings: floor plan edit via pencil with immediate focus'
      )
    ]
  },
  {
    version: '1.3.3',
    date: '2025-12-31',
    type: 'fix',
    notes: [
      n(
        'Setup: prompt post-password nella lingua scelta dal superadmin',
        'Setup: post-password prompt shown in the superadmin language'
      ),
      n(
        'Utenti: superadmin sempre in cima, data/ora creazione visibile, import permessi nascosto per admin',
        'Users: superadmin pinned first, created-at shown, permission import hidden for admins'
      ),
      n(
        'Utenti: username/password non precompilati dal browser e numero telefono con solo cifre (+ opzionale)',
        'Users: username/password no browser autofill, phone number digits-only (+ optional)'
      ),
      n(
        'Seed: vista DEFAULT più zoomata e centrata',
        'Seed: DEFAULT view more zoomed and centered'
      ),
      n(
        'UI: modale “Aggiungi oggetto” più ampia',
        'UI: “Add object” modal widened'
      ),
      n(
        'Settings: input planimetria editabile tramite matita con focus automatico',
        'Settings: floor plan name editable via pencil with auto-focus'
      )
    ]
  },
  {
    version: '1.3.2',
    date: '2025-12-31',
    type: 'fix',
    notes: [
      n(
        'Bootstrap: dopo il cambio password iniziale carica subito i clienti senza bisogno di refresh',
        'Bootstrap: after first password change, clients load immediately without a refresh'
      ),
      n(
        'Utenti: prompt post-setup per creare utenti + apertura diretta della modale di creazione',
        'Users: post-setup prompt to create users + direct open of the create modal'
      ),
      n(
        'Utenti: import rapido di clienti/permessi da un altro utente + superadmin evidenziato e non disattivabile',
        'Users: quick import of clients/permissions from another user + highlighted, non-disableable superadmin'
      ),
      n(
        'Sidebar: badge informativo sul cliente demo ACME',
        'Sidebar: info badge on the ACME demo client'
      ),
      n(
        'Palette: CTA visibile quando la palette è vuota',
        'Palette: CTA shown when the palette is empty'
      )
    ]
  },
];
