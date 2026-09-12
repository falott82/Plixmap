import type { ReleaseNote } from './types';
import { n } from './types';
import { partEarlyExtra } from './partEarlyExtra';

const partEarlyHead: ReleaseNote[] = [
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
];

export const partEarly: ReleaseNote[] = [...partEarlyHead, ...partEarlyExtra];
