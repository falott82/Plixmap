import type { ReleaseNote } from './types';
import { n } from './types';
import { partMidExtra } from './partMidExtra';

const partMidHead: ReleaseNote[] = [
  {
    version: '2.7.1',
    date: '2026-02-16',
    type: 'minor',
    notes: [
      n(
        'Scheda sicurezza in planimetria: ridimensionamento statico corretto (senza saltelli), stile azzurro con angoli retti, selezione al click e controlli +/- inline per la dimensione testo',
        'Floor-plan safety card: fixed static resize (no jitter), azure style with square corners, click selection, and inline +/- controls for text size'
      ),
      n(
        'Modale oggetto sicurezza: layout riorganizzato senza spazi vuoti (Nome full-width, Descrizione sotto Nome, Note sotto Descrizione)',
        'Safety object modal: layout reorganized with no empty gaps (Name full-width, Description below Name, Notes below Description)'
      ),
      n(
        'Impostazioni > Sicurezza: filtri per cliente/sede/planimetria/tipo, multi-selezione righe e azione “Mostra selezionati in mappa”',
        'Settings > Safety: filters by client/site/floor plan/type, row multi-selection, and “Show selected on map” action'
      ),
      n(
        'Mirino sicurezza: preview con immagine planimetria + corridoi + stanze, etichetta nome sopra target e gestione multi-planimetria tramite tendina',
        'Safety crosshair: preview now shows floor-plan image + corridors + rooms, target label above marker, and multi-plan selection via dropdown'
      ),
      n(
        'Sicurezza: esportazione PDF disponibile per schermata registro e preview mirino',
        'Safety: PDF export available for registry screen and crosshair preview'
      ),
      n(
        'Proprietà porta: rework UI con tipologia unica standard e opzioni Emergenza/Tagliafuoco/Apertura a rilevazione/Apertura automatizzata',
        'Door properties: UI rework with single standard type and Emergency/Fire-rated/Sensor opening/Automated opening options'
      ),
      n(
        'Ingresso in impostazioni: chiusura toast pendenti workspace e pulizia selezioni attive in planimetria',
        'Entering settings: dismisses pending workspace toasts and clears active floor-plan selections'
      )
    ]
  },
  {
    version: '2.7.0',
    date: '2026-02-14',
    type: 'minor',
    notes: [
      n(
        'Planimetria: rework completo della scheda sicurezza in formato “specchietto” compatto, più sottile, trascinabile e ridimensionabile direttamente sulla mappa',
        'Floor plan: complete rework of the safety card as a compact “quick panel”, thinner, draggable, and resizable directly on the map'
      ),
      n(
        'Scheda sicurezza: intestazione ridotta, pulsanti +/- rimossi e controllo dimensione font solo da tastiera (+ / -) quando la scheda è selezionata, con toaster guida',
        'Safety card: reduced header, +/- buttons removed, and keyboard-only font size control (+ / -) when the card is selected, with guidance toast'
      ),
      n(
        'Scheda sicurezza: numeri utili convertiti in testo lineare orizzontale (sequenza “| Nome Numero | …”) per lettura rapida in poco spazio',
        'Safety card: useful numbers now rendered as linear horizontal text (“| Name Number | …”) for quick reading in minimal space'
      ),
      n(
        'Pan/zoom planimetria: migliorata fluidità movimento della scheda sicurezza con posizionamento GPU-friendly (translate3d + scale)',
        'Floor plan pan/zoom: improved safety card motion smoothness with GPU-friendly positioning (translate3d + scale)'
      ),
      n(
        'Documenti sicurezza: tabella con ricerca, ordinamento colonne, filtro “Nascondi scaduti” e stato “Validità” in switch (verde=valido, grigio=archiviato)',
        'Safety documents: table now supports search, sortable columns, “Hide expired” filter, and “Validity” switch status (green=valid, gray=archived)'
      ),
      n(
        'Verifiche sicurezza: nuova azione “Nuova verifica (archivia attuale)” che sposta la verifica corrente nello storico archiviato',
        'Safety checks: new “New check (archive current)” action that moves the current check into archived history'
      ),
      n(
        'Oggetti sicurezza: icone rese univoche tra tipi sicurezza e resa grafica mappa aggiornata con interno/icone rosse',
        'Safety objects: icons are now unique across safety types and map rendering updated with red interior/icons'
      )
    ]
  },
  {
    version: '2.6.2',
    date: '2026-02-14',
    type: 'fix',
    notes: [
      n(
        'Rubrica emergenze: numeri utili colorati per scope (Generale/Cliente/Sede/Planimetria), ricerca rapida, modifica inline e colonna Scope aggiornata con il nome cliente/contesto',
        'Emergency directory: useful numbers are now color-coded by scope (Global/Client/Site/Plan), with quick search, inline editing, and an updated Scope column showing client/context names'
      ),
      n(
        'Rubrica emergenze: aggiunto flag “Mostra nel riquadro” per decidere quali numeri mostrare nella scheda sicurezza in planimetria',
        'Emergency directory: added “Show in plan card” flag to choose which numbers are displayed in the floor-plan safety card'
      ),
      n(
        'Planimetria: scheda sicurezza ancorata alla mappa (segue pan/zoom come un oggetto), ridimensionamento orizzontale, layout “Numeri utili | Punti di ritrovo” e rimozione etichetta “Trascina”',
        'Floor plan: safety card now map-anchored (follows pan/zoom like an object), horizontal resize, “Useful numbers | Meeting points” layout, and removed “Drag” label'
      ),
      n(
        'Palette workspace: aggiunto spazio di scorrimento inferiore per evitare il taglio del nome dell’ultimo oggetto',
        'Workspace palette: added bottom scrolling space to prevent clipping of the last object label'
      ),
      n(
        'Oggetti sicurezza: etichetta campo aggiornata in “Coordinate GPS oggetto”',
        'Safety objects: field label updated to “Object GPS coordinates”'
      ),
      n(
        'Modali documenti/storico sicurezza: risolto errore FocusTrap e ripristinata la piena modificabilità dei campi in inserimento',
        'Safety document/history modals: fixed FocusTrap error and restored full field editability during data entry'
      )
    ]
  },
  {
    version: '2.6.1',
    date: '2026-02-14',
    type: 'minor',
    notes: [
      n(
        'Sicurezza: introdotto il layer dedicato “Sicurezza” con palette oggetti prevenzione/emergenza (estintori, DAE, allarmi, sprinkler, valvole, primo soccorso, ecc.)',
        'Safety: added the dedicated “Safety” layer with a prevention/emergency object palette (extinguishers, AED, alarms, sprinklers, valves, first-aid, etc.)'
      ),
      n(
        'Oggetti sicurezza: form completo in inserimento/modifica con campi Nome obbligatorio, descrizione, note, ultima verifica, azienda verifica, coordinate GPS, allegati documento e storico revisioni',
        'Safety objects: full create/edit form with required Name, description, notes, last check, verifier company, GPS coordinates, document attachments and checks history'
      ),
      n(
        'Impostazioni: nuova tab “Sicurezza” con catalogo dispositivi inseriti in mappa + porte emergenza, ricerca/ordinamento/export CSV filtrato, mirino planimetria, storico check e documenti',
        'Settings: new “Safety” tab with catalog of mapped safety devices + emergency doors, filtered search/sort/CSV export, floor-plan crosshair preview, checks history and documents'
      ),
      n(
        'Impostazioni > Oggetti: rimossa la voce Porte dal menu e aggiunta la sezione “Sicurezza” per i tipi oggetto sicurezza predefiniti',
        'Settings > Objects: removed Doors from the menu and added the “Safety” section for built-in safety object types'
      ),
      n(
        'Porte corridoio: aggiunta opzione booleana “Tagliafuoco” e codifica [AU]/[TF]/[AU+TF] nel registro sicurezza con tooltip esplicativo',
        'Corridor doors: added boolean “Fire door” option and [AU]/[TF]/[AU+TF] tagging in safety registry with explanatory tooltip'
      ),
      n(
        'Rubrica emergenze: nuova gestione da tasto destro cliente con scope Generale/Cliente/Sede/Planimetria, permessi (superadmin/admin gestione, utenti sola consultazione) e scheda punti di ritrovo',
        'Emergency directory: new management from client right-click with Global/Client/Site/Plan scopes, permissions (superadmin/admin manage, users read-only) and emergency points sheet'
      ),
      n(
        'Planimetria: con layer Sicurezza attivo compare una scheda emergenza compatta e trascinabile con numeri utili e punti di ritrovo della planimetria corrente',
        'Floor plan: when Safety layer is active, a compact draggable emergency card appears with useful numbers and emergency points for the current floor plan'
      ),
      n(
        'Export PDF: aggiunta opzione “Includi layer sicurezza” per controllare l’esportazione dei dispositivi sicurezza',
        'PDF export: added “Include safety layer” option to control exporting safety devices'
      )
    ]
  },
  {
    version: '2.6.0',
    date: '2026-02-12',
    type: 'minor',
    notes: [
      n(
        'Porte corridoio: nuovo comando “Collega stanza” nel menu contestuale (multi-selezione stanze nella planimetria)',
        'Corridor doors: new “Link room” action in the context menu (multi-room selection on the current floor plan)'
      ),
      n(
        'Collega stanza: se il layer Stanze è nascosto viene mostrato automaticamente; ricerca per nome stanza e utenti contenuti nella stanza',
        'Link room: if the Rooms layer is hidden it is automatically shown; search by room name and users assigned to each room'
      ),
      n(
        'Collega stanza: stanza più vicina messa in cima con badge “(rilevata prossimità)” e rilevamento aggancio magnetico corridoio',
        'Link room: nearest room is pinned on top with “(proximity detected)” badge and corridor magnetic-match detection'
      ),
      n(
        'Porte: rendering spostato su layer overlay superiore per mantenerle sempre cliccabili; hover con elenco stanze collegate',
        'Doors: rendering moved to a top overlay layer to keep doors always clickable; hover now shows linked rooms'
      ),
      n(
        'Porte automatizzate: comando “Apri” eseguito in background senza aprire nuove schede, con feedback toast',
        'Automated doors: “Open” command now runs in background without opening new tabs, with toast feedback'
      )
    ]
  },
  {
    version: '2.5.1',
    date: '2026-02-10',
    type: 'fix',
    notes: [
      n('Presentazione: pulsante dedicato vicino al salvataggio + ESC per uscire; UI ridotta a sola planimetria in fullscreen', 'Presentation: dedicated button near Save + ESC to exit; fullscreen shows only the floor plan'),
      n('Menu tasto destro: aggiunto sottomenu Livelli per mostrare/nascondere rapidamente i layer', 'Right-click menu: added a Layers submenu to quickly show/hide layers'),
      n('Duplica planimetria: vietato creare una planimetria con lo stesso nome di un’altra nella stessa sede', 'Duplicate floor plan: cannot create a floor plan with the same name as another one in the same site'),
      n('Quick help: aggiunte spiegazioni Rack designer e migliorati dettagli su collegamenti/lock', 'Quick help: added Rack designer explanation and improved details for links/locks')
    ]
  },
  {
    version: '2.5.0',
    date: '2026-02-10',
    type: 'major',
    notes: [
      n(
        'Chat: rework completo stile WhatsApp Web con layout a 2 colonne (Gruppi clienti + DM utenti)',
        'Chat: full WhatsApp Web-inspired rework with a 2-column layout (customer groups + user DMs)'
      ),
      n(
        'Chat: gruppi in cima con logo cliente (se presente), vista compatta e sezioni collassabili; ricerca unica',
        'Chat: groups pinned on top with customer logo (if present), compact view and collapsible sections; unified search'
      ),
      n(
        'DM: ordinamento per ultima interazione + spunte di lettura (1 inviata, 2 consegnate, 2 lette)',
        'DM: ordered by last interaction + WhatsApp-like checkmarks (1 sent, 2 delivered, 2 read)'
      ),
      n(
        'Gruppi: apertura sul primo messaggio non letto; rimossi toast per i messaggi nei gruppi',
        'Groups: opens on the first unread message; removed toast notifications for group messages'
      ),
      n(
        'Notifiche: badge in alto con numero di mittenti diversi con messaggi non letti (DM + gruppi)',
        'Notifications: top badge shows the number of distinct senders with unread messages (DMs + groups)'
      ),
      n(
        'Blocchi: blocca/sblocca utenti con comportamento tipo WhatsApp; profilo non visibile se bloccato',
        'Blocks: block/unblock users with WhatsApp-like behavior; profile hidden when blocked'
      ),
      n(
        'Layout chat: pannello ridimensionabile + divisorio trascinabile con preferenze salvate sull’account; scorciatoie Cmd+K/P e Ctrl+P',
        'Chat layout: resizable panel + draggable divider with preferences saved on the account; shortcuts Cmd+K/P and Ctrl+P'
      )
    ]
  },
  {
    version: '2.4.3',
    date: '2026-02-10',
    type: 'fix',
    notes: [
      n(
        'Force unlock (Superadmin): rimossi “Vedi modifiche” e riepilogo; ora viene indicata solo la presenza di modifiche non salvate',
        'Force unlock (Superadmin): removed “View changes” and summary; now shows only whether there are unsaved changes'
      ),
      n(
        'Force unlock: avviso non chiudibile per il detentore del lock; può solo scegliere Salva e rilascia oppure Scarta e rilascia',
        'Force unlock: non-dismissible warning for the lock owner; they can only choose Save+release or Discard+release'
      ),
      n(
        'Force unlock: aggiunto pulsante “Annulla richiesta” per il superadmin; a scadenza/annullo il lock resta al detentore',
        'Force unlock: added “Cancel request” button for superadmin; on expiry/cancel the lock stays with the owner'
      ),
      n(
        'Force unlock: introdotti 2 timer (grace + finestra decisione 5 minuti) mostrati in secondi; i pulsanti restano disattivati fino a fine grace',
        'Force unlock: added 2 timers (grace + 5-minute decision window) shown in seconds; buttons stay disabled until grace ends'
      )
    ]
  },
  {
    version: '2.4.2',
    date: '2026-02-10',
    type: 'minor',
    notes: [
      n('Lock planimetrie: rimosse scadenza per inattività e logica TTL', 'Floor plan locks: removed inactivity expiry and TTL logic'),
      n('Unlock: richiesta disponibile per tutti gli utenti con tempo 0,5..60 minuti per prendere il lock (riserva con clessidra)', 'Unlock: requests available to all users with a 0.5..60 minute takeover window (hourglass reservation)'),
      n('UI lock: popover con ultima azione, ultimo salvataggio e revisione; badge in alto cliccabile', 'Lock UI: popover shows last action, last save, and revision; top badge is clickable'),
      n('Force unlock (Superadmin): countdown 0..60 minuti + “Vedi modifiche” e richiesta Salva/Scarta', 'Force unlock (Superadmin): 0..60 minute countdown + “View changes” and Save/Discard request')
    ]
  },
  {
    version: '2.4.1',
    date: '2026-02-07',
    type: 'fix',
    notes: [
      n('Chat: vocali stile WhatsApp (waveform), invio immediato allo stop e limite 10 minuti', 'Chat: WhatsApp-like voice notes (waveform), auto-send on stop, and 10-minute limit'),
      n('Chat: ricerca nella conversazione, elenco messaggi importanti e separatori data', 'Chat: in-chat search, starred messages list, and day separators'),
      n('Chat: reazioni aggiornate (aggiunto 👍/👎) e menu messaggi sistemato', 'Chat: updated reactions (added 👎) and fixed message action menu'),
      n('Chat: svuota chat richiede digitare "DELETE" (Super Admin)', 'Chat: clearing chat requires typing "DELETE" (Super Admin)')
    ]
  },
  {
    version: '2.4.0',
    date: '2026-02-07',
    type: 'minor',
    notes: [
      n('Chat per cliente: messaggi realtime con allegati (max 5MB), export (TXT/JSON/HTML) e badge non letti', 'Client chat: realtime messages with attachments (max 5MB), exports (TXT/JSON/HTML), and unread badges'),
      n('Chat: preview allegati stile WhatsApp, immagini in modale con download, elenco membri con stato online/offline', 'Chat: WhatsApp-like attachment preview, images in modal with download, members list with online/offline status'),
      n('Wi-Fi: moltiplicatore range (0..x20) nelle proprietà e nel menu contestuale', 'Wi-Fi: range multiplier (0..x20) in properties and context menu')
    ]
  },
  {
    version: '2.3.2',
    date: '2026-02-06',
    type: 'fix',
    notes: [
      n('Revisioni: eliminazione immutabile richiede digitare "DELETE" (Super Admin)', 'Revisions: immutable deletion requires typing "DELETE" (Super Admin)'),
      n('UI: tooltip "Immutabile" con definizione e implicazioni (snapshot in sola lettura)', 'UI: “Immutable” tooltip explains definition and implications (read-only snapshot)')
    ]
  },
  {
    version: '2.3.1',
    date: '2026-02-06',
    type: 'minor',
    notes: [
      n('Lock: richiesta unlock dal superadmin con feedback e rilascio guidato', 'Lock: superadmin unlock request with feedback and guided release'),
      n('Presenza: utenti online globali, IP visibile al superadmin', 'Presence: global online users, IP visible to superadmin'),
      n('UI: lucchetto cliccabile in sidebar con richiesta unlock', 'UI: clickable lock in sidebar with unlock request'),
      n('Revisioni: flag immutabile gestito dal superadmin con conferma eliminazione', 'Revisions: immutable flag handled by superadmin with delete confirmation')
    ]
  },
  {
    version: '2.3.0',
    date: '2026-02-06',
    type: 'minor',
    notes: [
      n('Lock planimetrie: TTL 60s con rinnovo automatico', 'Floor plan locks: 60s TTL with auto-renew'),
      n('Lock: idle timeout 5 minuti con scadenza automatica', 'Locks: 5-minute idle timeout with automatic expiry'),
      n('UI: badge stato lock e pulsante per acquisire il lock', 'UI: lock status badge and acquire lock button'),
      n('Realtime: rinnovo lock via WebSocket e cleanup scadenze lato server', 'Realtime: lock renew via WebSocket and server-side expiry cleanup'),
      n('Presenza: dettagli utenti online con data di connessione, IP e lock attivo', 'Presence: online user details with connection time, IP, and active lock'),
      n('Lock: richiesta unlock dal superadmin con esito e rilascio guidato', 'Lock: superadmin unlock request with feedback and guided release'),
      n('UI: lucchetto sulle planimetrie bloccate', 'UI: lock icon on locked floor plans')
    ]
  },
  {
    version: '2.2.6',
    date: '2026-02-06',
    type: 'fix',
    notes: [
      n('Foto: scala corretta con +/- sulla selezione', 'Photos: scale now updates correctly with +/- on selection'),
      n('Palette annotazioni: spaziatura icone migliorata', 'Annotations palette: improved icon spacing')
    ]
  },
  {
    version: '2.2.5',
    date: '2026-02-05',
    type: 'fix',
    notes: [
      n('Foto: mirino disponibile solo nella vista singola e in fullscreen', 'Photos: locate button shown only in single view and fullscreen'),
      n('Foto: galleria accessibile dal menu planimetria e dal tasto destro sulla mappa', 'Photos: gallery available from floor plan menu and map context menu'),
      n('Foto: tab dedicata nella modale stanza con galleria delle foto della room', 'Photos: dedicated tab in the room modal with the room gallery'),
      n('Collegamenti: disabilitati per le foto (menu e scorciatoie)', 'Links: disabled for photos (menu and shortcuts)')
    ]
  },
  {
    version: '2.2.1',
    date: '2026-02-05',
    type: 'fix',
    notes: [
      n(
        'Foto: doppio click apre la galleria e “Vedi foto” mostra tutte le foto selezionate',
        'Photos: double click opens the gallery and “View photo” shows all selected photos'
      ),
      n(
        'Modifica rapida: pulsante anteprima per immagini e foto',
        'Quick edit: preview button for images and photos'
      ),
      n('Menu contestuale: rimosso “Collega oggetti”', 'Context menu: removed “Link objects”')
    ]
  },
  {
    version: '2.2.0',
    date: '2026-02-05',
    type: 'minor',
    notes: [
      n('Nuovo oggetto Foto con upload, nome e descrizione', 'New Photo object with upload, name, and description'),
      n(
        'Foto: click sull’icona apre la modale; selezione multipla = galleria con download e fullscreen',
        'Photos: click icon opens the modal; multi-selection shows a gallery with download and fullscreen'
      ),
      n('Palette oggetti: Foto aggiunta accanto a testo/immagine/post-it', 'Object palette: Photo added next to text/image/post-it'),
      n('Clipboard: copia/incolla mantiene immagini e foto', 'Clipboard: copy/paste preserves images and photos')
    ]
  },
  {
    version: '2.1.7',
    date: '2026-02-05',
    type: 'minor',
    notes: [
      n('Rubrica utenti importati: disponibile dal menu cliente e con Cmd/Ctrl+R', 'Imported users directory: available from client menu and with Cmd/Ctrl+R'),
      n('Rubrica: focus ricerca, navigazione con frecce e tasto M per aprire l’email', 'Directory: search focus, arrow navigation, and M to open email'),
      n('Rubrica: visibile solo se l’importazione è già stata eseguita', 'Directory: shown only after an import has been executed'),
      n('IP Map: focus ricerca, navigazione con frecce e tasto U per aprire l’URL', 'IP Map: search focus, arrow navigation, and U to open URL'),
      n('IP Map: raggruppamento per rete /24 con sezioni comprimibili', 'IP Map: /24 network grouping with collapsible sections')
    ]
  },
  {
    version: '2.1.6',
    date: '2026-02-04',
    type: 'fix',
    notes: [
      n('Catalogo oggetti: tab Tutti predefinita, ricerca con frecce/Invio e focus automatico', 'Object catalog: default All tab, search with arrows/Enter and auto focus'),
      n('Scorciatoia A: apre il catalogo oggetti dalla planimetria', 'Shortcut A: opens the object catalog from the plan'),
      n('Rack: nome unico per planimetria con validazione e sync tra impostazioni e planimetria', 'Racks: unique name per floor plan with validation and sync between settings and plan'),
      n('Rack: copia/incolla aggiunge suffisso (Copia/Copy)', 'Racks: copy/paste adds (Copy) suffix'),
      n('Scorciatoia N: rinomina l’oggetto selezionato con modale rapida', 'Shortcut N: rename selected object with a quick modal')
    ]
  },
  {
    version: '2.1.5',
    date: '2026-02-04',
    type: 'fix',
    notes: [
      n('Testo: selezione resta visibile durante lo spostamento', 'Text: selection remains visible while dragging'),
      n('Seleziona tutti: niente box esterno e click vuoto annulla la selezione', 'Select all: no outer box and empty click clears selection')
    ]
  },
  {
    version: '2.1.4',
    date: '2026-02-04',
    type: 'fix',
    notes: [
      n('Wi-Fi: modale antenna ottimizzata su due colonne per ridurre lo scroll', 'Wi-Fi: antenna modal optimized in two columns to reduce scrolling'),
      n('Menu contestuale: selezione di tutti gli oggetti dello stesso tipo', 'Context menu: select all objects of the same type'),
      n('Selezione utenti reali: niente collegamenti automatici', 'Real users selection: no auto-included links'),
      n('Quote: distanza etichetta uniforme sopra/sotto e sinistra/destra', 'Quotes: uniform label distance above/below and left/right')
    ]
  },
  {
    version: '2.1.3',
    date: '2026-02-03',
    type: 'fix',
    notes: [
      n('Allinea: solo orizzontale/verticale con riferimento all’oggetto selezionato', 'Align: horizontal/vertical only using the selected object as reference'),
      n('Incolla: avviso quando si copiano oggetti tra planimetrie', 'Paste: warning when copying objects across floor plans'),
      n('Utenti reali: blocco copia su altri clienti e avviso se già presenti in una planimetria', 'Real users: block copy to other clients and warn if already present in a floor plan')
    ]
  },
  {
    version: '2.1.2',
    date: '2026-02-03',
    type: 'fix',
    notes: [
      n('Layer: counter 0/x quando si nascondono tutti i livelli', 'Layers: counter shows 0/x when all layers are hidden'),
      n('Allinea: opzioni da menu contestuale per multi-selezione (sinistra/centro/destra/alto/medio/basso)', 'Align: context menu options for multi-selection (left/center/right/top/middle/bottom)'),
      n('Selezione: azioni “rimuovi” e “trova” nella modale multi-selezione', 'Selection: “remove” and “find” actions in multi-selection modal'),
      n('Toast selezione: persistenti con contenuti per 1, 2 o più oggetti', 'Selection toasts: persistent with content for 1, 2, or more objects')
    ]
  },
  {
    version: '2.1.1',
    date: '2026-02-03',
    type: 'fix',
    notes: [
      n('Toast scorciatoie: testo nero leggibile e comandi in grassetto', 'Keybind toasts: readable black text with bold commands'),
      n('Scorciatoia E: modifica collegamenti e stanze con toast dedicati', 'E shortcut: edit links and rooms with dedicated toasts'),
      n('Muri: doppio click su poligono apre modale completa + matita nei controlli rapidi', 'Walls: double click on polygon opens full modal + pencil in quick controls'),
      n('Ricerca: prompt per abilitare i layer nascosti prima di mostrare un oggetto', 'Search: prompt to enable hidden layers before showing an object'),
      n('Layers: menu rapido con tasto destro per mostrare/nascondere tutto', 'Layers: right-click quick menu to show/hide all')
    ]
  },
  {
    version: '2.1.0',
    date: '2026-02-03',
    type: 'minor',
    notes: [
      n('Autenticazione: username normalizzati in minuscolo (login case-insensitive)', 'Auth: usernames normalized to lowercase (case-insensitive login)'),
      n('Rack: collegamenti aggregati, una linea per rame e una per fibra', 'Rack: links aggregated, one line for copper and one for fiber'),
      n('Selezione: tratteggio sui box testo e bordi più sottili', 'Selection: dashed outline for text boxes and thinner borders'),
      n('Testo: sfondo predefinito trasparente', 'Text: default background is transparent'),
      n('Wi-Fi: catalogo con focus forzato sulla ricerca', 'Wi-Fi: catalog forces focus on the search field')
    ]
  },
  {
    version: '2.0.7',
    date: '2026-02-03',
    type: 'minor',
    notes: [
      n('Testo: resize del box senza scalare il font', 'Text: resize the box without scaling the font'),
      n('Selezione elastica: include testo, immagini e post-it', 'Box selection now includes text, images, and post-its'),
      n('Sidebar: compatta/scompatta clienti e sedi con memoria + compatta/scompatta tutto', 'Sidebar: collapse/expand clients and sites with memory + collapse/expand all'),
      n('Wi-Fi: copertura con raggio/diametro e catalogo con selezione riga, tasti e pulsante', 'Wi-Fi: coverage shows radius/diameter and catalog supports row selection, keys, and button'),
      n('Muri: tasto destro per chiudere il disegno', 'Walls: right click to finish drawing')
    ]
  },
  {
    version: '2.0.3',
    date: '2026-01-31',
    type: 'fix',
    notes: [
      n(
        'Quote: rework completo del resize con apici e rilascio stabile delle posizioni',
        'Quotes: full resize rework with endpoints and stable release positions'
      ),
      n(
        'Quote: distanza etichetta configurabile da modale con default più distante quando è sotto',
        'Quotes: configurable label distance in modal with a slightly larger default when below'
      )
    ]
  },
  {
    version: '2.0.2',
    date: '2026-01-31',
    type: 'fix',
    notes: [
      n(
        'Quote: apici ora rilasciano esattamente nel punto trascinato',
        'Quotes: endpoints now release exactly where dragged'
      ),
      n(
        'Quote: distanza etichetta uniforme sopra/sotto e background automatico quando centrata',
        'Quotes: uniform label distance above/below and automatic background when centered'
      ),
      n(
        'Quote: aggiunto colore testo per l’etichetta',
        'Quotes: added label text color'
      )
    ]
  },
  {
    version: '2.0.1',
    date: '2026-01-31',
    type: 'fix',
    notes: [
      n(
        'Quote: scala linea + scala etichetta separate, background etichetta opzionale e anteprima più grande',
        'Quotes: separate line/label scale, optional label background, and larger preview'
      ),
      n(
        'Quote: trascinamento con mouse, spostamento con frecce, e apici trascinabili per allungare/accorciare',
        'Quotes: mouse drag, arrow-key move, and draggable endpoints to extend/shrink'
      )
    ]
  },
  {
    version: '2.0.0',
    date: '2026-01-31',
    type: 'major',
    notes: [
      n(
        'Quote: modale completa con scala freccia/etichetta, posizione testo, colore, tratteggio ed apici (puntini/frecce)',
        'Quotes: full modal with arrow/label scale, text position, color, dashed line, and endpoints (dots/arrows)'
      ),
      n(
        'Quote: anteprima grafica, dimensione mostrata e scorciatoie persistenti in toast',
        'Quotes: graphic preview, size display, and persistent shortcut toast'
      ),
      n(
        'Quote: selezione evidenziata, doppio click per modifica e posizione testo personalizzabile per orientamento',
        'Quotes: highlighted selection, double click to edit, and per-orientation text placement'
      ),
      n(
        'Quote: sempre nel layer dedicato, livelli rimossi dalla modale',
        'Quotes: always in the dedicated layer, layers removed from the modal'
      )
    ]
  },
  {
    version: '1.9.9',
    date: '2026-01-31',
    type: 'fix',
    notes: [
      n(
        'Quote: posizione etichetta configurabile (sopra/sotto/centro o sinistra/destra/centro) con preset per nuove quote',
        'Quotes: configurable label position (above/below/center or left/right/center) with presets for new quotes'
      ),
      n(
        'Quote: colore dedicato e selezione con evidenza + scorciatoie da tastiera per spostare la scritta',
        'Quotes: dedicated color, selection highlight, and keyboard shortcuts to move the label'
      ),
      n(
        'Quote: doppio click per aprire la modale di modifica',
        'Quotes: double click to open the edit modal'
      ),
      n(
        'Scala planimetria: controlli separati per spessore linea e scala etichetta',
        'Floor plan scale: separate controls for line thickness and label scale'
      )
    ]
  },
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
];

export const partMid: ReleaseNote[] = [...partMidHead, ...partMidExtra];
