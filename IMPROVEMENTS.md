# Report di Miglioramento del Codebase Plixmap

_React 19 + Vite + Express/better-sqlite3 — ~141k LOC_
_Data: 31 maggio 2026_

## 1. Sintesi esecutiva (stato di salute)

- **Funzionalmente solido ma architetturalmente sotto pressione.** Il codice usa pattern corretti (SQL parametrizzato, header di sicurezza, CSRF, password bootstrap protetta da `mustChangePassword`), ma è dominato da pochi file monolitici: `PlanView.tsx` (22.064 righe), `CanvasStage.tsx` (7.178 righe), `useDataStore.ts` (2.023 righe), `server/index.cjs` (1.852 righe). Questi concentrano rischio di manutenzione e regressione.
- **Sicurezza: due punti caldi reali e prioritari.** Sanitizzazione HTML mancante sui contenuti delle note riunioni (`meetingNotes.cjs`, `LexicalNotesEditor`) e directory `/public-uploads` servita senza controllo accessi. Diversi controlli sono già in atto, ma queste due lacune sono concrete e sfruttabili.
- **Supply chain: vulnerabilità note non risolte.** Cinque pacchetti con advisory (dompurify, lodash, ws, path-to-regexp, qs); gli `overrides` in `package.json` pinnano a versioni ancora vulnerabili invece di risolvere la causa a monte. `ws` è il fix più immediato e a basso rischio.
- **Qualità dei dati e cache: rischi di correttezza.** Cache di stato filtrato (`filteredStateCache`) mai invalidata sui cambi di permessi, indice mancante su `permissions(userId)`, e una race condition nel lock dei piani durante salvataggi concorrenti.
- **Testing front-end inesistente.** 178 file `.tsx/.ts`, ~109 componenti, zero unit test; E2E ridotto a uno smoke test. Il backend ha copertura discreta (~2.023 righe di test) ma con buchi su moduli critici (MFA, realtime, dataRoutes, meetingNotes).

## 2. Tabella dei miglioramenti prioritari

Ordinata per impatto/severità, poi per sforzo crescente.

| Priorità | Area | Problema | Azione consigliata | Impatto | Sforzo |
|----------|------|----------|--------------------|---------|--------|
| 1 | Sicurezza | `ws@8.19.0` vulnerabile (GHSA-58qx-3vcg-4xpx, divulgazione memoria) | Aggiornare a `^8.21.0` | Alto | Piccolo |
| 2 | Sicurezza | Note riunioni: `contentHtml`/`contentLexical` salvati senza sanitizzazione (`server/routes/meetingNotes.cjs:217-218`); `LexicalNotesEditor` carica HTML non sanitizzato | Sanitizzare lato server con `sanitizeHtmlBasic` prima dell'inserimento; allineare `MeetingNotesModal` a `ClientNotesModal` | Alto | Piccolo |
| 3 | Data layer | `filteredStateCache` mai invalidata sui cambi permessi (`server/index.cjs:1068`); utenti vedono stato stale | Invalidare cache su `UPDATE permissions` (hook in `routes/users.cjs`, `customImport.cjs`) o aggiungere version counter permessi alla chiave | Alto | Medio |
| 4 | Data layer | Indice mancante su `permissions(userId)` → full scan per richiesta (`server/db.cjs:696-705`, `permissions.cjs:64`) | `CREATE INDEX idx_permissions_userId ON permissions(userId)` | Alto | Piccolo |
| 5 | Sicurezza | `/public-uploads` servita senza autenticazione (`server/index.cjs:1087-1091`); attachment scaricabili da chiunque ne indovini il nome | URL firmati con scadenza o spostamento su path autenticato | Alto | Medio |
| 6 | Supply chain | `overrides` (dompurify, lodash, qs, serialize-javascript) pinnati a versioni ancora vulnerabili (`package.json:91-97`) | Aggiornare i consumer a monte (jspdf, workbox-build, express); documentare ogni override con CVE | Alto | Medio |
| 7 | Sicurezza | XSS via `contentHtml` non sanitizzato nel render Lexical (`RichTextEditor.tsx:60`, `InternalMapModal.tsx:3920`) | Sanitizzare con libreria provata (dompurify aggiornato) su tutti i path `innerHTML`/`dangerouslySetInnerHTML` | Alto | Medio |
| 8 | Backend | Soppressione silenziosa eccezioni (`server/routes/chat.cjs:66,89,102,160,177,195,723,770`) | Sostituire `catch {}` con logging strutturato | Alto | Medio |
| 9 | Backend | Validazione input assente su `/api/state` (profondità/dimensione array) (`dataRoutes.cjs:250-266`, limite 80mb senza depth check) | Validazione schema (zod/joi): profondità max ~5, dimensioni array, lunghezze stringa | Alto | Medio |
| 10 | Data layer | Race condition nel lock dei piani durante salvataggi concorrenti (`dataRoutes.cjs:268-328`, `permissions.cjs:155`) | Lock DB-backed o optimistic locking con `rowVersion`; ri-validare lock nella stessa transazione | Alto | Grande |
| 11 | Backend | Gestione errori incoerente in callback async (`index.cjs:1177-1245` npm-audit; `1461-1493` backup) | Check `res.headersSent`; loggare fallimenti su audit log; validare `result.fileName`/`sizeBytes` | Alto | Medio |
| 12 | Testing | Front-end senza unit test; E2E solo smoke | Vitest + RTL su path critici (PlanView, modali, mutazioni store); estendere Playwright a flussi funzionali | Alto | Grande |
| 13 | TypeScript | Server interamente CommonJS senza tipi/JSDoc; contratto API non tipizzato | `server/types.d.ts` o JSDoc sugli export; migrazione incrementale a TS | Alto | Grande |
| 14 | Architettura | `PlanView.tsx` god component (22.064 righe) | Estrarre `usePlanWebSocket`, `useModalStack`/`ModalManager`, `CanvasViewport` | Alto | Grande |
| 15 | React perf | `CanvasStage` monolitico (7.178 righe) impedisce memoizzazione granulare | Estrarre `CorridorLayer`/`RoomLayer`/`ObjectLayer`/`LinksLayer` memoizzati | Alto | Grande |
| 16 | React perf | Selettori Zustand troppo ampi → re-render su ogni mutazione (`PlanView.tsx:268-301,1251`) | Selettori granulari/factory memoizzate; comparatori `shallow` | Alto | Medio |
| 17 | React perf | Nessun error boundary a livello canvas (`AppErrorBoundary` solo a root) | `CanvasErrorBoundary` attorno a `CanvasStage` (`PlanView.tsx:~13316`) | Alto | Piccolo |

