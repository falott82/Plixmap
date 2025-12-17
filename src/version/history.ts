export interface ReleaseNote {
  version: string;
  date: string;
  type: 'fix' | 'minor' | 'major';
  notes: string[];
}

export const releaseHistory: ReleaseNote[] = [
  {
    version: '0.9.4',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Login: in sviluppo (NODE_ENV != production) il server ruota la chiave di sessione ad ogni avvio, quindi un restart forza sempre la schermata di login',
      'CI: workflow `security-audit` ora fallisce solo per vulnerabilità con severità >= high (riduce falsi allarmi su low/moderate)'
    ]
  },
  {
    version: '0.9.3',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Cambio planimetria con modifiche non salvate: “Cambia senza salvare” ripristina davvero lo stato precedente (ultima revisione o snapshot iniziale)',
      'Albero sidebar: menu tasto destro sulla planimetria con “Time machine…” (rispetta il flusso di salvataggio se ci sono modifiche)',
      'Time machine: pulsante “Confronta” per selezionare 2 revisioni e visualizzarle (A più nuova sopra, B più vecchia sotto) con breadcrumb e date',
      'Fix: risolto crash nel confronto revisioni quando la selezione cambia/si chiude la modale'
    ]
  },
  {
    version: '0.9.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Performance: Canvas separato in layer (sfondo/stanze/oggetti) per evitare redraw dell’immagine durante drag e ridurre drasticamente `drawImage`',
      'Performance: ResizeObserver throttled con `requestAnimationFrame` per prevenire `setHeight/resizeDOM` ripetuti',
      'Performance: PlanView non sottoscrive più l’intero Zustand store (selector granulari) per evitare render storm e lag in input/modali'
    ]
  },
  {
    version: '0.9.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Performance: ridotti re-render inutili (App/Sidebar/Help) usando selector Zustand granulari',
      'Autosave: per admin evita di rimpiazzare l’intero grafo state a ogni save (riduce GC e possibile churn Konva); aggiorna dal server solo quando serve (data URL → /uploads)',
      'Canvas: ResizeObserver non aggiorna lo state se le dimensioni non cambiano (evita loop di resize)'
    ]
  },
  {
    version: '0.9.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Palette: nomi oggetti tradotti ITA/ENG e guidati dal catalogo tipi oggetto',
      'Settings: nuova sezione “Oggetti” per creare tipi personalizzati (IT/EN) e scegliere icone da una lista coerente',
      'Icone: puoi cambiare l’icona anche dei tipi esistenti; tutti gli oggetti in mappa si aggiornano automaticamente',
      'PDF: lista oggetti esportata con il nome tipo (non solo id) dove disponibile'
    ]
  },
  {
    version: '0.8.5',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Performance: ridotto drasticamente il lavoro sul main thread durante typing/drag evitando re-render del canvas per eventi non correlati',
      'PlanView: subscription Zustand granulari (shallow selector) e rimossa dipendenza da toast updates per prevenire render storm',
      'Data store: aggiornamenti con structural sharing (no deep-clone totale) per evitare GC churn e riferimenti che cambiavano inutilmente',
      'Canvas: `CanvasStage` memoized + callback stabilizzate per non rigenerare migliaia di nodi Konva durante input/modali'
    ]
  },
  {
    version: '0.8.4',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Performance: eliminato JSON.stringify massivo dello state (soprattutto con immagini/asset in data URL) per evitare GC churn e rallentamenti progressivi',
      'Autosave: salvataggi serializzati (no richieste concorrenti) con debounce più robusto e aggiornamento state canonico dal server',
      'Backend: planimetrie/loghi/allegati in data URL vengono salvati come file in `data/uploads` e referenziati via URL, riducendo drasticamente la dimensione dello state',
      'Time machine: entrando nell’area di lavoro si parte sempre dal “presente” (non da una revisione selezionata in precedenza)',
      'Canvas: cleanup onload icone SVG→Image per evitare setState dopo unmount'
    ]
  },
  {
    version: '0.8.3',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Utenti: aggiunta ricerca e colonna Attivo/Disattivo nella lista',
      'Logs: ricerca immediata lato UI (oltre alla ricerca server con Invio/Refresh)',
      'Login: rimossi esempi credenziali dalla pagina',
      'Footer: spostato in basso a destra e aggiunto link mailto: ottavio.falsini@me.com',
      'Changelog: tooltip sul badge versione',
      'Header: Aiuto spostato a destra di Impostazioni, Salva revisione evidenziato e abilitato solo con modifiche',
      'Viste: nome bloccato a “Default” quando la vista è default'
    ]
  },
  {
    version: '0.8.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'UI: Settings come sola icona top-right (accanto al menu utente), rimosso box account in sidebar',
      'Selezione: riclick su oggetto selezionato → deselect',
      'Settings: tab “Clienti” evidenziata; CRUD Clienti/Sedi via modali con pulsante “+”',
      'Clienti: campi completi (nome breve usato nell’area di lavoro + ragione sociale estesa, indirizzo, contatti), logo auto-ridimensionato, allegati PDF',
      'Lingua: profilo utente ITA/ENG con switch nel menu utente e persistenza su DB',
      'Logs: ora registra solo login/logout (anche tentativi falliti) con legenda; rimossi eventi interni post-login',
      'Security: aggiunti Dependabot e GitHub Action per `npm audit --omit=dev`'
    ]
  },
  {
    version: '0.8.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Account menu: menu utente in alto a destra con “Gestione profilo” e “Logout”',
      'Ruoli: introdotto superadmin (solo superadmin può creare admin e vedere audit log)',
      'Utenti: supporto disattivazione account, blocco modifica/reset/elimina superadmin per admin',
      'Audit log: tracciamento login/logout/me e accessi state (IP + request meta), pannello Logs in Settings (solo superadmin)',
      'Settings: rimossa sezione Info e header semplificato'
    ]
  },
  {
    version: '0.8.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Login: accesso obbligatorio con sessione (cookie) e utenti bootstrap admin/admin2',
      'Utenti: gestione completa in Settings (anagrafica + reset/cambio password) con password hashate (scrypt)',
      'Permessi: assegnazione RO/RW per Cliente/Sede/Planimetria con enforcement lato server e UI in sola lettura',
      'Clienti: upload logo e visualizzazione in sidebar',
      'Changelog: export in PDF dal badge versione',
      'Stanze: disegno rettangolo + collegamento automatico oggetti, edit e delete con ricalcolo'
    ]
  },
  {
    version: '0.7.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Selezione multipla: Ctrl/⌘ click per selezionare più oggetti, Canc elimina in batch con conferma',
      'Lista oggetti: ricerca + icone, click su un elemento → blink/highlight in mappa',
      'Revisioni: formato Rev X.Y con scelta Major/Minor al salvataggio, pulsante “Elimina tutte”, e diff aggiunti/rimossi'
    ]
  },
  {
    version: '0.6.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Ricerca: highlight/blink dell’oggetto senza spostare la mappa',
      'Revisioni: salvataggio guidato (vX + nota), no-op se nessuna modifica, eliminazione revisioni dalla time machine',
      'Aggiorna planimetria: modal con scelta “riporta oggetti” o “rimuovi oggetti” + archivia automatica della precedente',
      'Footer: “Sviluppato da Ottavio Falsini” con link GitHub'
    ]
  },
  {
    version: '0.5.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'PDF: export configurabile (orientamento auto/orizzontale/verticale + lista oggetti opzionale)',
      'Revisioni: “Salva revisione” crea uno storico immutabile (sola lettura) della planimetria e degli oggetti',
      'Time machine: icona dedicata per navigare le revisioni e tornare al presente',
      'Settings: aggiunta planimetria via popup (nome + immagine) con blocco duplicati; update immagine archivia la precedente'
    ]
  },
  {
    version: '0.4.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Menu contestuale mappa: Salva vista, Vai a default, Aggiungi (palette), Esporta PDF, Elimina tutti gli oggetti',
      'Viste: azioni a icone (stella/cestino), conferma delete e flusso guidato per riassegnare la default',
      'Oggetti: duplica da menu con popup nome/descrizione e posizionamento accanto all’originale',
      'Canvas: clamp pan rework per planimetrie piccole + centratura ricerca più affidabile',
      'UI marker: stile coerente con la palette (tile arrotondato + icona)'
    ]
  },
  {
    version: '0.3.3',
    date: '2025-12-16',
    type: 'fix',
    notes: ['Layout: barra selezione oggetto resa stabile nella stessa riga del titolo per evitare shift della mappa']
  },
  {
    version: '0.3.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Toast: durata dimezzata',
      'Marker: label più vicina e più compatta',
      'Performance: ottimizzata gestione keydown e conteggi oggetti (memoizzazione) per evitare rallentamenti progressivi'
    ]
  },
  {
    version: '0.3.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Oggetti: scala “sticky” (nuovi oggetti ereditano l’ultima scala impostata)',
      'UI: marker e label ridotti (~25%) e label più compatta in palette'
    ]
  },
  {
    version: '0.3.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'UX: delete da tastiera (Del/Backspace) con conferma, Enter per confermare ed Esc per annullare',
      'UI: conteggio oggetti accanto al nome planimetria con breakdown per tipo e lista nomi',
      'Zoom: più fluido e fit non-upscale per evitare marker troppo grandi su planimetrie piccole'
    ]
  },
  {
    version: '0.2.7',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Upload planimetria: lettura automatica dimensioni (width×height) e salvataggio nel modello FloorPlan',
      'Maggiore precisione coordinate e base di scaling per mappe di dimensioni note'
    ]
  },
  {
    version: '0.2.6',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Ricerca: centratura usa lo zoom corrente del canvas per evitare mismatch durante wheel-zoom',
      'Drag oggetti: coordinate world corrette anche con stage scalata (fix mismatch e centratura)',
      'Stabilità: clamp pan con guardie su dimensioni/NaN'
    ]
  },
  {
    version: '0.2.5',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Ricerca: se ci sono più match, selezione del risultato prima della centratura',
      'Stabilità centratura: guardie extra su coordinate non valide per evitare “mappa sparita”'
    ]
  },
  {
    version: '0.2.4',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Ricerca: coordinate corrette per inserimento/centratura (bug conversione pointer→world)',
      'Stabilità: clamp del pan per prevenire “mappa sparita” e drift dopo focus/zoom',
      'Panning/zoom più robusti con limiti elastici'
    ]
  },
  {
    version: '0.2.3',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Ricerca: rework centratura per evitare ri-applicazioni e panning “infinito”',
      'Focus calcolato una sola volta per richiesta, con retry solo quando le dimensioni canvas sono pronte'
    ]
  },
  {
    version: '0.2.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Ricerca: centratura spostata nel canvas per evitare misure DOM errate e pan/zoom NaN',
      'Stabilità: evita salvataggi di viewport non validi e previene “mappa che sparisce”'
    ]
  },
  {
    version: '0.2.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Ricerca: centratura affidabile sull’oggetto trovato con highlight pulsante',
      'Stabilità viewport: annulla commit wheel pendenti quando la view viene aggiornata da ricerca/azioni'
    ]
  },
  {
    version: '0.2.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Viste salvate per planimetria: salva zoom/pan con nome/descrizione e imposta una vista di default',
      'Menu a tendina “Viste” per richiamare, eliminare o cambiare la default (una sola default per planimetria)',
      'Azione “Salva vista” nel menu contestuale (tasto destro) che salva la visualizzazione corrente'
    ]
  },
  {
    version: '0.1.1',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Persistenza viewport (pan/zoom) per planimetria e autofit disattivato se hai già posizionato la mappa',
      'Palette sticky a destra in alto, canvas con bordo inferiore tipo tela, topbar ottimizzata',
      'Icona Settings a ingranaggio, popup delete mostra il nome dell’oggetto'
    ]
  },
  {
    version: '0.1.0',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Palette verticale e topbar con icone per Aiuto/Export + badge versione ricercabile',
      'Pan della mappa trascinando lo sfondo, fit migliorato e controlli zoom compatti',
      'Ricerca con Enter che centra e highlighta; footer info brand; logo aggiornato'
    ]
  },
  {
    version: '0.0.2',
    date: '2025-12-16',
    type: 'fix',
    notes: [
      'Fix fit planimetria caricata e immagini locali visibili',
      'Pan/zoom migliorati con fit automatico e drag per riposizionare',
      'Menu contestuale: duplica, scala oggetti, resize label'
    ]
  },
  {
    version: '0.0.1',
    date: '2025-12-16',
    type: 'minor',
    notes: [
      'Versione iniziale: CRUD clienti/sedi/planimetrie, canvas oggetti drag&drop, ricerca, export PDF, help'
    ]
  }
];
