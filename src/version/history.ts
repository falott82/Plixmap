export interface ReleaseNote {
  version: string;
  date: string;
  type: 'fix' | 'minor' | 'major';
  notes: { it: string; en: string }[];
}

const n = (it: string, en: string): { it: string; en: string } => ({ it, en });

export const releaseHistory: ReleaseNote[] = [
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