## 3. Sezioni per dimensione (restanti finding)

### Architettura e struttura del codice

- **`CanvasStage` con interfaccia da ~199-240 prop** (`CanvasStage.tsx:19-239`): nessun uso di React Context nell'intero codebase; 57 callback `on*` e flag booleani multipli per le modalità tool. Introdurre `CanvasContextProvider`, raggruppare prop in domain object, usare discriminated union per `toolMode`/`roomDrawMode`/`corridorDrawMode`. (high)
- **State management frammentato** in 5 store senza facade (`useDataStore.ts` 2023, `useUIStore.ts` 439, ecc.): mutazioni cross-store via `getState()` (`useAuthStore`→`useUIStore`/`useCustomFieldsStore`), 584 `as any`, nessuna separazione read/write. Creare `usePlanViewState` come facade tipizzata. (high)
- **`SidebarTree.tsx` 4.579 righe, 41 `useState`**: mescola UI tree, orchestrazione modali e logica di dominio meeting. Split in container/presentational + `useMeetingTimeline`, `useSidebarState`. (high)
- **`CustomImportPanel.tsx` 4.482 righe, 75 `useState`**: conflà UI, client API e dominio per 4 workflow (WebAPI, LDAP, CSV, Manuale). Estrarre `ImportDataService`, `ImportSearchUtils`, sotto-componenti per config. (high)
- **30+ modali in `/plan` con stato sparso in PlanView** (`PlanView.tsx:160-193` lazy-import; 97 `useState` modali in 581-864): introdurre `ModalStack`/`ModalManager` con `dispatch(openModal(...))`. (high)
- **Nessun confine API client/server** (`src/api/` 20 file vs 45 `.cjs`): nessuno spec OpenAPI, validazione divergente client/server (`customImport.ts` 1031 righe vs `customImport.cjs` 832). Definire OpenAPI + codegen, pilota su `/api/customImport`. (high)
- **Keyboard shortcut sparsi** su 9 file `planKeyboard*` (`PlanView.tsx:148-156`): aggregare in `useKeyboardShortcuts` con registry. (medium)
- **WebSocket realtime dentro la logica di PlanView** (`getWsUrl` riga 130): estrarre `usePlanWebSocket` + context, separare eventi server da azioni utente. (medium)
- **`server/index.cjs` 1.852 righe** con responsabilità intrecciate (capacity 434-607, CSRF 303-381, CSP 174-200): estrarre `capacity.cjs`, `health.cjs`, `updates.cjs`, middleware CSRF; target <500 righe. (medium)
- **Logica normalize/validate duplicata** (`CustomImportPanel.tsx:49-85`, `ObjectModal.tsx:144-173`): centralizzare in `src/utils/validation.ts` + `server/utils/validation.cjs`. (medium)
- **`useUIStore` conflà 6+ categorie** (viewport, selezione, modali, feature flag, layout, chat): split in hook di dominio + selettori. (medium)

