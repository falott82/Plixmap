import type { ReleaseNote } from './types';
import { n } from './types';

export const partRecent: ReleaseNote[] = [
  {
    version: '3.7.0',
    date: '2026-06-01',
    type: 'minor',
    notes: [
      n(
        'Sicurezza/supply chain: azzerate tutte le vulnerabilita di produzione (npm audit = 0) aggiornando ws, nodemailer e gli override dompurify/qs/path-to-regexp',
        'Security/supply chain: cleared all production npm audit findings (0 vulnerabilities) by updating ws, nodemailer and the dompurify/qs/path-to-regexp overrides'
      ),
      n(
        'Hardening XSS: il testo ricco delle note meeting viene ora sanitizzato lato server prima del salvataggio (nuovo server/utils/sanitizeHtml.cjs senza dipendenze)',
        'XSS hardening: meeting-note rich text is now sanitized server-side before persistence (new dependency-free server/utils/sanitizeHtml.cjs)'
      ),
      n(
        'Resilienza: la mappa e ora isolata in un CanvasErrorBoundary dedicato e lo startup del server fallisce subito se le cartelle database/backup/uploads non sono scrivibili',
        'Resilience: the canvas is now isolated in a dedicated CanvasErrorBoundary and the server fails fast at startup if the database/backup/uploads directories are not writable'
      ),
      n(
        'Osservabilita/tooling: sostituiti i catch {} silenziosi nelle route chat con log strutturati; il pre-commit ora esegue type-check e test e sono stati aggiunti test per il sanitizzatore HTML',
        'Observability/tooling: replaced silent catch {} blocks in the chat routes with structured logs; the pre-commit hook now type-checks and runs tests, and unit tests were added for the HTML sanitizer'
      )
    ]
  },
  {
    version: '3.6.5',
    date: '2026-05-07',
    type: 'fix',
    notes: [
      n(
        'Salvataggio planimetrie piu mirato: piano attivo e revisioni usano endpoint/storage dedicati, riducendo churn sull’intero stato senza perdere coerenza su backup/import',
        'More targeted floor-plan persistence: the active plan and its revisions use dedicated endpoints/storage, reducing full-state churn without losing backup/import consistency'
      ),
      n(
        'Autosave con guard di concorrenza: se lo stato server cambia da un’altra sessione, il salvataggio si ferma e mostra un avviso esplicito di ricarica invece di sovrascrivere silenziosamente',
        'Autosave now includes a concurrency guard: if server state changes from another session, saving pauses and shows an explicit reload warning instead of silently overwriting'
      ),
      n(
        'Hardening sicurezza e privacy: directory utenti filtrata per visibilita reale dei non-admin; aggiornati `nodemailer` a ^8.0.7 e `dompurify` a ^3.4.2 con audit runtime nuovamente verde',
        'Security and privacy hardening: non-admin user directory is filtered by actual visibility; `nodemailer` upgraded to ^8.0.7 and `dompurify` forced to ^3.4.2 with the runtime audit green again'
      )
    ]
  },
  {
    version: '3.6.4',
    date: '2026-04-13',
    type: 'fix',
    notes: [
      n(
        'CI/Release: aggiornate le GitHub Actions alla linea v5 e allineato Node 22 nel pipeline di qualita e sicurezza',
        'CI/Release: upgraded GitHub Actions to the v5 line and aligned Node 22 in the quality/security pipeline'
      ),
      n(
        'Release operations: aggiunto il workflow ufficiale per esportare uno snapshot SQLite versionabile in Git (`npm run release:db:export` -> `release-data/plixmap-db-latest.sqlite.gz`)',
        'Release operations: added the official workflow to export a Git-versionable SQLite snapshot (`npm run release:db:export` -> `release-data/plixmap-db-latest.sqlite.gz`)'
      ),
      n(
        'Documentazione/versione riallineate per la 3.6.4 tra package metadata, README, changelog e release history in-app',
        'Documentation/version metadata aligned for 3.6.4 across package metadata, README, changelog, and in-app release history'
      )
    ]
  },
  {
    version: '3.6.3',
    date: '2026-03-18',
    type: 'fix',
    notes: [
      n(
        'Note meeting: la conferma di chiusura con modifiche non salvate include ora anche \"Continua senza salvare\" per evitare loop Salva/Annulla',
        'Meeting notes: unsaved-close confirmation now includes \"Continue without saving\" to avoid Save/Cancel loops'
      ),
      n(
        'Note cliente: aggiunte azioni OpenAI su testo selezionato (traduci/correggi) con scorciatoie Cmd/Ctrl+Shift+T e Cmd/Ctrl+Shift+C, allineate anche alle note meeting',
        'Client notes: added OpenAI actions on selected text (translate/correct) with Cmd/Ctrl+Shift+T and Cmd/Ctrl+Shift+C shortcuts, aligned with meeting notes'
      ),
      n(
        'MegaUpdate sicurezza: aggiornato jspdf a ^4.2.1 e rieseguiti audit dipendenze + quality gate completo con esito verde',
        'Security MegaUpdate: upgraded jspdf to ^4.2.1 and reran dependency audit + full quality gate with green outcome'
      )
    ]
  },
  {
    version: '3.6.2',
    date: '2026-03-17',
    type: 'fix',
    notes: [
      n(
        'Hardening sicurezza sulla supply chain di build: forzato `@rollup/plugin-terser@1.0.0` con `serialize-javascript@7.0.4`, eliminando le vulnerabilita high rilevate da npm audit nella catena PWA/workbox',
        'Build supply-chain security hardening: forced `@rollup/plugin-terser@1.0.0` with `serialize-javascript@7.0.4`, removing high-severity npm audit findings in the PWA/workbox chain'
      ),
      n(
        'Sito ufficiale rinforzato con Content-Security-Policy server-side (`.htaccess`) e allowlist minimale: script locali + hash SHA-256 dei blocchi JSON-LD inline, frame/object bloccati e upgrade-insecure-requests attivo',
        'Official website hardened with server-side Content-Security-Policy (`.htaccess`) and a minimal allowlist: local scripts + SHA-256 hashes for inline JSON-LD blocks, frame/object blocked, and upgrade-insecure-requests enabled'
      ),
      n(
        'MegaUpdate di validazione rieseguito dopo il fix: audit, lint, test e build confermano il rilascio stabile 3.6.2',
        'Validation MegaUpdate rerun after the fix: audit, lint, tests, and build confirm a stable 3.6.2 release'
      )
    ]
  },
  {
    version: '3.6.1',
    date: '2026-03-12',
    type: 'fix',
    notes: [
      n(
        'PlanView ottimizzato sui lookup ad alto traffico: introdotte mappe memoizzate per oggetti, stanze e corridoi (`id -> entity`) per ridurre i costi O(n) ripetuti nei render e nelle action UI',
        'PlanView optimized on high-traffic lookups: memoized maps for objects, rooms, and corridors (`id -> entity`) reduce repeated O(n) costs in renders and UI actions'
      ),
      n(
        'Refactor mirato con comportamento invariato: rimosse lookup lineari ridondanti su selezione, context menu, modali stanza/corridoio e azioni bulk, mantenendo piena compatibilita funzionale',
        'Targeted refactor with unchanged behavior: removed redundant linear lookups across selection, context menu, room/corridor modals, and bulk actions while preserving full functional compatibility'
      ),
      n(
        'MegaUpdate rieseguito con evidenze: lint/test/build/release-check tutti verdi, audit dipendenze runtime senza vulnerabilita high, e controlli sicurezza/deploy riallineati con il sito ufficiale',
        'MegaUpdate rerun with evidence: lint/test/build/release-check all green, runtime dependency audit with no high vulnerabilities, and security/deploy checks aligned with the official website'
      )
    ]
  },
  {
    version: '3.6.0',
    date: '2026-03-12',
    type: 'minor',
    notes: [
      n(
        'Rimosso completamente il rimasuglio della webcam per la navigazione in presentazione: eliminati hook dedicato, stato store, controlli toolbar e flow di permessi non piu necessari',
        'Completely removed residual presentation-webcam navigation code: deleted dedicated hook, store state, toolbar controls, and now-unneeded permission flow'
      ),
      n(
        'PlanView e CanvasStage semplificati dopo cleanup: meno rami condizionali, meno codice morto e comportamento di presentazione piu lineare',
        'PlanView and CanvasStage were simplified after cleanup: fewer conditional branches, less dead code, and a more linear presentation-mode behavior'
      ),
      n(
        'MegaUpdate: audit tecnico e sicurezza rieseguiti con quality gate completo (sensitive check, lint, test, build, release check) e dipendenze runtime verificate senza vulnerabilita ad alta severita',
        'MegaUpdate: technical and security audit rerun with full quality gate (sensitive check, lint, test, build, release check) and runtime dependencies verified with no high-severity vulnerabilities'
      )
    ]
  },
  {
    version: '3.5.9',
    date: '2026-03-12',
    type: 'fix',
    notes: [
      n(
        'Modale oggetto: sezione livelli resa compatta di default. Ora mostra prima il layer principale e apre la selezione completa con il pulsante + o clic diretto sul layer',
        'Object modal: layers section is compact by default. It now shows the primary layer first and opens the full selector with the + button or by clicking the layer itself'
      ),
      n(
        'Assegnazione layer negli oggetti resa piu robusta: normalizzazione rispetto ai layer realmente disponibili e vincolo di almeno un layer sempre selezionato per evitare stati inconsistenti',
        'Object layer assignment is now more robust: normalization against actually available layers and an at-least-one-layer guard to prevent inconsistent states'
      ),
      n(
        'Modalita presentazione/webcam: introdotti guard idempotenti su store ed effetti per prevenire update ridondanti e loop di rendering che potevano causare React error #185 in build minificate',
        'Presentation/webcam mode: added idempotent guards in store setters and effects to prevent redundant updates and render loops that could cause React error #185 in minified builds'
      )
    ]
  },
  {
    version: '3.5.8',
    date: '2026-03-10',
    type: 'fix',
    notes: [
      n(
        'Nella modale changelog il numero versione e ora evidenziato in rosso sia nell’intestazione sia su ogni card release, per rendere piu immediata la lettura',
        'In the changelog modal, version numbers are now highlighted in red both in the header and on each release card for faster readability'
      ),
      n(
        'Passata finale di rilascio rieseguita dopo il polish UI: quality gate, test, build e check di coerenza versione/documentazione',
        'Final release pass rerun after the UI polish: quality gates, tests, build, and version/documentation consistency checks'
      ),
      n(
        'Metadati release riallineati tra applicativo e sito per mantenere aggiornamento e comunicazione versione coerenti',
        'Release metadata was realigned across app and website to keep version communication and update tracking consistent'
      )
    ]
  },
  {
    version: '3.5.7',
    date: '2026-03-10',
    type: 'fix',
    notes: [
      n(
        'Esperienza import utenti/dispositivi riallineata e resa piu coerente tra WebAPI, LDAP, CSV e manuale: barre azioni, pulsanti e stati sono ora uniformi e meno ridondanti',
        'User/device import UX is now aligned and more consistent across WebAPI, LDAP, CSV and manual flows: action bars, buttons, and states are now uniform and less redundant'
      ),
      n(
        'Selezione multipla nella preview import resa piu robusta: menu contestuale con “Seleziona tutto/Deseleziona tutto”, logica di selezione massiva piu prevedibile e applicazione finale con bottone unico “Apply selected” protetto',
        'Multi-select in import preview is now more robust: context menu with “Select all/Deselect all”, more predictable bulk-selection behavior, and final execution through a single guarded “Apply selected” button'
      ),
      n(
        'Configurazioni LDAP e WebAPI rifinite con layout piu chiaro, ordine azioni consistente e feedback espliciti in test/compare/import per ridurre errori operativi',
        'LDAP and WebAPI configurations were refined with clearer layout, consistent action ordering, and explicit test/compare/import feedback to reduce operational errors'
      ),
      n(
        'Aggiunta gestione retention log in settings con default deterministico a 30 giorni, controllo tipologie log e pulizia automatica configurabile',
        'Log retention management was added in settings with a deterministic 30-day default, per-log-type controls, and configurable automatic cleanup'
      ),
      n(
        'Copertura test e quality gate rieseguiti su import/retention per ridurre regressioni e garantire rilascio stabile',
        'Tests and quality gates were rerun on import/retention paths to reduce regressions and ensure a stable release'
      )
    ]
  },
  {
    version: '3.5.6',
    date: '2026-03-09',
    type: 'fix',
    notes: [
      n(
        'Import WebAPI reso piu affidabile per utenti e dispositivi: test e anteprima usano ora la configurazione live visibile nella modale, non solo l’ultima copia salvata sul backend',
        'WebAPI import is more reliable for both users and devices: test and preview now use the live configuration visible in the modal, not only the last copy saved on the backend'
      ),
      n(
        'Transport import rafforzato per reti locali problematiche: connessione diretta all’IP risolto, nessun agent condiviso, retry in child process Node e fallback finale a `curl` per ambienti dove il processo server lungo riceve `EHOSTUNREACH`',
        'The import transport is stronger on problematic local networks: direct connection to the resolved IP, no shared agent, retry in a fresh child Node process, and final `curl` fallback for environments where the long-lived server process hits `EHOSTUNREACH`'
      ),
      n(
        'La sicurezza resta invariata: password sempre cifrate a riposo, niente credenziali in URL e passaggio dei secret via `stdin` nei fallback subprocess invece che negli argomenti shell',
        'Security boundaries stay intact: passwords remain encrypted at rest, credentials are never placed in URLs, and fallback subprocesses receive secrets through `stdin` instead of shell arguments'
      ),
      n(
        'Nuovi test coprono merge tra config live e config salvata, uso dell’indirizzo risolto nella validazione URL e comportamento del transport WebAPI condiviso',
        'New tests cover live-config plus saved-config merging, use of the resolved address from URL validation, and the shared WebAPI transport behavior'
      ),
      n(
        'Rifinitura finale su UX/documentazione import con hint browser piu corretti sui campi password e release notes riallineate tra app, changelog e sito',
        'Final import UX/documentation polish with better browser hints on password fields and synchronized release notes across the app, changelog, and website'
      )
    ]
  },
  {
    version: '3.5.5',
    date: '2026-03-09',
    type: 'fix',
    notes: [
      n(
        'Import LDAP utenti introdotto in sola lettura con server/autenticazione/Base DN/filtro/mapping configurabili, test connessione, confronto dedicato e import selettivo per email per evitare sovrapposizioni con il contenitore locale',
        'Read-only LDAP user import added with configurable server/authentication/base DN/filter/mapping, connection testing, dedicated comparison, and selective import by email to avoid overlaps with the local container'
      ),
      n(
        'UX LDAP piu controllata: confronto in modale separata, seconda modale per scegliere quali utenti importare, completamento manuale dei campi mancanti prima dell’import e supporto a scope OU corrente o subtree',
        'LDAP UX is more controlled: dedicated comparison modal, second modal to choose which users to import, manual completion of missing fields before import, and support for current-OU or subtree scope'
      ),
      n(
        'Contenitore utenti piu flessibile: ora anche gli utenti importati possono essere modificati localmente, con testi/tooltip espliciti sul fatto che un reimport futuro puo sovrascrivere i dati locali',
        'The user container is more flexible: imported users can now be edited locally as well, with explicit copy/tooltips clarifying that future reimports may overwrite local values'
      ),
      n(
        'Bug critico corretto nella persistenza config LDAP: il salvataggio non riallineava correttamente i campi SQL e poteva corrompere `Base DN` o stato password; aggiunti test dedicati su config store e override pre-import',
        'Critical LDAP config persistence bug fixed: saved SQL field ordering was misaligned and could corrupt `Base DN` or password state; dedicated tests now cover config-store ordering and pre-import overrides'
      ),
      n(
        'Release rifinita con passata su sicurezza, traduzioni e copertura tooltip/help nella sezione import, inclusa una guida LDAP completa in modale con gestione focus corretta',
        'Release refined with an additional pass on security, translations, and tooltip/help coverage in the import section, including a full LDAP guide modal with proper focus handling'
      )
    ]
  },
  {
    version: '3.5.4',
    date: '2026-03-08',
    type: 'fix',
    notes: [
      n(
        'Configurazione runtime server centralizzata in `server/config.cjs`: parsing/default/env normalization in SSOT con validazione piu severa dei flag sensibili e supporto preservato a `PORT=0`',
        'Server runtime configuration is now centralized in `server/config.cjs`: parsing/default/env normalization in one SSOT, with stricter validation for sensitive flags and preserved `PORT=0` support'
      ),
      n(
        'Backend ulteriormente spezzato: auth/MFA, admin settings, meeting public/notes/lifecycle e moduli custom import dedicati riducono il carico del server monolitico',
        'Backend was split further: auth/MFA, admin settings, meeting public/notes/lifecycle, and dedicated custom-import modules reduce the load on the monolithic server'
      ),
      n(
        'Meetings e import piu robusti: update meeting fail-fast su email partecipanti mancanti quando le notifiche sono attive, audit globale coerente su cancel/update e protezioni SSRF/import piu strette',
        'Meetings and import flows are more robust: meeting updates now fail fast on missing participant emails when notifications are enabled, cancel/update actions emit consistent global audit entries, and SSRF/import protections are tighter'
      ),
      n(
        'PlanView/meeting UI piu modulare: estratti modal kiosk, misure stanza, export layout e duplicate/follow-up; la pianificazione usa ora il giorno locale e non interpreta piu input orari custom invalidi come mezzanotte',
        'PlanView/meeting UI is more modular: kiosk, room measures, layout export, and duplicate/follow-up modals were extracted; scheduling now uses the local day and no longer interprets invalid custom time input as midnight'
      ),
      n(
        'Nuovi test mirati coprono config server, route auth/settings/meeting lifecycle, local date handling, parsing orari custom, import custom, chat services e guardie salvataggio stato',
        'New focused tests cover server config, auth/settings/meeting-lifecycle routes, local date handling, custom time parsing, custom import, chat services, and state-save guards'
      )
    ]
  },
  {
    version: '3.5.3',
    date: '2026-03-07',
    type: 'fix',
    notes: [
      n(
        'Provisioning utenti importati reso piu affidabile: `Portal public URL` centralizzato, creazione utente atomica, vincolo univoco sul link imported-user e messaggi espliciti quando l’URL pubblico non e configurato',
        'Imported-user provisioning is now more reliable: centralized `Portal public URL`, atomic user creation, unique constraint on imported-user linkage, and explicit messaging when the public URL is not configured'
      ),
      n(
        'Meetings: corretta la visibilita di `/api/meetings/mine` applicando i filtri data prima del `LIMIT`, evitando omissioni silenziose per admin e superadmin su dataset ampi',
        'Meetings: `/api/meetings/mine` visibility was fixed by applying date filters before `LIMIT`, avoiding silent omissions for admin and superadmin users on larger datasets'
      ),
      n(
        'SSOT/DRY meetings: badge e fasi temporali condivise tra mobile, `My meetings`, follow-up timeline, Sidebar e PlanView tramite helper unificati',
        'Meeting SSOT/DRY: shared temporal-state helpers now drive badges and phases across mobile, `My meetings`, follow-up timelines, Sidebar, and PlanView'
      ),
      n(
        'Runtime URL pubblici centralizzati lato server: kiosk, mobile e public uploads usano ora un resolver comune piu prevedibile anche in scenari LAN/localhost',
        'Public runtime URLs are now centralized server-side: kiosk, mobile, and public uploads all use a common resolver that behaves more predictably in LAN/localhost setups'
      ),
      n(
        'Aggiunti test mirati per regole condivise su provisioning/email e public URL runtime per ridurre regressioni nelle release future',
        'Added focused tests for shared provisioning/email rules and runtime public URLs to reduce regressions in future releases'
      )
    ]
  },
  {
    version: '3.5.2',
    date: '2026-03-07',
    type: 'fix',
    notes: [
      n(
        'Orari sede: editor dedicato con schedule settimanale multi-range, modale separata per festivi/chiusure, nome festività e calendari selezionabili (Italia, USA, UK, Germania, Francia, Spagna, Cina, Arabia Saudita, Emirati o manuale)',
        'Site hours: dedicated editor with weekly multi-range schedule, separate holidays/closures modal, holiday names, and selectable calendars (Italy, US, UK, Germany, France, Spain, China, Saudi Arabia, UAE, or manual)'
      ),
      n(
        'Meeting room: l’orario massimo suggerito ora deriva dagli orari della sede della sala meeting, con possibilità esplicita di andare oltre quando serve',
        'Meeting rooms: the suggested maximum end time now derives from the site hours of the meeting room, with an explicit option to go beyond when needed'
      ),
      n(
        'Mobile chat: apertura molto più veloce grazie a overview dedicata/caching e rimosso il loop di richieste unread/read che saturava la console e il backend',
        'Mobile chat: much faster opening thanks to dedicated overview/caching and removal of the unread/read request loop that was flooding console and backend'
      ),
      n(
        'Permessi superadmin riallineati: visibilità completa su Users e Meetings anche nei flussi `My meetings` e nelle route backend estratte',
        'Superadmin permissions realigned: full visibility over Users and Meetings, including `My meetings` flows and extracted backend routes'
      ),
      n(
        'Routing stanze/corridoi più robusto: le porte inferite geometricamente coprono anche stanze senza link esplicito salvato e corretto il crash PlanView dovuto all’inizializzazione degli helper',
        'Room/corridor routing is now more robust: geometrically inferred doors also cover rooms without an explicit saved link, and the PlanView crash caused by helper initialization order was fixed'
      ),
      n(
        'Import devices/users: modali annidate stabilizzate (focus, z-index, close behavior), stato vuoto esplicito per clienti senza device importati e ulteriore modularizzazione del server (`users`, `chat`, `meetings`, `realtime`, `static`)',
        'Import devices/users: nested modals stabilized (focus, z-index, close behavior), explicit empty state for clients without imported devices, and further server modularization (`users`, `chat`, `meetings`, `realtime`, `static`)'
      )
    ]
  },
  {
    version: '3.5.1',
    date: '2026-03-06',
    type: 'minor',
    notes: [
      n(
        'Meeting manager: flusso tab consolidato (`Topics and Summary`, `Actions`, `Timeline`, `Notes`) con chiusura modali annidate più prevedibile (la chiusura di una modale figlia riporta alla modale padre)',
        'Meeting manager: consolidated tab flow (`Topics and Summary`, `Actions`, `Timeline`, `Notes`) with more predictable nested modal closing (closing a child modal returns to its parent)'
      ),
      n(
        'Azioni meeting: tabella operativa con modale `Manage` per task (progress 0-100 a step 5, gestione scadenza, `Not needed`, delete) e colorazione riga per stato',
        'Meeting actions: operational table with per-task `Manage` modal (0-100 progress in 5-point steps, deadline handling, `Not needed`, delete) and status-driven row coloring'
      ),
      n(
        'Validazioni salvataggio: appunti non salvabili senza titolo e task con payload non salvabili senza titolo attività',
        'Save validations: notes cannot be saved without a title, and task rows with payload cannot be saved without a task title'
      ),
      n(
        'Timeline follow-up: migliorato il flusso `Create Follow-UP`, menu gear per meeting futuri (`Edit`/`Delete`) e vista chain disponibile da `My meetings`',
        'Follow-up timeline: improved `Create Follow-UP` flow, gear menu for future meetings (`Edit`/`Delete`), and chain view available from `My meetings`'
      ),
      n(
        'PDF meeting manager: introdotta review pre-esportazione e report finale più ricco (partecipanti su 2 colonne, task con percentuali/completate/non necessarie, grafici e statistiche)',
        'Meeting manager PDF: added pre-export review and a richer final report (2-column participants, tasks with percentages/completed/not-needed rows, charts and statistics)'
      ),
      n(
        'Polish localizzazione/tooltip nelle modali meeting e migliorata affidabilità apertura datepicker nella gestione task',
        'Localization/tooltip polish across meeting modals and improved datepicker opening reliability in task management'
      )
    ]
  },
  {
    version: '3.4.1',
    date: '2026-02-27',
    type: 'fix',
    notes: [
      n(
        'Meeting center in PlanView: il bottone verde apre una modale con due percorsi (`Scheduling` e `My meetings`) per separare timeline sale e agenda personale',
        'Meeting center in PlanView: the green button now opens a modal with two paths (`Scheduling` and `My meetings`) to separate room timeline and personal agenda'
      ),
      n(
        'Scheduling ora riusa la stessa schermata `Mostra meetings` disponibile da menu cliente/sede, inclusa l’azione `Nuovo meeting` in alto a destra',
        'Scheduling now reuses the same `Show meetings` screen available from client/site menus, including the top-right `New meeting` action'
      ),
      n(
        'Aggiunta vista `My meetings` con elenco meeting passati/in corso/futuri per l’utente loggato e accessi rapidi a dettaglio e scheduling',
        'Added `My meetings` view listing past/in-progress/upcoming meetings for the logged-in user with quick access to detail and scheduling'
      ),
      n(
        'Appunti meeting: enforcement server-side “solo partecipanti” per lettura/scrittura/export/AI transform (admin e superadmin restano autorizzati)',
        'Meeting notes: server-side “participants only” enforcement for read/write/export/AI transform (admin and superadmin remain authorized)'
      ),
      n(
        'Performance mobile login: su route `/mobile` viene saltata l’idratazione completa `/api/state`, riducendo il tempo percepito in apertura',
        'Mobile login performance: `/mobile` route now skips full `/api/state` hydration, reducing perceived startup time'
      )
    ]
  },
  {
    version: '3.4.0',
    date: '2026-02-26',
    type: 'minor',
    notes: [
      n(
        'Mobile app: caricamento iniziale e sincronizzazione migliorati con polling ottimizzato, riduzione richieste concorrenti e shell pagina più stabile su smartphone/notch',
        'Mobile app: improved initial loading and synchronization with optimized polling, fewer overlapping requests, and a more stable page shell on smartphones/notch devices'
      ),
      n(
        'Chat mobile: elenco stile WhatsApp (ultimo contatto), thread dedicato con header sticky/composer fisso, badge unread, supporto DM e vocali (record + playback)',
        'Mobile chat: WhatsApp-like list (latest contact first), dedicated thread with sticky header/fixed composer, unread badge, DM support, and voice notes (record + playback)'
      ),
      n(
        'Meeting mobile/kiosk: dettaglio riunione più ricco con partecipanti e check-in, sincronizzazione check-in più reattiva e miglioramenti UX su QR/meeting timeline',
        'Mobile/kiosk meetings: richer meeting detail with participants and check-in, more responsive check-in sync, and UX improvements across QR flow and meeting timelines'
      ),
      n(
        'Timeline meeting: fissata la colonna sale, affinato indicatore NOW/ORA e stabilizzata la modale di duplicazione riunioni (focus, click-through e caricamento calendario)',
        'Meeting timelines: sticky room column, refined NOW indicator, and stabilized duplicate-meeting modal (focus, click-through, and calendar loading)'
      ),
      n(
        'Refactor qualità: pulizia codice non usato e riduzione duplicazioni nelle logiche import/preview, parsing timestamp più robusto e hardening TypeScript',
        'Quality refactor: cleaned unused code and reduced duplication in import/preview logic, more robust timestamp parsing, and TypeScript hardening'
      )
    ]
  },
  {
    version: '3.3.0',
    date: '2026-02-25',
    type: 'minor',
    notes: [
      n(
        'Meeting room: nuovo flusso completo con timeline “Mostra meetings”, pianificazione da stanza/sede, modifica rapida, supporto multi-giorno e dettaglio check-in',
        'Meeting room: new end-to-end workflow with “Show meetings” timeline, room/site scheduling, quick edit actions, multi-day support, and check-in details'
      ),
      n(
        'Kiosk mode meeting room: schermata tablet/web dedicata con progress riunione, check-in sincronizzato lato server, pianificazione giornaliera, support/help e logo cliente/business partner',
        'Meeting room kiosk mode: dedicated tablet/web screen with meeting progress, server-synced check-in, day planning, support/help actions, and client/business-partner branding'
      ),
      n(
        'Notifiche meeting: SMTP per singolo cliente (con email generica portale separata), warning espliciti se il cliente non è configurato e mail meeting con informazioni complete',
        'Meeting notifications: per-client SMTP (with separate generic portal email), explicit warnings when the client is not configured, and richer meeting emails'
      ),
      n(
        'Import utenti reali per cliente: gestione WebAPI/CSV/Manuale riprogettata con preview differenze (aggiungi/aggiorna/elimina), controlli duplicati e strumenti per utenti mancanti/nascosti',
        'Per-client real-user import: redesigned WebAPI/CSV/Manual workflow with diff preview (add/update/delete), duplicate checks, and controls for missing/hidden users'
      ),
      n(
        'Allocamento/capienza: rifiniture UX e integrazione meeting-room per migliorare suggerimenti, badge e percorsi operativi senza cambiare la compatibilità del workspace',
        'Placement/capacity: UX refinements and meeting-room integration to improve suggestions, badges, and workflows without changing workspace compatibility'
      )
    ]
  },
  {
    version: '3.2.0',
    date: '2026-02-20',
    type: 'fix',
    notes: [
      n(
        'Trova sistemazione: apertura da menu cliente/sede ora mantiene la planimetria corrente e non forza più il cambio piano',
        'Find placement: opening from client/site context menu now keeps the current floor plan and no longer forces a plan switch'
      ),
      n(
        'Dashboard capienza: rimosso export PDF instabile e riorganizzato il layout con planimetrie in fascia orizzontale (no scroll verticale principale)',
        'Capacity dashboard: removed unstable PDF export and reworked layout with floor plans in a horizontal strip (no primary vertical scroll)'
      ),
      n(
        'Toaster selezione oggetti: risolto il caso in cui poteva rimanere persistente dopo click destro su un oggetto selezionato',
        'Object selection toaster: fixed case where it could remain persistent after right-clicking a selected object'
      )
    ]
  },
  {
    version: '3.1.1',
    date: '2026-02-20',
    type: 'fix',
    notes: [
      n(
        'Dashboard capienza PDF: risolto il taglio dei valori nelle combobox (cliente/sede/planimetria) durante l’esportazione',
        'Capacity dashboard PDF: fixed clipped combobox values (client/site/floor plan) during export'
      ),
      n(
        'Export PDF dashboard: migliorata la paginazione per evitare pagine finali vuote e blocchi metriche parzialmente tagliati',
        'Dashboard PDF export: improved pagination to prevent trailing blank pages and partially clipped metric blocks'
      ),
      n(
        'Dettaglio planimetrie dashboard: card ampliate con gauge dedicato per ogni singola planimetria',
        'Dashboard floor-plan details: expanded cards with a dedicated gauge for each individual floor plan'
      )
    ]
  },
  {
    version: '3.1.0',
    date: '2026-02-20',
    type: 'minor',
    notes: [
      n(
        'Dashboard capienza: nuova vista statistica per cliente/sede/piano con capienza totale, saturazione, densità utenti e stanze oltre soglia',
        'Capacity dashboard: new analytics view by client/site/floor with total capacity, occupancy, user density, and over-capacity rooms'
      ),
      n(
        'Trend storico capienza: grafico temporale per sede alimentato da snapshot server-side in app_settings',
        'Capacity history trend: time chart per site backed by server-side snapshots in app_settings'
      ),
      n(
        'Nuove API capienza: GET /api/capacity/history (filtrato per permessi) e POST /api/capacity/snapshot (solo superadmin)',
        'New capacity APIs: GET /api/capacity/history (permission-filtered) and POST /api/capacity/snapshot (superadmin-only)'
      ),
      n(
        'Trova sistemazione: flusso guidato per cliente/sede/reparto con fallback progressivo su uffici vuoti e uffici di altri reparti',
        'Find placement: guided client/site/department flow with progressive fallback to empty offices and other-department offices'
      ),
      n(
        'Stanze: aggiunta associazione multi-reparto (`departmentTags`) con suggerimenti dai reparti importati degli utenti reali',
        'Rooms: added multi-department mapping (`departmentTags`) with suggestions from imported real-user departments'
      ),
      n(
        'Documentazione tecnica: nuovo documento docs/CAPACITY_WORKFLOW.md con modello dati, algoritmi e endpoint',
        'Technical documentation: added docs/CAPACITY_WORKFLOW.md covering data model, algorithms, and endpoints'
      )
    ]
  },
  {
    version: '3.0.4',
    date: '2026-02-20',
    type: 'fix',
    notes: [
      n(
        'Update check: controllo aggiornamenti ora disponibile dal menu utente solo per superadmin, con modale dedicata',
        'Update check: update verification moved to the user menu and limited to superadmin, with a dedicated modal'
      ),
      n(
        'Sicurezza aggiornamenti: endpoint update limitato lato server al superadmin con fallback manifest remoto se il sito principale non risponde',
        'Update security: update endpoint is now superadmin-only server-side, with fallback remote manifest when the main website endpoint is unavailable'
      ),
      n(
        'Dipendenze: aggiornato jsPDF a 4.2.0 per mitigare advisory di sicurezza note',
        'Dependencies: upgraded jsPDF to 4.2.0 to mitigate known security advisories'
      ),
      n(
        'Modale update: aggiunte istruzioni operative e spiegazione tecnica della gestione migrazioni database senza perdita dati',
        'Update modal: added operational upgrade guidance and technical explanation of database migration safety without data loss'
      )
    ]
  },
  {
    version: '3.0.3',
    date: '2026-02-19',
    type: 'fix',
    notes: [
      n(
        'README: aggiunta gallery screenshot aggiornata con workspace, routing mappa interna, modale via di fuga e anteprima PDF',
        'README: added updated screenshot gallery covering workspace, internal map routing, escape route modal, and PDF preview'
      ),
      n(
        'Release metadata allineata alla versione 3.0.3',
        'Release metadata aligned to version 3.0.3'
      ),
      n(
        'Branding/UI: logo sidebar, login e pagina donazioni aggiornati con riferimenti al sito ufficiale www.plixmap.com',
        'Branding/UI: sidebar logo, login, and donations page now include references to the official website www.plixmap.com'
      ),
      n(
        'Governance progetto: aggiunta licenza MIT e sezione README su uso gratuito, supporto volontario, disclaimer e canali GitHub per bug/richieste',
        'Project governance: added MIT license and README sections for free usage, voluntary support, disclaimer, and GitHub channels for bugs/requests'
      )
    ]
  },
  {
    version: '3.0.2',
    date: '2026-02-19',
    type: 'minor',
    notes: [
      n(
        'Primo setup: cliente d’esempio rinominato in "PlayGround", badge "cliente di esempio" in Impostazioni > Clienti e messaggio guidato al primo accesso su uso/rimozione demo',
        'First setup: demo client renamed to "PlayGround", added "example client" badge in Settings > Clients, and guided first-login prompt about demo use/removal'
      ),
      n(
        'Planimetria: per stanze e corridoi aggiunto nome inglese opzionale con rendering etichetta localizzato (IT/EN) su mappa e ricerca',
        'Floor plan: added optional English name for rooms and corridors, with localized label rendering (IT/EN) on map and search'
      ),
      n(
        'Antenne WiFi custom: il campo modello non è più obbligatorio',
        'Custom WiFi antennas: model field is no longer required'
      ),
      n(
        'Documentazione: README snellito, sezione "What\'s new" spostata in `CHANGELOG.md` con link GitHub',
        'Documentation: streamlined README, moved "What\'s new" content to `CHANGELOG.md` with GitHub link'
      ),
      n(
        'README: sezione chat rinominata in "Internal Chat Service", highlights aggiornati e recovery password superadmin documentato (Docker + npm)',
        'README: chat section renamed to "Internal Chat Service", highlights updated, and superadmin password recovery documented (Docker + npm)'
      )
    ]
  },
  {
    version: '3.0.1',
    date: '2026-02-19',
    type: 'fix',
    notes: [
      n(
        'Pulizia repository: rimossi dalla history Git gli artefatti runtime in `data/` (SQLite, WAL/SHM, upload e backup) per evitare esposizione dati personali',
        'Repository cleanup: removed runtime `data/` artifacts from Git history (SQLite, WAL/SHM, uploads, backups) to prevent personal-data exposure'
      ),
      n(
        'Hardening privacy: introdotto controllo automatico `sensitive:check` per bloccare file/valori sensibili prima di CI e release',
        'Privacy hardening: added automatic `sensitive:check` guard to block sensitive files/values before CI and release'
      ),
      n(
        'Hook pre-commit versionato: blocco su file locali d’istanza (`data/*`) e rilevazione di possibili segreti SMTP/WebAPI/import in chiaro',
        'Versioned pre-commit hook: blocks local instance files (`data/*`) and detects likely plaintext SMTP/WebAPI/import secrets'
      )
    ]
  },
  {
    version: '3.0.0',
    date: '2026-02-19',
    type: 'major',
    notes: [
      n('Brand migration step 2: identita progetto consolidata su Plixmap (UI, favicon/PWA, export naming e runtime keys)', 'Brand migration step 2: project identity consolidated to Plixmap (UI, favicon/PWA, export naming, runtime keys)'),
      n('Compatibilita legacy attiva rimossa dai path runtime principali (cookie/sessione/CSRF/eventi drag unlock) e standardizzazione su prefissi plixmap', 'Removed active legacy compatibility from core runtime paths (cookie/session/CSRF/drag unlock events) and standardized on plixmap prefixes'),
      n('Documentazione aggiornata alla release 3.0.0 con naming Plixmap e variabili ambiente PLIXMAP_*', 'Documentation updated for release 3.0.0 with Plixmap naming and PLIXMAP_* environment variables')
    ]
  },
  {
    version: '2.9.5',
    date: '2026-02-19',
    type: 'minor',
    notes: [
      n(
        'Stanze: ottimizzato il rendering etichette per mantenere nome/capienza sempre dentro i bounds della stanza con wrapping più robusto',
        'Rooms: optimized label rendering to keep name/capacity inside room bounds with more robust wrapping'
      ),
      n(
        'Stanze: migliorata la leggibilità etichetta con spaziature interne adattive e layout più stabile su stanze strette o piccole',
        'Rooms: improved label readability with adaptive inner spacing and a more stable layout on narrow/small rooms'
      ),
      n(
        'Shortcut mappa: premendo `R` si apre ora una modale dedicata alla scelta modalità di creazione stanza',
        'Map shortcut: pressing `R` now opens a dedicated modal to choose room creation mode'
      ),
      n(
        'Modale creazione stanza: shortcut dirette `R` (rettangolo) e `P` (poligono) per avviare subito il disegno',
        'Room creation modal: direct shortcuts `R` (rectangle) and `P` (polygon) to start drawing immediately'
      ),
      n(
        'UX modale stanza: testi e pulsanti aggiornati con hint tastiera espliciti per un flusso più rapido',
        'Room modal UX: refreshed copy/buttons with explicit keyboard hints for a faster workflow'
      )
    ]
  },
  {
    version: '2.9.3',
    date: '2026-02-18',
    type: 'fix',
    notes: [
      n(
        'Layers: corretta la visibilità degli utenti reali; il layer "Real user" non dipende più dal layer utenti generici',
        'Layers: fixed real-user visibility; the "Real user" layer no longer depends on generic users layer visibility'
      ),
      n(
        'Layers: corretto "Mostra tutto" quando si disattiva il layer stanze; le stanze ora scompaiono correttamente dalla mappa',
        'Layers: fixed "Show all" when disabling the Rooms layer; rooms now disappear correctly from the map'
      ),
      n(
        'Audit logica layer: normalizzazione estesa per oggetti real_user legacy con assegnazione layer storica su "users"',
        'Layer-logic audit: normalization extended for legacy real_user objects with historical "users" layer assignment'
      ),
      n(
        'Affidabilità: backup SQLite atomico lato server con retention configurabile, elenco backup e download diretto da Impostazioni > Backup',
        'Reliability: added atomic server-side SQLite backup with configurable retention, backup listing and direct download in Settings > Backup'
      ),
      n(
        'Migrazioni DB: introdotta tabella `schema_migrations` con ledger applicazioni e validazione sequenza versioni',
        'DB migrations: introduced `schema_migrations` ledger with applied-migration tracking and strict version sequence validation'
      ),
      n(
        'Sicurezza: gestione secret hardenizzata con supporto `*_FILE`, lunghezza minima configurabile e modalità strict (`DESKLY_REQUIRE_ENV_SECRETS`)',
        'Security: hardened secret handling with `*_FILE` support, configurable minimum length, and strict mode (`DESKLY_REQUIRE_ENV_SECRETS`)'
      ),
      n(
        'Observability: aggiunti request-id, log strutturato richieste API, endpoint health (`live/ready`) e stato migrazioni DB via API',
        'Observability: added request-id, structured API request logging, health endpoints (`live/ready`) and DB migration status API'
      ),
      n(
        'Performance frontend: lazy-load dei modali pesanti di ricerca/percorso/foto in PlanView per ridurre il carico iniziale',
        'Frontend performance: lazy-load for heavy search/route/photo modals in PlanView to reduce initial load'
      ),
      n(
        'Performance canvas: background spostato su FastLayer statico e culling viewport per oggetti fuori schermo',
        'Canvas performance: moved background to static FastLayer and added viewport culling for off-screen objects'
      ),
      n(
        'CSP: policy più restrittiva di default, con eccezioni MediaPipe/eval abilitate solo tramite variabili ambiente dedicate',
        'CSP: stricter policy by default, with MediaPipe/eval allowances enabled only through dedicated environment variables'
      ),
      n(
        'Export tabellare: rimosso ExcelJS (catena archiver/minimatch) e migrato l’export “Excel” a SpreadsheetML multi-foglio (.xls) senza dipendenze vulnerabili runtime',
        'Tabular export: removed ExcelJS (archiver/minimatch chain) and migrated “Excel” export to multi-sheet SpreadsheetML (.xls) with no vulnerable runtime dependencies'
      )
    ]
  },
  {
    version: '2.9.1',
    date: '2026-02-17',
    type: 'minor',
    notes: [
      n(
        'Stanze: introdotte le porte di collegamento tra due uffici selezionati (menu contestuale su stanza), con vincolo di posizionamento su lato condiviso sovrapposto',
        'Rooms: added connecting doors between two selected offices (room context menu), with placement restricted to an overlapping shared side'
      ),
      n(
        'Porte di collegamento stanza-stanza: supporto completo a selezione, doppio click per modifica proprietà, menu destro dedicato e rimozione',
        'Room-to-room connection doors: full support for selection, double-click property editing, dedicated right-click menu, and deletion'
      ),
      n(
        'Routing mappa interna e via di fuga: il calcolo percorso considera anche le nuove porte stanza-stanza per raggiungere corridoi/uscite da uffici non direttamente affacciati',
        'Internal-map and escape-route routing: path calculation now considers room-to-room connecting doors to reach corridors/exits from offices not directly facing a corridor'
      ),
      n(
        'Persistenza planimetria: roomDoors inclusi in salvataggio, revisioni, restore e duplicazione planimetria con remap corretto degli ID stanza',
        'Floor plan persistence: roomDoors are now included in save, revisions, restore, and floor-plan duplication with correct room ID remapping'
      ),
      n(
        'Layers: corretto comportamento "Mostra tutto" + toggle singolo layer (la disattivazione ora nasconde davvero il layer selezionato)',
        'Layers: fixed "Show all" + single-layer toggle behavior (disabling now correctly hides the selected layer)'
      ),
      n(
        'Rubrica utenti: export PDF con nuova modale di selezione colonne prima della generazione finale',
        'User directory: PDF export now includes a column-selection modal before final generation'
      ),
      n(
        'Modifica collegamenti: fix reset campi durante la digitazione nelle modali di edit (nome/descrizione non vengono più sovrascritti)',
        'Link editing: fixed field reset while typing in edit modals (name/description are no longer overwritten)'
      ),
      n(
        'Pannello Sicurezza: rimossa la colonna "ID porta" dalla tabella porte emergenza e dall’export CSV',
        'Safety panel: removed "Door ID" column from emergency-doors table and CSV export'
      ),
      n(
        'Import WebAPI: ingranaggio spostato nel messaggio guida, pulsanti Test/Sync disabilitati finché la WebAPI non è configurata; Svuota importazione e Aggiorna impostazioni abilitati solo dopo almeno una importazione',
        'WebAPI import: gear moved into helper message, Test/Sync disabled until WebAPI is configured; Clear import and Update settings enabled only after at least one import'
      )
    ]
  },
  {
    version: '2.9.0',
    date: '2026-02-17',
    type: 'minor',
    notes: [
      n(
        'Via di fuga: indicazioni passo-passo aggiornate, con icona bandiera a scacchi riservata esclusivamente all’ultimo step (punto di raccolta quando presente)',
        'Escape route: step-by-step directions updated, with checkered-flag icon reserved exclusively for the final step (assembly point when present)'
      ),
      n(
        'Via di fuga: aggiunte coordinate Google Maps al punto di raccolta nelle indicazioni e nella scheda emergenza PDF',
        'Escape route: added Google Maps coordinates for assembly points in directions and in the PDF emergency card'
      ),
      n(
        'Export PDF via di fuga: la scheda emergenza è stata spostata in fondo come ultima sezione, sotto le indicazioni passo-passo, con testo “Indicazione aggiuntiva” aggiornato',
        'Escape route PDF export: emergency card moved to the end as the last section, below step-by-step directions, with updated “Additional guidance” text'
      )
    ]
  },
  {
    version: '2.8.6',
    date: '2026-02-17',
    type: 'minor',
    notes: [
      n(
        'Via di fuga: aggiunta modalità Full screen nella modale per visualizzare la mappa percorso a schermo intero',
        'Escape route: added Fullscreen mode in the modal to view the route map in full screen'
      ),
      n(
        'Export PDF via di fuga: aggiunta pagina “Scheda emergenza” con numeri utili e punti di raccolta configurati',
        'Escape route PDF export: added an “Emergency card” page with useful numbers and configured assembly points'
      ),
      n(
        'Via di fuga: se è presente un punto di raccolta sul piano di arrivo, il tracciato mostra una linea tratteggiata dall’uscita al punto di raccolta (anche in PDF)',
        'Escape route: when an assembly point exists on the arrival floor, the route now shows a dashed line from the exit to the assembly point (also in PDF)'
      )
    ]
  },
  {
    version: '2.8.5',
    date: '2026-02-17',
    type: 'minor',
    notes: [
      n(
        'Porte corridoio: aggiunta opzione "Esterno" nelle proprietà porta per identificare le uscite verso l’esterno edificio',
        'Corridor doors: added "External" option in door properties to identify exits leading outside the building'
      ),
      n(
        'Nuova funzione "Via di fuga" da menu contestuale (click destro) su mappa, stanza o corridoio',
        'New "Escape route" function from context menu (right-click) on map, room, or corridor'
      ),
      n(
        'Calcolo via di fuga: selezione automatica della porta valida più vicina nel tempo con vincolo Emergenza + Esterno',
        'Escape-route calculation: automatic selection of the nearest valid door by time with Emergency + External constraint'
      ),
      n(
        'Percorsi multi-piano via di fuga: transizioni limitate alle sole scale (ascensori esclusi) mantenendo il tracciato sulla mediana dei corridoi',
        'Multi-floor escape routes: transitions limited to stairs only (elevators excluded) while keeping centerline corridor routing'
      ),
      n(
        'Via di fuga: nuova modale dedicata con freccia direzionale, navigazione per piano e anteprima/esportazione PDF multi-pagina',
        'Escape route: new dedicated modal with direction arrow, floor navigation, and multi-page PDF preview/export'
      )
    ]
  },
  {
    version: '2.8.3',
    date: '2026-02-17',
    type: 'fix',
    notes: [
      n(
        'Mappa interna: se partenza e destinazione sono nella stessa stanza, il percorso usa una linea tratteggiata diretta A→B anche senza corridoi configurati',
        'Internal map: when start and destination are in the same room, route uses a direct dashed A→B line even with no configured corridors'
      ),
      n(
        'Routing senza corridoi: evitato il falso errore “Nessun corridoio configurato” nei casi validi interni alla stessa stanza',
        'No-corridor routing: avoided false “No corridors configured” errors for valid routes inside the same room'
      ),
      n(
        'Visualizzazione percorso diretto stanza: nascosti i marker porta arancioni per mantenere il tracciato pulito solo tratteggiato',
        'Direct in-room route rendering: hidden orange door markers to keep a clean dashed-only path'
      ),
      n(
        'Indicazioni passo-passo (stessa stanza): semplificate in un unico step con icona arrivo “bandiera a scacchi” e testo “Partenza e destinazione sono all’interno della stessa stanza”',
        'Step-by-step directions (same room): simplified to a single step with checkered-flag arrival icon and text “Start and destination are inside the same room”'
      )
    ]
  },
  {
    version: '2.8.2',
    date: '2026-02-17',
    type: 'fix',
    notes: [
      n(
        'Export PDF mappa interna: stabilizzato il download da anteprima senza chiudere la modale (fix click su dialog sovrapposti + fallback blob/save)',
        'Internal map PDF export: stabilized preview download flow without closing the modal (overlapping-dialog click fix + blob/save fallback)'
      ),
      n(
        'Indicazioni passo-passo PDF: nuovo layout visuale con icone SVG contestuali (partenza, svolta dx/sx, corridoio, scale/ascensore, arrivo)',
        'PDF step-by-step directions: new visual layout with contextual SVG icons (start, left/right turn, corridor, stairs/elevator, arrival)'
      ),
      n(
        'Indicazioni passo-passo PDF: rimossi i badge numerici e migliorata leggibilità icone (dimensioni maggiori e resa grafica più definita)',
        'PDF step-by-step directions: removed numeric badges and improved icon readability (larger size and sharper visual rendering)'
      )
    ]
  },
  {
    version: '2.8.1',
    date: '2026-02-17',
    type: 'fix',
    notes: [
      n(
        'Mappa interna: export percorso con anteprima in-app (prima si verifica il risultato, poi si esporta PDF) con pulsanti Chiudi e Stampa/Salva PDF funzionanti',
        'Internal map: route export now uses an in-app preview first (review before PDF export) with working Close and Print/Save PDF actions'
      ),
      n(
        'Fix export PDF percorso multi-piano: ripristinata la planimetria di sfondo nelle pagine esportate (inline immagini + rasterizzazione SVG prima della cattura)',
        'Multi-floor route PDF export fix: restored background floor plan rendering in exported pages (image inlining + SVG rasterization before capture)'
      ),
      n(
        'Export percorso interno: eliminata la dipendenza da finestre about:blank/blob e script inline, rendendo il flusso compatibile con CSP restrittive',
        'Internal route export: removed dependency on about:blank/blob windows and inline scripts, making the flow compatible with strict CSP policies'
      )
    ]
  },
  {
    version: '2.8.0',
    date: '2026-02-17',
    type: 'minor',
    notes: [
      n(
        'Mappa interna: percorso multi-piano con segmenti per piano, indicatore piano corrente e frecce in basso a destra per passare al piano precedente/successivo',
        'Internal map: multi-floor routing with per-floor segments, current-floor indicator, and bottom-right arrows to move to previous/next floor'
      ),
      n(
        'Punti di collegamento corridoio tra piani: tipo transizione configurabile (Scale/Ascensore), visualizzazione in mappa e penalità tempo nel calcolo ETA (+15s scale, +30s ascensore)',
        'Cross-floor corridor connection points: configurable transition type (Stairs/Elevator), shown on map, with ETA penalties (+15s stairs, +30s elevator)'
      ),
      n(
        'Mappa interna: in destinazione cliente/sede bloccati sulla scelta di partenza (si cambia solo planimetria di destinazione)',
        'Internal map: destination keeps client/site locked to start selection (only destination floor plan can change)'
      ),
      n(
        'Routing corridoi: se A e B sono interni al corridoio il percorso resta sulla mediana del corridoio e chiude con tratti obliqui verso i punti',
        'Corridor routing: when both A and B are inside corridors, route stays on corridor centerline and ends with oblique links to points'
      ),
      n(
        'Punti di collegamento tra piani: tooltip descrittivo senza ID tecnici, con nomi piano evidenziati',
        'Inter-floor connection points: descriptive tooltip without technical IDs, with highlighted floor names'
      ),
      n(
        'Punto di raccolta: coordinate Google Maps spostate sotto Note, link cliccabili in Rubrica emergenze e voce contestuale "Apri in Google Maps"',
        'Assembly point: Google Maps coordinates moved under Notes, clickable links in Emergency directory, and context action "Open in Google Maps"'
      ),
      n(
        'Mappa interna: fallback percorso su corridoi nei casi misti corridoio/non-corridoio per ridurre i falsi "Percorso non trovato" nei tragitti multi-piano',
        'Internal map: corridor-walkable fallback for mixed corridor/non-corridor cases to reduce false "Path not found" on multi-floor routes'
      ),
      n(
        'Mappa interna: export PDF multi-pagina con una pagina per ogni piano del percorso (partenza/attraversamento/arrivo) e pagina finale con indicazioni passo-passo',
        'Internal map: multi-page PDF export with one page per route floor (start/transit/arrival) and a final page with step-by-step directions'
      ),
      n(
        'Routing misto corridoio/non-corridoio: corretto salto porta->collegamento, mantenendo il tracciato rosso sulla mediana del corridoio fino al punto interno',
        'Mixed corridor/non-corridor routing: fixed door->connection jump by keeping the red route on corridor centerline up to the internal point'
      ),
      n(
        'Export PDF mappa interna: generazione diretta del file senza popup anteprima (eliminati problemi CSP su about:blank/blob)',
        'Internal map PDF export: direct file generation without preview popup (removed CSP issues on about:blank/blob)'
      ),
      n(
        'Scheda sicurezza in planimetria: rimossi i pulsanti statici +/- e aggiunto menu contestuale dedicato (Mostra/Nascondi, Rubrica emergenze) con toaster coerente alla selezione',
        'Floor-plan safety card: removed static +/- buttons and added dedicated context menu (Show/Hide, Emergency directory) with selection-aware helper toast'
      ),
      n(
        'Corridoi: aggiunta inserzione punto di svincolo con tasto centrale del mouse (in sostituzione del pulsante + contestuale)',
        'Corridors: added middle-mouse insertion of junction points (replacing the contextual + button)'
      ),
      n(
        'Stanze: etichette renderizzate con clipping sul perimetro stanza per evitare overflow fuori dal poligono',
        'Rooms: labels are now clipped to room bounds to prevent overflow outside room polygons'
      ),
      n(
        'Fix duplicazione planimetria: risolto crash React dovuto all’ordine degli hook nella modale di clonazione',
        'Floor-plan duplication fix: resolved React crash caused by hook-order violation in clone modal'
      ),
      n(
        'Fix modale oggetto: inizializzazione resa stabile per evitare reset dei campi durante l’editing (incluso inserimento nome telecamera)',
        'Object modal fix: stabilized initialization to prevent field reset while editing (including camera name input)'
      )
    ]
  },
  {
    version: '2.7.3',
    date: '2026-02-16',
    type: 'minor',
    notes: [
      n(
        'Sicurezza > Mirino selezionati: aggiunti full screen, navigazione tra planimetrie con frecce tastiera (←/→), frecce in basso a sinistra/destra e uscita full screen con Esc',
        'Safety > Selected crosshair: added fullscreen, floor-plan navigation with keyboard arrows (←/→), bottom-left/bottom-right arrow buttons, and Esc fullscreen exit'
      ),
      n(
        'Sicurezza > Mirino selezionati: export PDF aggiornato con selezione planimetrie (tutte o subset) mantenendo il contenuto visibile della preview',
        'Safety > Selected crosshair: PDF export now supports floor-plan selection (all or subset) while preserving visible preview content'
      ),
      n(
        'Toolbar planimetria: Time Machine spostato accanto a Mappa interna, tooltips estesi su Time Machine/Griglia/Chat/Stampa e pulsante Mappa interna arricchito con guida a passi',
        'Floor-plan toolbar: Time Machine moved next to Internal Map, extended tooltips for Time Machine/Grid/Chat/Print, and Internal Map button enriched with step-by-step guidance'
      ),
      n(
        'Stanze: etichette ora gestibili da tastiera su stanza selezionata (+/- dimensione, freccia su/giù posizione alto/basso)',
        'Rooms: labels are now keyboard-editable on selected rooms (+/- size, up/down arrow top/bottom position)'
      ),
      n(
        'Disegno stanza poligonale: segmenti ortogonali di default, segmenti obliqui con Shift e toaster guida persistente durante il disegno',
        'Polygon room drawing: orthogonal segments by default, oblique segments with Shift, and persistent guidance toast while drawing'
      ),
      n(
        'Scheda sicurezza in planimetria: resize unificato al sistema room (Transformer), rimosso il grip custom, palette azzurra a angoli retti, controlli +/- ridotti e shortcut C/F con toaster guida',
        'Floor-plan safety card: resize unified with room system (Transformer), custom grip removed, square-corner azure palette, smaller +/- controls, and C/F shortcuts with guidance toast'
      )
    ]
  },
  {
    version: '2.7.2',
    date: '2026-02-16',
    type: 'minor',
    notes: [
      n(
        'Viste: icona occhio spostata nel menu verticale della mappa (sopra VD) e pulsante VD disabilitato quando manca una vista di default',
        'Views: eye icon moved to the map vertical toolbar (above VD), and VD button disabled when no default view exists'
      ),
      n(
        'Modale “Salva vista”: opzione Default come primo controllo, nome vista sempre obbligatorio, avviso esplicito quando si sostituisce una default già presente',
        '“Save view” modal: Default option moved to the first control, view name always required, and explicit warning when replacing an existing default'
      ),
      n(
        'Viste planimetria: nomi resi univoci per planimetria con rinomina automatica dei duplicati (_1, _2, ...)',
        'Floor-plan views: names are now unique per floor plan with automatic duplicate renaming (_1, _2, ...)'
      ),
      n(
        'Toaster oggetto selezionato: aggiunti dettagli “Tipo oggetto” e “Nome oggetto”',
        'Selected object toast: added “Object type” and “Object name” details'
      )
    ]
  },
];
