export interface ReleaseNote {
  version: string;
  date: string;
  type: 'fix' | 'minor' | 'major';
  notes: { it: string; en: string }[];
}

const n = (it: string, en: string): { it: string; en: string } => ({ it, en });

export const releaseHistory: ReleaseNote[] = [
  {
    version: '1.9.8',
    date: '2026-01-31',
    type: 'fix',
    notes: [
      n(
        'Planimetrie: auto-centramento quando la vista non mostra l’immagine',
        'Floor plans: auto-fit when the plan is not visible in the viewport'
      ),
      n(
        'Muri: toast persistente fino al termine + chiusura con tasto destro/Invio',
        'Walls: persistent toast until finish + close with right click/Enter'
      ),
      n(
        'Collegamenti: pulsante elimina e spessore predefinito a 1',
        'Links: delete button and default width set to 1'
      ),
      n(
        'Stanze: nome obbligatorio con messaggio di errore',
        'Rooms: required name with inline validation'
      )
    ]
  },
  {
    version: '1.9.7',
    date: '2026-01-30',
    type: 'fix',
    notes: [
      n(
        'Menu planimetria: Aggiungi con sezioni Stanze/Oggetti/Scrivanie/Mura e catalogo oggetti in modale',
        'Floor plan menu: Add sectioned into Rooms/Objects/Desks/Walls with an object catalog modal'
      ),
      n(
        'PDF: opzioni dedicate per muri, quote e scala',
        'PDF: dedicated options for walls, quotes, and scale'
      ),
      n(
        'Collegamenti: frecce direzionali configurabili (SX/DX/nessuna) e misure con chiusura magnetica',
        'Links: configurable directional arrows (left/right/none) and measurements with magnetic closure'
      )
    ]
  },
  {
    version: '1.9.6',
    date: '2026-01-29',
    type: 'fix',
    notes: [
      n(
        'Menu planimetria: sottomenu laterali compatti con azioni raggruppate',
        'Floor plan menu: compact side submenus with grouped actions'
      ),
      n(
        'Quote/Muri: linee dritte di default, Shift per diagonali',
        'Quotes/Walls: straight lines by default, Shift for diagonals'
      ),
      n(
        'Stanze: misure affiancate alla forma con preview piu compatto',
        'Rooms: measurements alongside the shape with a more compact preview'
      )
    ]
  },
  {
    version: '1.9.5',
    date: '2026-01-28',
    type: 'fix',
    notes: [
      n(
        'Stanze: conferma se creare muri fisici dopo la creazione della room',
        'Rooms: confirm whether to create physical walls after room creation'
      ),
      n(
        'Stanze: preview forma con lati e misure nella modale',
        'Rooms: shape preview with side labels and measurements in the modal'
      ),
      n(
        'Muri stanza: preview forma e modale piu larga',
        'Room walls: shape preview and wider modal'
      )
    ]
  },
  {
    version: '1.9.4',
    date: '2026-01-27',
    type: 'fix',
    notes: [
      n(
        'Stanze: tooltip room logica con spiegazione ed esempio',
        'Rooms: logical room tooltip with explanation and example'
      ),
      n(
        'Stanze: etichette ridotte e layout corretto quando il nome e nascosto',
        'Rooms: smaller labels and fixed layout when the name is hidden'
      ),
      n(
        'Scale/Quote: opacita e dimensione regolabili dal menu contestuale',
        'Scale/Quotes: opacity and size adjustable from the context menu'
      )
    ]
  },
  {
    version: '1.9.3',
    date: '2026-01-26',
    type: 'fix',
    notes: [
      n(
        'Muri: ora segmenti singoli con toolbar rapida (tipo, elimina, dividi)',
        'Walls: now single segments with a quick toolbar (type, delete, split)'
      ),
      n(
        'Muri: lunghezza in tempo reale durante il disegno (con scala impostata)',
        'Walls: live length while drawing (when a scale is set)'
      ),
      n(
        'Stanze: misure di perimetro/area/lati spostate nella modale stanza',
        'Rooms: perimeter/area/side measurements moved into the room modal'
      )
    ]
  },
  {
    version: '1.9.2',
    date: '2026-01-25',
    type: 'fix',
    notes: [
      n(
        'Muri: selezione e trascinamento dei poligoni allineati (niente offset)',
        'Walls: polygon selection/drag alignment fixed (no offset)'
      ),
      n(
        'Stanze: trascinamento con mura chiuse mantiene l’allineamento',
        'Rooms: dragging closed wall groups keeps rooms aligned'
      ),
      n(
        'Undo/Redo: scorciatoie Ctrl/⌘+Z e Ctrl/⌘+Y + pulsanti in alto',
        'Undo/Redo: Ctrl/⌘+Z and Ctrl/⌘+Y shortcuts + top bar buttons'
      )
    ]
  },
  {
    version: '1.9.1',
    date: '2026-01-24',
    type: 'fix',
    notes: [
      n(
        'Muri: punto magnetico visibile durante il disegno per agganci rapidi',
        'Walls: visible magnetic point during drawing for quick snapping'
      ),
      n(
        'Muri: spessore linea regolabile dal menu contestuale',
        'Walls: line thickness adjustable from the context menu'
      ),
      n(
        'Muri/Stanze: migliorata la selezione delle stanze da spostare quando si trascinano i muri',
        'Walls/Rooms: improved which rooms move when dragging wall groups'
      )
    ]
  },
  {
    version: '1.9.0',
    date: '2026-01-23',
    type: 'minor',
    notes: [
      n(
        'CCTV: il cono di visuale si interrompe sui muri',
        'CCTV: the view cone is clipped by walls'
      )
    ]
  },
  {
    version: '1.8.5',
    date: '2026-01-22',
    type: 'minor',
    notes: [
      n(
        'Quote: nuova misura fissa con tasto Q + layer dedicato',
        'Quotes: new fixed measurement tool with Q hotkey + dedicated layer'
      ),
      n(
        'Stanze: superfici ricalcolate automaticamente quando si imposta la scala',
        'Rooms: surfaces automatically recalculated when the scale is set'
      ),
      n(
        'Stanze: superficie non modificabile manualmente quando la scala è presente',
        'Rooms: surface no longer editable manually when a scale is present'
      ),
      n(
        'UI: tooltip per distinguere room logica vs room fisica',
        'UI: tooltip explaining logical vs physical room'
      )
    ]
  },
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
  {
    version: '1.3.1',
    date: '2025-12-29',
    type: 'fix',
    notes: [
      n(
        'Livelli: toggle “Solo mappa” con icona e separatore visivo dalla palette',
        'Layers: “Map only” toggle with icon and visual separator from the palette'
      ),
      n(
        'Ricerca: risultati sempre visibili con navigazione da tastiera (frecce + Invio)',
        'Search: results always visible with keyboard navigation (arrows + Enter)'
      ),
      n(
        'Livelli: ripristino visibilità dopo reload',
        'Layers: visibility restored after reload'
      )
    ]
  },
  {
    version: '1.3.0',
    date: '2025-12-29',
    type: 'minor',
    notes: [
      n(
        'Workspace: badge “Salvato/Non salvato” sempre visibile e toast più descrittivi',
        'Workspace: always-visible “Saved/Unsaved” badge and clearer action toasts'
      ),
      n(
        'Stanze: modale con tab (Info, Utenti, Oggetti, Note) e lista stanze più leggibile',
        'Rooms: modal with tabs (Info, Users, Objects, Notes) and a more readable rooms list'
      ),
      n(
        'Utenti reali: riga selezionata più evidente, hint tastiera e CTA import quando non ci sono risultati',
        'Real users: clearer selection highlight, keyboard hint, and import CTA on empty state'
      ),
      n(
        'Settings: contenuti attenuati quando sono aperte modali “pesanti”',
        'Settings: background content dimmed when heavy modals are open'
      ),
      n(
        'Livelli: pulsante “Solo mappa” per nascondere tutti i livelli (ripristino automatico al reload)',
        'Layers: “Map only” toggle to hide all layers (restores on reload)'
      ),
      n(
        'Ricerca: navigazione con frecce + Invio nei risultati',
        'Search: arrow-key navigation + Enter to select results'
      ),
      n(
        'Note cliente: modale sempre a piena altezza disponibile',
        'Client notes: modal always fills the available height'
      )
    ]
  },
  {
    version: '1.2.26',
    date: '2025-12-29',
    type: 'fix',
    notes: [
      n(
        'Prestazioni: telemetria attivabile da Settings → Nerd Area (pannello prestazioni locale)',
        'Performance: telemetry toggle in Settings → Nerd Area (local performance panel)'
      ),
      n(
        'Canvas: correzione dei loop di resize con stabilizzazione dimensioni e filtro jitter',
        'Canvas: resize loop fix with size stabilization and jitter filtering'
      )
    ]
  },
  {
    version: '1.2.25',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Stanze: scala personalizzabile per nome e capienza direttamente dalle impostazioni stanza',
        'Rooms: custom scale for name and capacity in room settings'
      ),
      n(
        'Stanze: blocco sovrapposizione con avviso dedicato',
        'Rooms: overlap prevention with dedicated warning'
      ),
      n(
        'Revisione rapida: Cmd/Ctrl+S crea un minor automatico con notifica',
        'Quick revision: Cmd/Ctrl+S creates an automatic minor with notification'
      )
    ]
  },
  {
    version: '1.2.20',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Utenti reali: selezione chiarita per cliente (nome/ID + contatori) e filtri locali più veloci',
        'Real users: picker now clarifies the client scope (name/ID + counters) with faster local filters'
      ),
      n(
        'Utenti reali: caricamento lista più stabile (niente loop di ricerca) e stato vuoto più esplicito',
        'Real users: more stable list loading (no search loop) with clearer empty states'
      )
    ]
  },
  {
    version: '1.2.19',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Palette: menu tasto destro ora resta dentro lo schermo (posizionamento automatico)',
        'Palette: right-click menu now stays within the viewport (auto positioning)'
      )
    ]
  },
  {
    version: '1.2.18',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Palette: tasto destro su un oggetto → “Rimuovi da palette” (rimane disponibile in “Mostra tutti”)',
        'Palette: right-click an item → “Remove from palette” (still available in “Show all”)'
      )
    ]
  },
  {
    version: '1.2.17',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Stanze: selezionando un oggetto dalla palette mentre si disegna una stanza poligonale interrompe la creazione',
        'Rooms: picking an object from the palette while drawing a polygon room now cancels the room creation'
      )
    ]
  },
  {
    version: '1.2.16',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Settings → Area di lavoro: rientro forza la vista di default e pulisce l’URL (dv=1)',
        'Settings → Workspace: return now forces the default view and cleans the URL (dv=1)'
      )
    ]
  },
  {
    version: '1.2.15',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Workspace: tornando dai Settings, la planimetria ricarica sempre la vista di default (se impostata)',
        'Workspace: returning from Settings now always reloads the default view (if set)'
      )
    ]
  },
  {
    version: '1.2.14',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Workspace: avviso su refresh/chiusura pagina se ci sono modifiche non salvate',
        'Workspace: warns on refresh/close when there are unsaved changes'
      ),
      n(
        'Workspace: collegamenti (arrow) ora mostrano il nome sopra la linea come i cablaggi',
        'Workspace: arrow links now display their label above the line (like cables)'
      ),
      n(
        'Stanze: clic su un oggetto interrompe la creazione della stanza (rettangolo/poligono)',
        'Rooms: clicking an object cancels room creation (rectangle/polygon)'
      ),
      n(
        'Palette: nella modale “Mostra tutti” tasto destro → aggiungi alla barra laterale',
        'Palette: in the “Show all” modal, right-click → add to sidebar'
      ),
      n(
        'Note cliente: export PDF più fedele per elenchi puntati/numerati (marker espliciti)',
        'Client notes: more faithful PDF export for bulleted/numbered lists (explicit markers)'
      ),
      n(
        'Viste: fix caricamento vista di default dopo ritorno dai Settings (auto-fit non sovrascrive)',
        'Views: fixed default view restore after returning from Settings (auto-fit no longer overrides)'
      )
    ]
  },
  {
    version: '1.2.13',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: resize immagini migliorato (selezione affidabile + maniglie con cursore resize)',
        'Client notes: improved image resizing (reliable selection + resize handles with cursors)'
      )
    ]
  },
  {
    version: '1.2.12',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: abilitate error boundary Lexical per individuare errori runtime (incluso rendering immagini)',
        'Client notes: enabled Lexical error boundary to surface runtime errors (including image rendering)'
      )
    ]
  },
  {
    version: '1.2.11',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: rework ImageNode (DecoratorBlockNode + $insertNodeToNearestRoot) per rendere le immagini sempre visibili in editor',
        'Client notes: reworked ImageNode (DecoratorBlockNode + $insertNodeToNearestRoot) to make images always visible in the editor'
      )
    ]
  },
  {
    version: '1.2.10',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix definitivo inserimento immagini (ImageNode ora usa $applyNodeReplacement e DOM contentEditable=false)',
        'Client notes: definitive fix for image insertion (ImageNode now uses $applyNodeReplacement and DOM contentEditable=false)'
      )
    ]
  },
  {
    version: '1.2.9',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix rendering immagini (ImageNode ora è inline e non inserisce blocchi dentro span)',
        'Client notes: fixed image rendering (ImageNode is now inline and avoids block elements inside spans)'
      ),
      n(
        'Note cliente: tasto destro su tabella seleziona automaticamente la cella e apre “Gestisci tabella”',
        'Client notes: right-click on a table auto-selects a cell and opens “Manage table”'
      )
    ]
  },
  {
    version: '1.2.8',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix immagini non visibili in editor (serializzazione ImageNode corretta)',
        'Client notes: fixed images not rendering in editor (correct ImageNode serialization)'
      ),
      n(
        'Note cliente: tasto destro su tabella apre “Gestisci tabella” (righe/colonne/elimina)',
        'Client notes: right-click on a table opens “Manage table” (rows/columns/delete)'
      )
    ]
  },
  {
    version: '1.2.7',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix menu contestuale (duplica/copia) che rimaneva bloccato e non eseguiva le azioni',
        'Client notes: fixed context menu (duplicate/copy) that could get stuck and not execute actions'
      ),
      n(
        'Note cliente: toolbar Lexical più “playground-like” con menu Inserisci (linea orizzontale, immagine, tabella) e controlli dimensione ±',
        'Client notes: more “playground-like” Lexical toolbar with an Insert menu (horizontal rule, image, table) and size ± controls'
      )
    ]
  },
  {
    version: '1.2.6',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Note cliente: passaggio nota dopo “Salva” corretto (non resetta più alla prima nota)',
        'Client notes: switching notes after “Save” fixed (no longer resets to the first note)'
      ),
      n(
        'Note cliente: immagini visibili anche quando la nota viene importata da HTML (fallback) + resize come prima',
        'Client notes: images now render even when the note is imported from HTML (fallback) + resizing works as before'
      ),
      n(
        'Note cliente: gestione tabella (aggiungi/elimina righe e colonne) + font moderni aggiuntivi',
        'Client notes: table management (add/delete rows and columns) + extra modern fonts'
      ),
      n(
        'Note cliente: ricerca anche nel testo, duplicazione, drag&drop riordino, copia su altro cliente',
        'Client notes: search inside text, duplication, drag&drop reorder, copy to another client'
      ),
      n(
        'Changelog: si chiude cliccando fuori (come Info)',
        'Changelog: closes on outside click (like Info)'
      ),
      n(
        'Tooltip: stellina planimetria predefinita spiega il comportamento all’avvio',
        'Tooltip: default floor plan star explains startup behavior'
      )
    ]
  },
  {
    version: '1.2.5',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: modale “Inserisci link” (niente prompt) + Cmd/Ctrl+Click per aprire i link in nuova tab',
        'Client notes: “Insert link” modal (no prompt) + Cmd/Ctrl+Click to open links in a new tab'
      )
    ]
  },
  {
    version: '1.2.4',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix definitivo “Nuova nota” (il campo titolo ora accetta input anche con la modale aperta)',
        'Client notes: final fix for “New note” (title input now accepts typing while the modal is open)'
      )
    ]
  },
  {
    version: '1.2.3',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix focus “Nuova nota” (autofocus sul titolo) e focus automatico nell’editor dopo la creazione',
        'Client notes: fixed “New note” focus (autofocus on title) and automatic editor focus after creation'
      )
    ]
  },
  {
    version: '1.2.2',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix eliminazione note (non chiude la modale, elimina davvero anche dopo migrazione; mostra titolo nella conferma)',
        'Client notes: fixed note deletion (does not close the modal, actually deletes even after migration; shows the note title in the confirmation)'
      ),
      n(
        'Note cliente: migrazione automatica legacy → note multiple con pulizia dei campi legacy, per evitare che la “nota legacy” riappaia',
        'Client notes: automatic legacy → multi-notes migration with legacy fields cleared, preventing the “legacy note” from reappearing'
      ),
      n('UI: finestra Note cliente leggermente più larga', 'UI: slightly wider Client notes window')
    ]
  },
  {
    version: '1.2.1',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: nuova modale “Nuova nota” curata (niente prompt browser) + click su qualsiasi punto dell’area editor mette focus e puoi scrivere subito',
        'Client notes: polished “New note” modal (no browser prompt) + clicking anywhere in the editor area focuses and you can type immediately'
      ),
      n(
        'Note cliente: toolbar Lexical evoluta con stile paragrafo (H1/H2/H3/quote), font family e font size',
        'Client notes: upgraded Lexical toolbar with paragraph style (H1/H2/H3/quote), font family and font size'
      ),
      n(
        'Note cliente: elimina nota non richiede salvataggio (scarta eventuali modifiche locali)',
        'Client notes: deleting a note does not require saving (local edits are discarded)'
      )
    ]
  },
  {
    version: '1.2.0',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Note cliente: rework completo con supporto multi-note per cliente (titolo, lista, ricerca, creazione, eliminazione) + conferme su chiusura/cambio nota con modifiche non salvate',
        'Client notes: full rework with multi-notes per client (title, list, search, create, delete) + prompts when closing/switching with unsaved changes'
      ),
      n(
        'Backend: esternalizzazione immagini anche nelle note multiple (HTML e stato Lexical)',
        'Backend: externalize images also inside multi-notes (HTML and Lexical state)'
      )
    ]
  },
  {
    version: '1.1.0',
    date: '2025-12-24',
    type: 'major',
    notes: [
      n(
        'Note cliente: migrazione editor a Lexical (liste, link, tabelle e immagini molto più stabili) con resize immagini “stile Word” e salvataggio anche dello stato Lexical',
        'Client notes: migrated editor to Lexical (much more stable lists, links, tables and images) with Word-like image resizing and Lexical state persistence'
      ),
      n(
        'Backend: esternalizzazione immagini anche dallo stato Lexical (data:image → /uploads) per evitare JSON enormi',
        'Backend: externalize images from Lexical state too (data:image → /uploads) to avoid huge JSON payloads'
      ),
      n(
        'Selezione multipla: “Scala a tutti” in Modifica rapida oggetti ora aggiorna tutti in modo affidabile e imposta la scala default per i nuovi oggetti',
        'Multi-selection: “Scale for all” in Quick edit objects now updates all reliably and sets the default scale for new objects'
      ),
      n(
        'Menu oggetto: mostrato il valore numerico della scala nel menu tasto destro',
        'Object menu: shows the numeric scale value in the right-click menu'
      )
    ]
  },
  {
    version: '1.0.24',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Modifica rapida oggetti: aggiunta “Scala a tutti” (applica la scala a tutti i selezionati e la salva come default per i nuovi oggetti)',
        'Quick edit objects: added “Scale for all” (applies scale to all selected and saves it as default for new objects)'
      ),
      n(
        'Note cliente: elenco numerato reso più stabile forzando list-style inline (decimal/disc)',
        'Client notes: numbered list made more stable by forcing inline list-style (decimal/disc)'
      )
    ]
  },
  {
    version: '1.0.23',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: aggiunto pulsante “Rimuovi elenco” per trasformare UL/OL in testo semplice prima di riapplicare puntato/numerato',
        'Client notes: added “Remove list” button to convert UL/OL into plain text before re-applying bulleted/numbered lists'
      )
    ]
  },
  {
    version: '1.0.22',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix conversione elenchi per selezioni “multi-riga” in cui il browser incapsula le righe in DIV contenitore (ora genera un punto/numero per ogni riga)',
        'Client notes: fixed list conversion for multi-line selections where the browser wraps lines in a container DIV (now creates one bullet/number per line)'
      )
    ]
  },
  {
    version: '1.0.21',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: conversione elenchi (puntato ↔ numerato) corretta anche quando la selezione è già dentro una lista',
        'Client notes: list conversion (bulleted ↔ numbered) fixed also when the selection is already inside a list'
      )
    ]
  },
  {
    version: '1.0.20',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: conversione elenchi resa “hard reset” (sostituisce la selezione con una nuova lista, azzerando elenchi misti) per evitare punti/numeri errati',
        'Client notes: list conversion made a “hard reset” (replaces the selection with a fresh list, flattening mixed lists) to avoid wrong bullets/numbers'
      )
    ]
  },
  {
    version: '1.0.19',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: rework conversione elenchi per selezione multi-riga (ora tutte le righe selezionate diventano puntate/numerate correttamente)',
        'Client notes: reworked list conversion for multi-line selections (all selected lines become correctly bulleted/numbered)'
      )
    ]
  },
  {
    version: '1.0.18',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Note cliente: “Salva” non chiude più la modale, mostra “Ultimo salvataggio” con data/utente e chiede conferma se chiudi con modifiche non salvate',
        'Client notes: “Save” no longer closes the modal, shows “Last saved” with date/user and asks confirmation when closing with unsaved changes'
      ),
      n(
        'Note cliente: caricamento allegati PDF direttamente dalla modale note',
        'Client notes: upload PDF attachments directly from the notes modal'
      ),
      n(
        'Export PDF note: aggiunti marker espliciti per elenchi puntati e numerati (html2canvas)',
        'Notes PDF export: added explicit markers for bulleted and numbered lists (html2canvas)'
      ),
      n(
        'Editor note: elenchi “forzati” su selezione mista (tutte le righe diventano puntate o numerate)',
        'Notes editor: forced list conversion on mixed selections (all lines become bulleted or numbered)'
      )
    ]
  },
  {
    version: '1.0.17',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: allineamento immagini (sx/centro/dx) ora funziona anche dentro le celle delle tabelle',
        'Client notes: image alignment (left/center/right) now works also inside table cells'
      )
    ]
  },
  {
    version: '1.0.16',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Note cliente: ridimensionamento immagini manuale con maniglie agli angoli (stile Word)',
        'Client notes: manual image resizing with corner handles (Word-like)'
      )
    ]
  },
  {
    version: '1.0.15',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: elenchi e link ora sono visibili (stile) e i link si aprono con Ctrl/Cmd+click; aggiunto pulsante “Rimuovi formattazione”',
        'Client notes: lists and links are now visible (styling) and links open with Ctrl/Cmd+click; added “Clear formatting”'
      ),
      n(
        'Note cliente: ridotta la persistenza di formattazione dopo la cancellazione di righe (pulizia formattazione vuota)',
        'Client notes: reduced formatting “stickiness” after deleting lines (cleanup of empty formatting)'
      )
    ]
  },
  {
    version: '1.0.14',
    date: '2025-12-24',
    type: 'fix',
    notes: [
      n(
        'Note cliente: fix selezione editor per link ed elenchi (puntati/numerati) che ora funzionano correttamente',
        'Client notes: fixed editor selection so links and lists (bulleted/numbered) work correctly'
      ),
      n('Clienti: menu tasto destro aggiunta voce “Allegati” per aprire/scaricare i PDF caricati', 'Clients: right-click menu added “Attachments” to open/download uploaded PDFs')
    ]
  },
  {
    version: '1.0.13',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Note cliente: aggiunti comandi per modificare tabelle (aggiungi/elimina righe e colonne) e ridimensionare immagini',
        'Client notes: added controls to edit tables (add/delete rows and columns) and resize images'
      ),
      n('Note cliente: export PDF delle note', 'Client notes: PDF export for notes')
    ]
  },
  {
    version: '1.0.12',
    date: '2025-12-24',
    type: 'minor',
    notes: [
      n(
        'Clienti: aggiunte “Note cliente” (menu tasto destro) con editor formattato stile word (testo, immagini, tabelle) e salvataggio nello stato',
        'Clients: added “Client notes” (right-click menu) with a word-like rich editor (text, images, tables) stored in state'
      ),
      n(
        'Backend: immagini inserite nelle note vengono esternalizzate in /uploads per evitare HTML/JSON enormi',
        'Backend: embedded images inside notes are externalized to /uploads to avoid huge HTML/JSON payloads'
      ),
      n(
        'Permessi: le note cliente sono modificabili da admin e da utenti con permesso cliente in lettura+scrittura',
        'Permissions: client notes are editable by admins and by users with client-level read/write permission'
      )
    ]
  },
  {
    version: '1.0.11',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Stabilità canvas: aggiunto watchdog per ripristinare Stage/viewport in caso di dimensioni 0 o trasformazioni invalide (riduce i casi di mappa che sparisce)',
        'Canvas stability: added a watchdog to recover Stage/viewport from 0-size or invalid transforms (reduces map disappear cases)'
      ),
      n(
        'Ricerca: indicizzazione memoizzata (plan corrente + cliente) per ridurre lavoro e GC su ricerche ripetute',
        'Search: memoized indexing (current plan + client) to reduce work and GC on repeated searches'
      ),
      n(
        'Performance: CanvasStage ottimizzato eliminando find() ripetuti sui collegamenti; SearchResultsModal memoizza la mappa tipi',
        'Performance: optimized CanvasStage by removing repeated find() on links; SearchResultsModal memoizes type map'
      )
    ]
  },
  {
    version: '1.0.10',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Selezione: conteggio totale oggetti+collegamenti (“N elementi”) e dettagli collegamento selezionato nella barra in alto',
        'Selection: total count objects+links (“N items”) and selected link details in the top bar'
      ),
      n(
        'Modifica selezione: aggiunta eliminazione oggetti dalla lista + voce menu “Modifica rapida oggetti”',
        'Edit selection: added delete actions for objects from the list + renamed menu to “Quick edit objects”'
      ),
      n('Shortcut: aggiunto Ctrl/Cmd+A per selezionare tutti gli oggetti', 'Shortcut: added Ctrl/Cmd+A to select all objects')
    ]
  },
  {
    version: '1.0.9',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Collegamenti: doppio click ora permette di modificare anche stile (colore/spessore/tratteggio) oltre a nome/descrizione',
        'Links: double-click now edits style too (color/width/dashed) in addition to name/description'
      ),
      n('Aiuto/README: aggiornati comandi e scorciatoie', 'Help/README: updated commands and shortcuts')
    ]
  },
  {
    version: '1.0.8',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Modifica selezione: inclusi anche i collegamenti (se selezionati o tra oggetti selezionati) + controllo “Scala uguale per tutti” per aggiornare in blocco gli oggetti',
        'Edit selection: includes links too (selected or between selected objects) + “Set same scale for all” bulk control for objects'
      )
    ]
  },
  {
    version: '1.0.7',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Interazioni canvas: box selection stile desktop (trascina con sinistro su area vuota) + pan con tasto centrale o Cmd/Alt + click destro',
        'Canvas interactions: desktop-like box selection (left-drag on empty area) + pan with middle mouse or Cmd/Alt + right-click'
      )
    ]
  },
  {
    version: '1.0.6',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Selezione multipla: la matita in alto apre una lista degli oggetti selezionati; clic su un oggetto per modificarlo e ritorno automatico alla lista',
        'Multi-select: the top pencil opens a list of selected objects; click an item to edit it and automatically return to the list'
      )
    ]
  },
  {
    version: '1.0.5',
    date: '2025-12-23',
    type: 'minor',
    notes: [
      n(
        'Selezione multipla: aggiunta selezione a riquadro con Cmd+trascina (macOS) o Alt+trascina (Windows/Linux)',
        'Multi-select: added box selection with Cmd+drag (macOS) or Alt+drag (Windows/Linux)'
      ),
      n(
        'Collegamenti: migliorata la selezione aumentando l’area di click su tutta la linea',
        'Links: improved selection by increasing the clickable hit area along the whole line'
      ),
      n('Aiuto: aggiunta sezione scorciatoie da tastiera (IT/EN)', 'Help: added keyboard shortcuts section (IT/EN)')
    ]
  },
  {
    version: '1.0.4',
    date: '2025-12-22',
    type: 'minor',
    notes: [
      n(
        'Collegamenti: unificati collegamenti lineari e 90° nel layer Cablaggi + filtro visibilità unico',
        'Links: unified straight and 90° links under the Cabling layer + single visibility filter'
      ),
      n(
        'Collegamenti: modale “Mostra collegamenti” su oggetto con tabella (include tipo oggetto) + “Collega oggetti” su multi-selezione (2 oggetti)',
        'Links: “Show links” modal on objects with a table (includes object type) + “Link objects” for a 2-item multi-selection'
      ),
      n(
        'Collegamenti: doppio click su link (lineare o 90°) per modificare nome/descrizione',
        'Links: double-click any link (straight or 90°) to edit name/description'
      ),
      n(
        'PDF: indice più curato con logo Deskly + menu centrato + contatore pagine + Rev/data nel footer delle planimetrie',
        'PDF: nicer index page with Deskly logo + centered TOC + page counter + revision/date footer on plan pages'
      ),
      n(
        'PDF: opzioni aggiuntive “Includi collegamenti” e “Includi stanze”',
        'PDF: added “Include links” and “Include rooms” options'
      ),
      n(
        'Utenti reali: voce “Dettagli utente” nel menu con modale dei dati importati (WebAPI)',
        'Real users: “User details” context-menu item with a modal showing imported WebAPI data'
      ),
      n(
        'Stabilità canvas: resize re-sync quando la tab torna visibile per ridurre casi di mappa che sparisce/riappare',
        'Canvas stability: resize re-sync on tab visibility to reduce intermittent map disappear/reappear'
      ),
      n(
        'Auth: ridotto rumore di 401 su /api/auth/me a freddo (session hint locale)',
        'Auth: reduced noisy 401s on /api/auth/me on cold start (local session hint)'
      ),
    ]
  },
  {
    version: '1.0.3',
    date: '2025-12-22',
    type: 'minor',
    notes: [
      n(
        'Workspace: disabilitato autosave mentre ci sono modifiche non salvate (revisione) e aggiunto guard quando si apre Settings',
        'Workspace: autosave is disabled while there are unsaved (revision) edits and Settings navigation is now guarded'
      ),
      n(
        'Backup: export asset più robusto (supporta URL assoluti /uploads) + import persiste subito su server (/api/state) per reimportare anche planimetrie/immagini',
        'Backup: more robust asset export (supports absolute /uploads URLs) + import now persists immediately via /api/state to restore floor plans/images'
      ),
      n(
        'Utenti reali: gestione “missing” migliorata (mostra dove sono allocati, selezione multipla, rimozione crea revisioni e scrive audit)',
        'Real users: improved “missing” workflow (shows allocations, multi-select, removal creates revisions and writes audit)'
      ),
      n(
        'Oggetti: scala minima ridotta (fino a 0.20) con step più fine',
        'Objects: lower minimum scale (down to 0.20) with finer steps'
      ),
      n(
        'Cablaggi: nuova linea a 90° “magnetica” tra oggetti con colore/spessore/tratteggio/nome/descrizione ed edit da menu',
        'Cables: new 90° “magnetic” cable between objects with color/width/dash/name/description and edit from context menu'
      )
    ]
  },
  {
    version: '1.0.2',
    date: '2025-12-22',
    type: 'minor',
    notes: [
      n(
        'Campi personalizzati: creazione semplificata (solo Etichetta + Tipo campo; chiave generata automaticamente)',
        'Custom fields: simplified creation (Label + Field type only; key is auto-generated)'
      ),
      n(
        'Logs: paginazione + selettore righe (max 200) + export CSV + svuota log (solo superadmin)',
        'Logs: pagination + rows-per-page selector (max 200) + CSV export + clear logs (superadmin only)'
      ),
      n(
        'Backup: selezione planimetrie da esportare (albero) + export include campi custom e filtra “Utente reale” dagli oggetti',
        'Backup: export selection tree + export includes custom fields and filters out “Real user” objects'
      ),
      n(
        'PDF: opzione “Includi oggetti” (default ON) per esportare planimetria + marker senza UI',
        'PDF: “Include objects” option (default ON) to export the plan with markers (no UI)'
      ),
      n(
        'Area di stampa: toast di conferma su impostazione/rimozione',
        'Print area: confirmation toasts on set/clear'
      )
    ]
  },
  {
    version: '1.0.1',
    date: '2025-12-19',
    type: 'minor',
    notes: [
      n(
        'Oggetti: gestione palette spostata in Settings → Oggetti (lista per-utente, parte vuota, “Aggiungi oggetto” da elenco disponibile)',
        'Objects: palette management moved to Settings → Objects (per-user list, starts empty, “Add object” from the available catalog)'
      ),
      n(
        'Oggetti: nel workspace la palette mostra solo gli oggetti abilitati per l’utente (ordine personalizzato)',
        'Objects: in the workspace, the palette shows only the user-enabled objects (custom order)'
      ),
      n(
        'Campi custom: tasto destro su un oggetto abilitato nei Settings → Oggetti per aggiungere campi personalizzati (testo/numero/booleano)',
        'Custom fields: right-click an enabled object in Settings → Objects to add custom fields (text/number/boolean)'
      ),
      n(
        'MFA: aggiunta guida rapida in Account per generare/scansionare il QR e confermare il codice',
        'MFA: added a quick guide in Account to generate/scan the QR and confirm the code'
      )
    ]
  },
  {
    version: '1.0.0',
    date: '2025-12-19',
    type: 'major',
    notes: [
      n(
        'Realtime: lock esclusivo per planimetria + presenza utenti online (evita conflitti)',
        'Realtime: exclusive floor plan lock + online presence (prevents conflicts)'
      ),
      n(
        'Audit trail: log eventi importanti + modalità “Estesa” attivabile dai superadmin',
        'Audit trail: important events log + optional “Extended” mode for superadmins'
      ),
      n(
        'Template: duplica una planimetria come base (stanze/viste/livelli e opzionalmente oggetti)',
        'Templates: duplicate a floor plan as a starting point (rooms/views/layers, optionally objects)'
      ),
      n(
        'Layers: livelli multi‑selezionabili per oggetti + toggle visibilità per lavorare per “strati”',
        'Layers: multi-select layers for objects + visibility toggles to work by “layers”'
      ),
      n(
        'Backup: export/import workspace in JSON (opzione include immagini/allegati) + export Excel completo',
        'Backup: workspace JSON export/import (optional embedded images/attachments) + full Excel export'
      ),
      n(
        'Griglia: overlay opzionale + snap a griglia configurabile per posizionamenti precisi',
        'Grid: optional overlay + configurable grid snapping for precise placement'
      ),
      n(
        'Collegamenti: connessioni tra oggetti (freccia) con creazione da menu e cancellazione',
        'Links: connections between objects (arrow) with context-menu creation and deletion'
      ),
      n(
        'Sicurezza: MFA TOTP opzionale (enable/disable) + rate‑limit sui tentativi di login',
        'Security: optional TOTP MFA (enable/disable) + login attempt rate limiting'
      ),
      n(
        'PWA: installabile e con cache offline di asset e planimetrie già visitate (/uploads, /seed)',
        'PWA: installable with offline caching for visited assets and floor plans (/uploads, /seed)'
      ),
      n(
        'Utenti reali: import “Custom Import” per Cliente (WebAPI POST + Basic Auth) e nuovo oggetto “Utente reale” con picker e filtro “solo non assegnati”',
        'Real users: per-Client “Custom Import” (WebAPI POST + Basic Auth) and new “Real user” object with picker and “only unassigned” filter'
      ),
      n(
        'UI: “Custom Import” spostato in una tab dedicata nei Settings (con info box e strumenti Test/Import/Resync)',
        'UI: “Custom Import” moved to its own Settings tab (with an info box and Test/Import/Resync tools)'
      ),
      n(
        'Custom Import: supporto body JSON opzionale (oltre a Basic Auth) per API che richiedono payload (default {})',
        'Custom Import: optional JSON body support (in addition to Basic Auth) for APIs that require a payload (default {})'
      ),
      n(
        'Custom Import: parser più tollerante per risposte “frammento JSON” e debug della risposta ricevuta in caso di errore',
        'Custom Import: more tolerant parsing for “JSON fragment” responses and debug preview of the received response on errors'
      ),
      n(
        'Custom Import: configurazione comprimibile con timestamp ultimo salvataggio e messaggi Test/Import più chiari',
        'Custom Import: collapsible configuration with “last saved” timestamp and clearer Test/Import messaging'
      ),
      n(
        'PDF: export “plan-only” ottimizzato (sfondo bianco, compressione JPEG, niente UI/toolbar) per file più leggeri e zoom leggibile',
        'PDF: optimized “plan-only” export (white background, JPEG compression, no UI/toolbar) for smaller files and readable zoom'
      ),
      n(
        'Stampa: area di stampa per planimetria (rettangolo) + indicatore nell’albero + stampa multipla con selezione Clienti/Sedi/Planimetrie e indice cliccabile',
        'Print: per-floor-plan print area (rectangle) + tree indicator + multi-print with Client/Site/Floor plan selection and clickable index'
      ),
      n(
        'Palette: preferiti per utente (selezione + ordinamento) con gestione da Settings → Oggetti',
        'Palette: per-user favorites (selection + ordering) managed from Settings → Objects'
      ),
      n(
        'UI: controlli griglia (Snap/Show/Step) spostati nella barra in alto per liberare spazio nella palette',
        'UI: grid controls (Snap/Show/Step) moved to the top bar to free up palette space'
      ),
      n(
        'Stanze: supporto colori per stanza (rettangoli e poligoni) + bordo più pulito',
        'Rooms: per-room colors (rectangles and polygons) + cleaner outline'
      ),
      n(
        'Fix: il ridimensionamento/spostamento delle stanze poligonali non “salta” più di posizione',
        'Fix: polygon room resize/move no longer “jumps” to a different position'
      ),
      n(
        'Fix: prevenuti resize transitori a dimensioni 0 che potevano far sparire la mappa finché non si faceva refresh',
        'Fix: prevented transient 0-size resizes that could make the map disappear until a refresh'
      ),
      n(
        'Menu: tasto destro ora funziona su tutta l’area di lavoro (anche fuori dalla planimetria visibile)',
        'Menu: right-click now works across the whole workspace area (even outside the visible floor plan)'
      ),
      n(
        'Area di stampa: aggiunta voce “Mostra/Nascondi area di stampa” dal menu contestuale (overlay opzionale)',
        'Print area: added “Show/Hide print area” in the context menu (optional overlay)'
      ),
      n(
        'Oggetti: nel menu “Aggiungi oggetto…” vengono mostrati solo i tipi non già presenti nei preferiti della palette (quando i preferiti sono attivi)',
        'Objects: the “Add object…” menu shows only types not already in palette favorites (when favorites are enabled)'
      ),
      n(
        'Campi personalizzati (per utente): definizione campi per tipo oggetto (testo/numero/booleano) e valori per-oggetto',
        'Custom fields (per user): define per-type object fields (text/number/boolean) and per-object values'
      ),
      n(
        'Lock “duro”: il backend blocca la sovrascrittura di planimetrie bloccate da altri utenti anche in caso di salvataggi concorrenti',
        'Hard lock: the backend prevents overwriting floor plans locked by other users even during concurrent saves'
      ),
      n(
        'Auth: header `Cache-Control: no-store` sulle API e fetch “no-store” su /api/auth/me per evitare stati di login obsoleti dopo restart',
        'Auth: `Cache-Control: no-store` on API responses and a no-store fetch for /api/auth/me to avoid stale login state after restart'
      )
    ]
  },
  {
    version: '0.11.2',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Traduzioni: revisione estesa UI (modali, watermark, bottoni) + refresh pagina quando si cambia lingua',
        'Translations: extended UI review (modals, watermarks, buttons) + full page refresh when switching language'
      ),
      n(
        'Clienti: “Nome breve” obbligatorio (max 12, tooltip) + “Ragione sociale estesa” obbligatoria + PDF allegati apribili in nuova tab',
        'Clients: required “Short name” (max 12, tooltip) + required “Full legal name” + PDF attachments can be opened in a new tab'
      ),
      n(
        'Sedi: coordinate opzionali con link Google Maps (anche da menu contestuale)',
        'Sites: optional coordinates with Google Maps link (also from context menu)'
      ),
      n(
        'Sidebar: ricerca client/sede/planimetria e ordinamento clienti via drag&drop salvato per utente',
        'Sidebar: search client/site/floor plan and per-user client ordering via drag&drop'
      ),
      n(
        'Upload planimetrie: indicati formati accettati (JPG/PNG) e input bloccato su quei tipi',
        'Floor plan upload: accepted formats shown (JPG/PNG) and file inputs restricted to those types'
      )
    ]
  },
  {
    version: '0.11.1',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Login dopo riavvio server: le sessioni vengono invalidate al reboot/redeploy (richiesto nuovo accesso)',
        'Login after server restart: sessions are invalidated on reboot/redeploy (new login required)'
      ),
      n(
        'Utenti: creazione utente con conferma password e requisiti “password forte” (maiuscola/minuscola/numero/simbolo)',
        'Users: user creation now includes password confirmation and “strong password” requirements (upper/lower/number/symbol)'
      ),
      n(
        'Footer: tooltip tradotti (GitHub/Email) e .gitignore aggiornato per lockfile e dati runtime',
        'Footer: translated tooltips (GitHub/Email) and updated .gitignore for lockfile and runtime data'
      )
    ]
  },
  {
    version: '0.11.0',
    date: '2025-12-19',
    type: 'minor',
    notes: [
      n(
        'Bootstrap: un solo superadmin predefinito (username: superadmin, password: deskly) con cambio password obbligatorio al primo accesso',
        'Bootstrap: a single default superadmin (username: superadmin, password: deskly) with mandatory password change on first login'
      ),
      n(
        'First-run: schermata dedicata per impostare nuova password e lingua (IT/EN)',
        'First-run: dedicated screen to set a new password and language (IT/EN)'
      ),
      n(
        'Seed: workspace iniziale “ACME Inc. → Wall Street 01 → Floor 0” con planimetria di esempio centrata (senza oggetti)',
        'Seed: initial workspace “ACME Inc. → Wall Street 01 → Floor 0” with a centered sample floor plan (no objects)'
      )
    ]
  },
  {
    version: '0.10.1',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Stanze: “Nuova stanza” ora è un menu con Rettangolo/Poligono (traduzioni ripulite)',
        'Rooms: “New room” is now a submenu with Rectangle/Polygon (cleaned up translations)'
      ),
      n(
        'Stanze: bordo tratteggiato più sottile e vertici più piccoli',
        'Rooms: thinner dashed border and smaller vertices'
      ),
      n(
        'Ricerca: ora include anche le stanze (blink del perimetro)',
        'Search: now includes rooms as well (perimeter blink)'
      )
    ]
  },
  {
    version: '0.10.0',
    date: '2025-12-19',
    type: 'minor',
    notes: [
      n(
        'Stanze: aggiunta “stanza irregolare” disegnata a poligono (clic multipli, chiusura su primo punto o Invio)',
        'Rooms: added “irregular room” polygon drawing (multiple clicks, close by clicking first point or pressing Enter)'
      ),
      n(
        'Stanze: modifica perimetro poligono trascinando i vertici; spostamento stanza tramite drag',
        'Rooms: edit polygon perimeter by dragging vertices; move the room by dragging'
      ),
      n(
        'Changelog: contenuti IT/EN in base alla lingua (anche export PDF)',
        'Changelog: content is now IT/EN based on language (including PDF export)'
      ),
      n(
        'Performance: ottimizzato bounding box selezione (Set invece di includes) e preview poligono con requestAnimationFrame',
        'Performance: optimized selection bounding box (Set instead of includes) and polygon preview via requestAnimationFrame'
      )
    ]
  },
  {
    version: '0.9.4',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Login: in sviluppo (NODE_ENV != production) il server ruota la chiave di sessione ad ogni avvio, quindi un restart forza sempre la schermata di login',
        'Login: in development (NODE_ENV != production) the server rotates the session signing key on each start, so a restart always forces the login screen'
      ),
      n(
        'CI: workflow `security-audit` ora fallisce solo per vulnerabilità con severità >= high (riduce falsi allarmi su low/moderate)',
        'CI: the `security-audit` workflow now fails only for vulnerabilities with severity >= high (reduces noise from low/moderate)'
      )
    ]
  },
  {
    version: '0.9.3',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Cambio planimetria con modifiche non salvate: “Cambia senza salvare” ripristina davvero lo stato precedente (ultima revisione o snapshot iniziale)',
        'Switching floor plans with unsaved changes: “Switch without saving” now truly restores the previous state (latest revision or initial snapshot)'
      ),
      n(
        'Albero sidebar: menu tasto destro sulla planimetria con “Time machine…” (rispetta il flusso di salvataggio se ci sono modifiche)',
        'Sidebar tree: floor plan right-click menu now includes “Time machine…” (and respects the save flow when there are unsaved changes)'
      ),
      n(
        'Time machine: pulsante “Confronta” per selezionare 2 revisioni e visualizzarle (A più nuova sopra, B più vecchia sotto) con breadcrumb e date',
        'Time machine: “Compare” button to select 2 revisions and view them (newer A on top, older B below) with breadcrumb and dates'
      ),
      n(
        'Fix: risolto crash nel confronto revisioni quando la selezione cambia/si chiude la modale',
        'Fix: resolved a crash in revision compare when selection changes / modal closes'
      )
    ]
  },
  {
    version: '0.9.2',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Performance: Canvas separato in layer (sfondo/stanze/oggetti) per evitare redraw dell’immagine durante drag e ridurre drasticamente `drawImage`',
        'Performance: canvas split into layers (background/rooms/objects) to avoid redrawing the image during drag and drastically reduce `drawImage` calls'
      ),
      n(
        'Performance: ResizeObserver throttled con `requestAnimationFrame` per prevenire `setHeight/resizeDOM` ripetuti',
        'Performance: ResizeObserver throttled via `requestAnimationFrame` to prevent repeated `setHeight/resizeDOM`'
      ),
      n(
        'Performance: PlanView non sottoscrive più l’intero Zustand store (selector granulari) per evitare render storm e lag in input/modali',
        'Performance: PlanView no longer subscribes to the entire Zustand store (granular selectors) to avoid render storms and input/modal lag'
      )
    ]
  },
  {
    version: '0.9.1',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Performance: ridotti re-render inutili (App/Sidebar/Help) usando selector Zustand granulari',
        'Performance: reduced unnecessary re-renders (App/Sidebar/Help) using granular Zustand selectors'
      ),
      n(
        'Autosave: per admin evita di rimpiazzare l’intero grafo state a ogni save (riduce GC e possibile churn Konva); aggiorna dal server solo quando serve (data URL → /uploads)',
        'Autosave: for admins avoid replacing the whole state graph on every save (reduces GC and possible Konva churn); refresh from server only when needed (data URL → /uploads)'
      ),
      n(
        'Canvas: ResizeObserver non aggiorna lo state se le dimensioni non cambiano (evita loop di resize)',
        'Canvas: ResizeObserver does not update state if dimensions did not change (prevents resize loops)'
      )
    ]
  },
  {
    version: '0.9.0',
    date: '2025-12-19',
    type: 'minor',
    notes: [
      n(
        'Palette: nomi oggetti tradotti ITA/ENG e guidati dal catalogo tipi oggetto',
        'Palette: object names translated IT/EN and driven by the object type catalog'
      ),
      n(
        'Settings: nuova sezione “Oggetti” per creare tipi personalizzati (IT/EN) e scegliere icone da una lista coerente',
        'Settings: new “Objects” section to create custom types (IT/EN) and pick icons from a consistent set'
      ),
      n(
        'Icone: puoi cambiare l’icona anche dei tipi esistenti; tutti gli oggetti in mappa si aggiornano automaticamente',
        'Icons: you can change icons for existing types; all map objects update automatically'
      ),
      n(
        'PDF: lista oggetti esportata con il nome tipo (non solo id) dove disponibile',
        'PDF: exported object list uses the type label (not just the id) when available'
      )
    ]
  },
  {
    version: '0.8.5',
    date: '2025-12-19',
    type: 'fix',
    notes: [
      n(
        'Performance: ridotto drasticamente il lavoro sul main thread durante typing/drag evitando re-render del canvas per eventi non correlati',
        'Performance: drastically reduced main-thread work during typing/drag by avoiding canvas re-renders for unrelated events'
      ),
      n(
        'PlanView: subscription Zustand granulari (shallow selector) e rimossa dipendenza da toast updates per prevenire render storm',
        'PlanView: granular Zustand subscriptions (shallow selectors) and removed toast-driven updates to prevent render storms'
      ),
      n(
        'Data store: aggiornamenti con structural sharing (no deep-clone totale) per evitare GC churn e riferimenti che cambiavano inutilmente',
        'Data store: updates use structural sharing (no full deep-clone) to avoid GC churn and unnecessary reference changes'
      ),
      n(
        'Canvas: `CanvasStage` memoized + callback stabilizzate per non rigenerare migliaia di nodi Konva durante input/modali',
        'Canvas: `CanvasStage` memoized + stabilized callbacks to avoid regenerating thousands of Konva nodes during input/modals'
      )
    ]
  },
  {
    version: '0.8.4',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Performance: eliminato JSON.stringify massivo dello state (soprattutto con immagini/asset in data URL) per evitare GC churn e rallentamenti progressivi',
        'Performance: removed massive JSON.stringify of the state (especially with data URL images/assets) to avoid GC churn and progressive slowdowns'
      ),
      n(
        'Autosave: salvataggi serializzati (no richieste concorrenti) con debounce più robusto e aggiornamento state canonico dal server',
        'Autosave: serialized saves (no concurrent requests) with stronger debounce and canonical state update from the server'
      ),
      n(
        'Backend: planimetrie/loghi/allegati in data URL vengono salvati come file in `data/uploads` e referenziati via URL, riducendo drasticamente la dimensione dello state',
        'Backend: floor plans/logos/PDF attachments in data URLs are stored as files in `data/uploads` and referenced via URLs, drastically reducing state size'
      ),
      n(
        'Time machine: entrando nell’area di lavoro si parte sempre dal “presente” (non da una revisione selezionata in precedenza)',
        'Time machine: entering the workspace always starts from the “present” (not a previously selected revision)'
      ),
      n(
        'Canvas: cleanup onload icone SVG→Image per evitare setState dopo unmount',
        'Canvas: cleaned up SVG→Image onload handlers to avoid setState after unmount'
      )
    ]
  },
  {
    version: '0.8.3',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Utenti: aggiunta ricerca e colonna Attivo/Disattivo nella lista',
        'Users: added search and Active/Disabled column in the list'
      ),
      n(
        'Logs: ricerca immediata lato UI (oltre alla ricerca server con Invio/Refresh)',
        'Logs: instant UI search (in addition to server search via Enter/Refresh)'
      ),
      n(
        'Login: rimossi esempi credenziali dalla pagina',
        'Login: removed credential examples from the login page'
      ),
      n(
        'Footer: spostato in basso a destra e aggiunto link mailto: ottavio.falsini@me.com',
        'Footer: moved to bottom-right and added mailto: ottavio.falsini@me.com'
      ),
      n(
        'Changelog: tooltip sul badge versione',
        'Changelog: tooltip on the version badge'
      ),
      n(
        'Header: Aiuto spostato a destra di Impostazioni, Salva revisione evidenziato e abilitato solo con modifiche',
        'Header: Help moved to the right of Settings; Save revision highlighted and enabled only when there are changes'
      ),
      n(
        'Viste: nome bloccato a “Default” quando la vista è default',
        'Views: name is locked to “Default” when the view is the default'
      )
    ]
  },
  {
    version: '0.8.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'UI: Settings come sola icona top-right (accanto al menu utente), rimosso box account in sidebar',
        'UI: Settings as icon-only (top-right, next to user menu); removed redundant account box in sidebar'
      ),
      n(
        'Selezione: riclick su oggetto selezionato → deselect',
        'Selection: clicking a selected object again deselects it'
      ),
      n(
        'Settings: tab “Clienti” evidenziata; CRUD Clienti/Sedi via modali con pulsante “+”',
        'Settings: highlighted “Clients” tab; Clients/Sites CRUD via modals with “+” button'
      ),
      n(
        'Clienti: campi completi (nome breve usato nell’area di lavoro + ragione sociale estesa, indirizzo, contatti), logo auto-ridimensionato, allegati PDF',
        'Clients: full fields (short name used in workspace + legal name, address, contacts), auto-resized logo, PDF attachments'
      ),
      n(
        'Lingua: profilo utente ITA/ENG con switch nel menu utente e persistenza su DB',
        'Language: user profile IT/EN switch in the user menu with DB persistence'
      ),
      n(
        'Logs: ora registra solo login/logout (anche tentativi falliti) con legenda; rimossi eventi interni post-login',
        'Logs: now records only login/logout (including failed attempts) with legend; removed post-login internal events'
      ),
      n(
        'Security: aggiunti Dependabot e GitHub Action per `npm audit --omit=dev`',
        'Security: added Dependabot and a GitHub Action for `npm audit --omit=dev`'
      )
    ]
  },
  {
    version: '0.8.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Account menu: menu utente in alto a destra con “Gestione profilo” e “Logout”',
        'Account menu: top-right user menu with “Profile” and “Logout”'
      ),
      n(
        'Ruoli: introdotto superadmin (solo superadmin può creare admin e vedere audit log)',
        'Roles: introduced superadmin (only superadmin can create admins and see the audit log)'
      ),
      n(
        'Utenti: supporto disattivazione account, blocco modifica/reset/elimina superadmin per admin',
        'Users: added account disabling; admins cannot edit/reset/delete superadmins'
      ),
      n(
        'Audit log: tracciamento login/logout/me e accessi state (IP + request meta), pannello Logs in Settings (solo superadmin)',
        'Audit log: tracks login/logout/me and state access (IP + request meta); Logs panel in Settings (superadmin only)'
      ),
      n(
        'Settings: rimossa sezione Info e header semplificato',
        'Settings: removed Info section and simplified header'
      )
    ]
  },
  {
    version: '0.8.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Login: accesso obbligatorio con sessione (cookie) e utenti bootstrap admin/admin2',
        'Login: required authentication via session cookie with bootstrap users admin/admin2'
      ),
      n(
        'Utenti: gestione completa in Settings (anagrafica + reset/cambio password) con password hashate (scrypt)',
        'Users: full management in Settings (profile + reset/change password) with hashed passwords (scrypt)'
      ),
      n(
        'Permessi: assegnazione RO/RW per Cliente/Sede/Planimetria con enforcement lato server e UI in sola lettura',
        'Permissions: RO/RW per Client/Site/Floor plan with server-side enforcement and read-only UI'
      ),
      n(
        'Clienti: upload logo e visualizzazione in sidebar',
        'Clients: logo upload and display in the sidebar'
      ),
      n(
        'Changelog: export in PDF dal badge versione',
        'Changelog: PDF export from the version badge'
      ),
      n(
        'Stanze: disegno rettangolo + collegamento automatico oggetti, edit e delete con ricalcolo',
        'Rooms: rectangle drawing + automatic object linking, edit and delete with recalculation'
      )
    ]
  },
  {
    version: '0.7.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Selezione multipla: Ctrl/⌘ click per selezionare più oggetti, Canc elimina in batch con conferma',
        'Multi-selection: Ctrl/⌘ click to select multiple objects; Delete removes them in batch with confirmation'
      ),
      n(
        'Lista oggetti: ricerca + icone, click su un elemento → blink/highlight in mappa',
        'Object list: search + icons; clicking an item triggers blink/highlight on the map'
      ),
      n(
        'Revisioni: formato Rev X.Y con scelta Major/Minor al salvataggio, pulsante “Elimina tutte”, e diff aggiunti/rimossi',
        'Revisions: Rev X.Y format with Major/Minor choice on save, “Delete all” button, and added/removed diff'
      )
    ]
  },
  {
    version: '0.6.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n('Ricerca: highlight/blink dell’oggetto senza spostare la mappa', 'Search: highlight/blink the object without moving the map'),
      n(
        'Revisioni: salvataggio guidato (vX + nota), no-op se nessuna modifica, eliminazione revisioni dalla time machine',
        'Revisions: guided save (vX + note), no-op when there are no changes, delete revisions from the time machine'
      ),
      n(
        'Aggiorna planimetria: modal con scelta “riporta oggetti” o “rimuovi oggetti” + archivia automatica della precedente',
        'Update floor plan: modal to “keep objects” or “remove objects” + automatic archive of the previous one'
      ),
      n('Footer: “Sviluppato da Ottavio Falsini” con link GitHub', 'Footer: “Developed by Ottavio Falsini” with GitHub link')
    ]
  },
  {
    version: '0.5.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'PDF: export configurabile (orientamento auto/orizzontale/verticale + lista oggetti opzionale)',
        'PDF: configurable export (auto/landscape/portrait orientation + optional object list)'
      ),
      n(
        'Revisioni: “Salva revisione” crea uno storico immutabile (sola lettura) della planimetria e degli oggetti',
        'Revisions: “Save revision” creates an immutable (read-only) history of the floor plan and its objects'
      ),
      n(
        'Time machine: icona dedicata per navigare le revisioni e tornare al presente',
        'Time machine: dedicated icon to browse revisions and return to the present'
      ),
      n(
        'Settings: aggiunta planimetria via popup (nome + immagine) con blocco duplicati; update immagine archivia la precedente',
        'Settings: add floor plan via popup (name + image) with duplicate name prevention; image update archives the previous one'
      )
    ]
  },
  {
    version: '0.4.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Menu contestuale mappa: Salva vista, Vai a default, Aggiungi (palette), Esporta PDF, Elimina tutti gli oggetti',
        'Map context menu: Save view, Go to default, Add (palette), Export PDF, Delete all objects'
      ),
      n(
        'Viste: azioni a icone (stella/cestino), conferma delete e flusso guidato per riassegnare la default',
        'Views: icon actions (star/trash), delete confirmation, and guided flow to reassign the default'
      ),
      n(
        'Oggetti: duplica da menu con popup nome/descrizione e posizionamento accanto all’originale',
        'Objects: duplicate from context menu with name/description popup and placement next to the original'
      ),
      n(
        'Canvas: clamp pan rework per planimetrie piccole + centratura ricerca più affidabile',
        'Canvas: pan clamp rework for small floor plans + more reliable search centering'
      ),
      n(
        'UI marker: stile coerente con la palette (tile arrotondato + icona)',
        'UI markers: style aligned with the palette (rounded tile + icon)'
      )
    ]
  },
  {
    version: '0.3.3',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Layout: barra selezione oggetto resa stabile nella stessa riga del titolo per evitare shift della mappa',
        'Layout: selection bar kept stable on the title row to avoid the map shifting'
      )
    ]
  },
  {
    version: '0.3.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n('Toast: durata dimezzata', 'Toasts: duration halved'),
      n('Marker: label più vicina e più compatta', 'Markers: tighter label spacing'),
      n(
        'Performance: ottimizzata gestione keydown e conteggi oggetti (memoizzazione) per evitare rallentamenti progressivi',
        'Performance: optimized keydown handling and object counts (memoization) to avoid progressive slowdowns'
      )
    ]
  },
  {
    version: '0.3.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Oggetti: scala “sticky” (nuovi oggetti ereditano l’ultima scala impostata)',
        'Objects: “sticky” scale (new objects inherit the last used scale)'
      ),
      n('UI: marker e label ridotti (~25%) e label più compatta in palette', 'UI: markers/labels reduced (~25%) and tighter palette labels')
    ]
  },
  {
    version: '0.3.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'UX: delete da tastiera (Del/Backspace) con conferma, Enter per confermare ed Esc per annullare',
        'UX: keyboard delete (Del/Backspace) with confirmation, Enter to confirm and Esc to cancel'
      ),
      n(
        'UI: conteggio oggetti accanto al nome planimetria con breakdown per tipo e lista nomi',
        'UI: object count next to the floor plan name with per-type breakdown and name list'
      ),
      n(
        'Zoom: più fluido e fit non-upscale per evitare marker troppo grandi su planimetrie piccole',
        'Zoom: smoother and “no-upscale” fit to avoid huge markers on small floor plans'
      )
    ]
  },
  {
    version: '0.2.7',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Upload planimetria: lettura automatica dimensioni (width×height) e salvataggio nel modello FloorPlan',
        'Floor plan upload: automatically reads dimensions (width×height) and stores them in the FloorPlan model'
      ),
      n(
        'Maggiore precisione coordinate e base di scaling per mappe di dimensioni note',
        'Improved coordinate accuracy and scaling base for maps with known dimensions'
      )
    ]
  },
  {
    version: '0.2.6',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Ricerca: centratura usa lo zoom corrente del canvas per evitare mismatch durante wheel-zoom',
        'Search: centering uses current canvas zoom to avoid mismatches during wheel-zoom'
      ),
      n(
        'Drag oggetti: coordinate world corrette anche con stage scalata (fix mismatch e centratura)',
        'Object drag: correct world coordinates even with scaled stage (fix mismatch/centering)'
      ),
      n('Stabilità: clamp pan con guardie su dimensioni/NaN', 'Stability: pan clamping with guards for invalid dimensions/NaN')
    ]
  },
  {
    version: '0.2.5',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Ricerca: se ci sono più match, selezione del risultato prima della centratura',
        'Search: if there are multiple matches, select the result before focusing'
      ),
      n(
        'Stabilità centratura: guardie extra su coordinate non valide per evitare “mappa sparita”',
        'Centering stability: extra guards for invalid coordinates to prevent “map disappears”'
      )
    ]
  },
  {
    version: '0.2.4',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Ricerca: coordinate corrette per inserimento/centratura (bug conversione pointer→world)',
        'Search: correct coordinates for placement/centering (pointer→world conversion bug)'
      ),
      n(
        'Stabilità: clamp del pan per prevenire “mappa sparita” e drift dopo focus/zoom',
        'Stability: pan clamping to prevent “map disappears” and drift after focus/zoom'
      ),
      n('Panning/zoom più robusti con limiti elastici', 'More robust panning/zoom with elastic limits')
    ]
  },
  {
    version: '0.2.3',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Ricerca: rework centratura per evitare ri-applicazioni e panning “infinito”',
        'Search: centering rework to avoid repeated application and “infinite” panning'
      ),
      n(
        'Focus calcolato una sola volta per richiesta, con retry solo quando le dimensioni canvas sono pronte',
        'Focus computed once per request, retrying only when canvas dimensions are ready'
      )
    ]
  },
  {
    version: '0.2.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Ricerca: centratura spostata nel canvas per evitare misure DOM errate e pan/zoom NaN',
        'Search: centering moved into the canvas to avoid wrong DOM measurements and pan/zoom NaN'
      ),
      n(
        'Stabilità: evita salvataggi di viewport non validi e previene “mappa che sparisce”',
        'Stability: prevents saving invalid viewports and avoids “map disappears”'
      )
    ]
  },
  {
    version: '0.2.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Ricerca: centratura affidabile sull’oggetto trovato con highlight pulsante',
        'Search: reliable centering on the found object with highlight'
      ),
      n(
        'Stabilità viewport: annulla commit wheel pendenti quando la view viene aggiornata da ricerca/azioni',
        'Viewport stability: cancels pending wheel commits when the view is updated by search/actions'
      )
    ]
  },
  {
    version: '0.2.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Viste salvate per planimetria: salva zoom/pan con nome/descrizione e imposta una vista di default',
        'Saved views per floor plan: store zoom/pan with name/description and set a default view'
      ),
      n(
        'Menu a tendina “Viste” per richiamare, eliminare o cambiare la default (una sola default per planimetria)',
        '“Views” dropdown to recall, delete, or change the default (only one default per floor plan)'
      ),
      n(
        'Azione “Salva vista” nel menu contestuale (tasto destro) che salva la visualizzazione corrente',
        '“Save view” action in the context menu (right-click) to store the current viewport'
      )
    ]
  },
  {
    version: '0.1.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Persistenza viewport (pan/zoom) per planimetria e autofit disattivato se hai già posizionato la mappa',
        'Viewport persistence (pan/zoom) per floor plan and autofit disabled once you’ve positioned the map'
      ),
      n(
        'Palette sticky a destra in alto, canvas con bordo inferiore tipo tela, topbar ottimizzata',
        'Sticky palette on the top-right, canvas with a “paper” bottom border, optimized top bar'
      ),
      n(
        'Icona Settings a ingranaggio, popup delete mostra il nome dell’oggetto',
        'Settings icon as a gear; delete popup includes the object name'
      )
    ]
  },
  {
    version: '0.1.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Palette verticale e topbar con icone per Aiuto/Export + badge versione ricercabile',
        'Vertical palette and top bar with Help/Export icons + searchable version badge'
      ),
      n(
        'Pan della mappa trascinando lo sfondo, fit migliorato e controlli zoom compatti',
        'Map pan by dragging the background, improved fit and compact zoom controls'
      ),
      n(
        'Ricerca con Enter che centra e highlighta; footer info brand; logo aggiornato',
        'Search with Enter focuses and highlights; branded footer info; updated logo'
      )
    ]
  },
  {
    version: '0.0.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      n(
        'Fix fit planimetria caricata e immagini locali visibili',
        'Fix: floor plan fit and local images visibility'
      ),
      n(
        'Pan/zoom migliorati con fit automatico e drag per riposizionare',
        'Improved pan/zoom with automatic fit and drag to reposition'
      ),
      n(
        'Menu contestuale: duplica, scala oggetti, resize label',
        'Context menu: duplicate, object scaling, label resizing'
      )
    ]
  },
  {
    version: '0.0.1',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      n(
        'Versione iniziale: CRUD clienti/sedi/planimetrie, canvas oggetti drag&drop, ricerca, export PDF, help',
        'Initial release: CRUD clients/sites/floor plans, drag&drop object canvas, search, PDF export, help'
      )
    ]
  }
];