### React / performance di rendering

- **Allocazioni inline nei render path** (`CanvasStage.tsx:706, 827-828, 2236, 5169`; 46 `.map()` con literal nuovi): memoizzare con dipendenze stabili o hoisting. (medium)
- **23 `useState` in CanvasStage** (`544-614`): consolidare lo stato transitorio (`useCanvasDraft`, `useCameraState`). (medium)
- **72 `useRef` di drag non azzerati** all'unmount (`554-614`): cleanup in `useEffect`. (medium)
- **Dipendenze effect implicite/mancanti** (`615-700+`, es. riga 621): attivare ESLint `exhaustive-deps`. (medium)
- **PlanView sottoscrive stato annidato in modo ampio** (`1-100`, `268-301`): `usePlanViewState` con slice esatte. (medium)
- **Overhead hit graph Konva** (59 `listening={false}` ma molti default true; `Layer listening={!toolMode}` riga 3540): disabilitare listening su elementi decorativi/layer di sfondo. (medium)
- **Gap accessibilità canvas** (`7097-7162`): `aria-label` sui bottoni tool, `role="region"`, `aria-live` per modalità. (low)
- **Overhead Fragment in liste** (React 19 consente array diretti). (low)
- **Stima larghezza testo ripetuta per oggetto** (`908, 2144, 3702`): cache con `useMemo` chiave `(text, fontSize)`. (low)

### Backend / Express / Node

- **Operazioni DB sincrone bloccanti** (`index.cjs:1063-1066` writeState; `dataRoutes.cjs:337-345`; query chat senza paginazione): profilare durata, paginare le query unread (`chat.cjs:47,83`), valutare caching aggregazioni. (medium)
- **Realtime senza recovery** (`realtime.cjs:59-65` `jsonSend` silenzioso; lock in Map in-memory): loggare errori send, backoff broadcast, persistere lock con versioning. (medium)
- **WHERE dinamico senza safeguard** (`dataRoutes.cjs:63-96`): assert `where.length < N`, documentare invarianti, estrarre `QueryBuilder`. (medium)
- **Logging insufficiente nei transaction handler** (`dataRoutes.cjs:339-345`; pattern simile in `meetingLifecycle.cjs`, `users.cjs`): try-catch con log su `serverLog` + audit. (medium)
- **Config non validata allo startup** (`config.cjs:114-144`): verificare esistenza/scrivibilità di `dbPath`, `backupDir`, `uploadsDir` con fail-fast. (medium)
- **Nessun timeout sulle operazioni DB** (`dataRoutes.cjs:250-367`): `Promise.race` con timeout 30s, middleware timeout Express. (medium)
- **Rate limiting non persistente** (`index.cjs:1105-1139`): documentare il limite; loggare `warn` al raggiungimento soglia. (low)

### Sicurezza

- **Password bootstrap hardcoded `'deskly'`** (`auth.cjs:127,166`; `routes/auth.cjs:243`): mitigata da `mustChangePassword` e policy password forte, ma da rimuovere/randomizzare; valutare `PLIXMAP_REQUIRE_ENV_SECRETS`. (medium)
- **Debolezze CSRF e origin checking** (`index.cjs:359-376`): endpoint `/meeting-room/*` esenti, validazione origin/referer non rigorosa; rafforzare con `SameSite=Strict` e rate limiting al posto dell'esenzione. (medium)
- **Rate limiting non copre tutti gli endpoint auth** (`index.cjs:306-346`): login senza limiti visibili; estendere a login/reset/MFA. (medium)
- **Validazione LDAP debole** (`customImport/ldap.cjs:53-105,255`): validare DN (RFC 4514), escaping filtri LDAP, limitare `sizeLimit` a 1000. (medium)
- **Session fixation / invalidazione debole** (`auth.cjs:55-76`; `routes/auth.cjs:105`): incrementare `tokenVersion` al cambio password/MFA, endpoint di revoca sessioni. (medium)
- **Validazione upload chat insufficiente** (`services/chat.cjs:148-166`): verificare dimensione decodificata vs dichiarata, magic bytes, mismatch estensione. (medium)
- **Nessuna rotazione chiavi auth/encryption** (`db.cjs:1021-1058`): versioning chiavi, rotazione schedulata. (medium)
- **MFA senza rate limiting** (`mfa.cjs:36-42`): TOTP brute-forzabile; limitare a 3 tentativi/min, backoff, lockout. (medium)
- **Path traversal backup** (`index.cjs:1500-1510`): whitelist dei nomi backup validi prima del download. (low)
- **SSTI potenziale nelle email** (`services/meetings.cjs`): audit escaping input utente nei template. (low)
- **Nessun secrets scanning in git**: pre-commit `git-secrets`/`detect-secrets`, `.gitignore` per `.env`. (low)

### Data layer e state management

- **Store Zustand monolitico con 50 `set()` e traversal full-tree** (`useDataStore.ts`, helper 373-454; 47 incrementi `version`): mitigato da selettori, ma normalizzare slice per ID + Immer; valutare TanStack Query per stato server. (medium)
- **Pattern O(n³) nel save path** (`dataRoutes.cjs:282-302`, `hasPlanId` chiamato in loop): costruire `planMap` una volta, usare `Map.has()` (pattern già presente in `permissions.cjs:155-189`). (medium)
- **`state.json` monolitico in SQLite senza paginazione/streaming** (`index.cjs:1062`): snapshot base + delta, o denormalizzare entità ad alto traffico. (medium)
- **`normalizeClientLayers`/`normalizePlan` su ogni load** (`useDataStore.ts:981,989,613,624`): cache per `(clientId, versionHash)` o spostare lato server. (medium)
- **Creazione bulk custom field senza batching** (`dataRoutes.cjs:160-166`, fino a 500 chiamate in transazione): INSERT multi-row. (medium)
- **Lookup `linkedExternalId` potenzialmente non indicizzato** (`db.cjs:560-562`, `routes/imports.cjs`): verificare ordine colonne indice, eventuale indice su `linkedExternalClientId`. (medium)
- **Backup pruning sincrono** (`backup.cjs:28-45,65,102` con `readdirSync`/`statSync`): cache con TTL 1 min, pruning async. (low)

### TypeScript e type safety

- **`as any` eccessivi in `App.tsx`** (righe 77,119,125,179,195,210,234,299,307,311,326,419,549,578,643,680): le proprietà utente sono già tipizzate; i casi reali sono su stato UIStore (`presentationMode`, `dirtyByPlan`) e `setState` parziali. (high→medium)
- **Tipi di ritorno mancanti su helper** (`PlanView.tsx:7264,7297` `getRoomIdAt`/`getCorridorIdAt`): aggiungere `string | undefined` e tipi `Room[]`/`Corridor[]` (TS inferisce ma esplicitare migliora manutenibilità). (medium)
- **`any` in PDF utilities** (`pdf.ts:44,61-63,107-108,166-237`): definire `RoomRenderProps`/`WallRenderProps`/`QuoteRenderProps`. (medium)
- **Store accesso via `as any`** (`App.tsx:119,234,307,311,419`): rimuovere cast non necessari, le proprietà sono già tipizzate in `UIState`. (medium)
- **API boundary non tipizzata** (`src/api/state.ts,auth.ts,customImport.ts`): definire response type (es. `AuthErrorResponse`) e wrapper type-safe. (medium)
- **`document.fullscreenElement` con doppio cast** (`App.tsx:299,326`): utility `src/utils/fullscreen.ts`. (low)
- **`strict` attivo ma 1.638 `any`** (`tsconfig.json:14-16`): abilitare `@typescript-eslint/no-explicit-any` come error e ridurre incrementalmente. (medium)
- **Callback store con `any[]`** (`App.tsx:444,499`): tipizzare con `Client[]` da `store/types`. (medium)

### Testing, CI/CD, Build e Tooling

- **4 route server senza test** (`adminLogs.cjs`, `dataRoutes.cjs`, `externalDirectory.cjs`, `meetingNotes.cjs`): prioritizzare `meetingNotes` e `dataRoutes`. (medium)
- **Moduli critici senza test** (`mfa.cjs`, `realtime.cjs`, `permissionCacheKey.cjs`, `customFields.cjs`): prioritizzare MFA e routing WebSocket. (medium)
- **Nessun gate sulle dimensioni bundle** (`vite.config.ts` warning-only a 750KB; dist 5.3MB, jspdf/lexical/konva pesanti): convertire warning in failure CI, lazy-load canvas/editor, `rollup-plugin-visualizer`. (medium)
- **CI incompleta** (`quality-gate.yml`): manca coverage, trend bundle, visual regression, performance budget, a11y; aggiungere `c8` con soglie, Percy/Playwright visual, Lighthouse CI. (medium)
- **Config Playwright minimale** (`playwright.config.ts` 14 righe): retry, sharding, reporter multipli. (low)
- **Pre-commit solo sensitive check** (`.githooks/pre-commit`): aggiungere `tsc --noEmit` e test. (low)
- **Nessun framework di mocking condiviso**: fixture condivise (`createMockDb`, `createMockRuntime`). (low)

### Dipendenze e supply chain

- **path-to-regexp@8.3.0** (via express 5.2.1→router 2.2.0): GHSA-j3q9-mxjg-w52f (DoS, CVSS 7.5) + GHSA-27v5 (ReDoS); fix in 8.4.0+ ma express non ancora aggiornabile — monitorare. (high)
- **lodash@4.17.23** (via vite-plugin-pwa→workbox-build 7.4.0): GHSA-r5fr-rjxr-66jc (code injection, CVSS 8.1); upgrade workbox-build a 8.x. Nessun uso diretto. (high)
- **dompurify@3.3.3** (transitiva opzionale via jspdf): 4 bypass XSS; non usata direttamente (l'app usa `sanitizeHtmlBasic`), upgrade a >=3.4.0 e rimozione override. (high→medium)
- **qs@6.15.0** (via express/body-parser): GHSA-q8mj-m7cp-5q26 (DoS); aggiornare a `^6.15.2`. (medium)
- **Lexical 0.41.0 → 0.45.0** (10 pacchetti): aggiornare in gruppo, testare editor (tabelle/liste/formattazione). (medium)
- **37 dipendenze outdated** (nodemailer 8.0.2→8.0.10, react-router-dom, lucide-react 0.577→1.17 major): PR di upgrade pianificata + test E2E smoke. (medium)
- **serialize-javascript pinnato senza giustificazione** (via `@rollup/plugin-terser`): documentare l'override. (medium)
- **`@babel/plugin-transform-modules-systemjs`** (GHSA-fv7c-fp4j-7gwp, CVSS 8.2, dev-only): individuare consumer (eslint/playwright) e aggiornare. (medium)
- **Nessuna policy supply chain documentata**: aggiungere `npm audit` in CI (fail `--audit-level=high` su prod), Dependabot/Renovate, documentare ogni override con CVE. (medium)

## 4. Quick wins (sforzo piccolo, impatto buono)

1. **Aggiornare `ws` a `^8.21.0`** — chiude GHSA-58qx-3vcg-4xpx, rischio nullo. (Sicurezza)
2. **Aggiungere `CREATE INDEX idx_permissions_userId ON permissions(userId)`** (`db.cjs`) — elimina full scan per ogni richiesta. (Data layer)
3. **Sanitizzare `contentHtml` lato server in `meetingNotes.cjs:217-218`** con `sanitizeHtmlBasic` — chiude un XSS reale. (Sicurezza)
4. **Aggiornare `qs` a `^6.15.2`** e rimuovere l'override obsoleto. (Supply chain)
5. **Sostituire i `catch {}` di `chat.cjs`** (righe 66,89,102,160,177,195,723,770) con logging strutturato. (Backend)
6. **`CanvasErrorBoundary` attorno a `CanvasStage`** (`PlanView.tsx:~13316`) — evita il reload dell'intera app sugli errori Konva. (React)
7. **Cleanup dei ref di drag all'unmount** in `CanvasStage` (`554-614`). (React)
8. **Rimuovere i `as any` non necessari** su `UIState` in `App.tsx` (119,234,307,311,419). (TypeScript)
9. **Estrarre `src/utils/fullscreen.ts`** per eliminare il doppio cast `document` in `App.tsx:299,326`. (TypeScript)
10. **Validare la config allo startup** (`config.cjs`) con fail-fast su path DB/backup/uploads. (Backend)
11. **Centralizzare normalize/validate** in `src/utils/validation.ts` riusando le funzioni locali duplicate. (Architettura)
12. **Espandere il pre-commit hook** con `tsc --noEmit` per bloccare i commit non compilanti. (Tooling)