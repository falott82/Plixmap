# Revisione del codice Plixmap — Report di sintesi

> **Stato implementazione (2026-06-01)** — verificato con `tsc` ✓ e `vite build` ✓.
>
> ✅ **Già corretto e verificato:**
> - H1 — revoca sessione applicata su WebSocket (`server/routes/auth.cjs`)
> - H2 — rate-limit sugli endpoint meeting pubblici (`meetingPublic.cjs`, `index.cjs`)
> - H3 — bypass SSRF chiuso nel fallback curl, `--resolve` + `max-redirs=0` (`network.cjs`)
> - H4 — IP non più diffusi a tutti via presence; redazione lato server (`realtime.cjs`)
> - H5 — XSS stored nell'export PDF chiuso (header via DOM/`textContent`) (`pdf.ts`)
> - H7 — rimosso storage password in chiaro nel mobile; login via cookie di sessione (`MobileAppPage.tsx`)
> - M1 — CSV formula injection neutralizzata in 3 exporter (`logRetention.cjs`, `meetingNotes.cjs`, `meetings.cjs`)
> - M2 — `decryptSecret` ritorna `null` su blob corrotto (`mfa.cjs`)
> - M3 — solo il superadmin può modificare/eliminare i privilegi di un altro admin (`users.cjs`)
> - M9 — sanitizer HTML client sostituito con DOMPurify allowlist (`sanitizeHtml.ts`, `package.json`)
> - M14 — `SYSTEM_LAYER_IDS` reso SSOT unico in `data.ts` (era triplicato)
> - M8 — handler AI-transform deduplicato (meeting + client notes) (`meetingNotes.cjs`, −106 righe)
> - M4 — i warning SMTP non bloccano più notifiche tech-setup + audit log in autonomous-create (`meetingLifecycle.cjs`)
> - M12 — selector Zustand: `NerdAreaPanel` atomico + 12 call-site `, shallow)` (inefficaci in v5) convertiti a `useShallow` (`App.tsx`, `HelpPanel`, `ChangelogPanel`, `UpdateCheckModal`, `SidebarTree`, `PlanView`)
> - M5 — destrutturazione `ctx` ridotta ai soli nomi usati nei 5 moduli import (−~180 righe morte)
> - M6 — logica di acquisizione lock deduplicata in `realtime.cjs` (`buildGrantPayload`/`buildLockedByPayload`/`acquireLockFor`)
> - M1 — DM per client REST: thread-open marca i messaggi come consegnati (sblocca unread/read + ricevuta) (`chat.cjs`)
> - M3 (parziale) — rate-limit su `/api/chat/unread` e `/api/chat/mobile/overview` (riscrittura query N+1 rimandata)
>
> ✅ Verifica: `tsc` ✓, `vite build` ✓, **73/73 unit test** ✓ (better-sqlite3 ricompilato), server riavviato.
>
> ⏳ **Da fare (consigliato, non ancora applicato):**
> - M3 (resto) — riscrittura delle query DM N+1 (medium, semantica delicata: validare conteggi unread prima/dopo)
> - M8 (frontend) — race condition WS: fallimento transitorio disabilita presence+lock gate (`PlanView.tsx:3615`)
> - Sanitizer **lato server** (`server/utils/sanitizeHtml.cjs`) è ancora regex denylist (defense-in-depth); valutare `jsdom`+DOMPurify.
> - Unificare gli helper di geometria duplicati (M15) — i 3 `polygonCentroid` hanno contratti diversi (`null` vs `{0,0}`): richiede verifica per-call-site + test.
> - Decomposizione dei file giganti (H6 `PlanView.tsx` 22k, H8 `SidebarTree.tsx`, H9 `MobileAppPage.tsx`, `CanvasStage.tsx`, ecc.) — vedi §4.

## 1. Sintesi esecutiva

Stato generale: il progetto Plixmap (React/TS frontend + Node/Express/SQLite/WebSocket backend) e' funzionalmente ricco ma presenta **debiti strutturali e di sicurezza significativi**. Sono stati confermati in modo avversariale **86 problemi**. Le aree piu' critiche sono:

- **Sicurezza realtime/auth**: la revoca delle sessioni non e' applicata sul canale WebSocket; presenza che divulga gli IP a tutti gli utenti.
- **Sicurezza import/export**: bypass SSRF tramite fallback curl; XSS stored nell'export PDF; iniezione formula CSV.
- **Decomposizione**: diversi file mostruosi (PlanView.tsx ~22k righe, CanvasStage.tsx ~7k, SidebarTree.tsx 4.5k, ClientChatDock.tsx 4k, MeetingNotesModal.tsx 4.3k) che rendono il codice non revisionabile e generano bug di stale-closure.

### Conteggi per severita'

| Severita' | Numero |
|-----------|--------|
| High      | 9      |
| Medium    | 17     |
| Low       | 60     |
| **Totale**| **86** |

### Conteggi per dimensione

| Dimensione        | Numero |
|-------------------|--------|
| security          | 15     |
| solid-dry         | 17     |
| decomposition     | 17     |
| bug               | 8      |
| edge-case         | 8      |
| dead-code         | 5      |
| performance       | 6      |
| race-condition    | 1      |
| naming-structure  | 1     |

Valutazione complessiva: **la maggioranza dei problemi e' a basso rischio di fix (quick win)**. I rischi alti riguardano quasi esclusivamente i grandi refactoring di decomposizione, che vanno fatti in modo incrementale.

---

## 2. Problemi critici/alti di sicurezza

### 2.1 [HIGH] Revoca sessione non applicata su WebSocket
- **File**: `server/routes/auth.cjs:126` (`getWsAuthContext`)
- **Impatto**: `getWsAuthContext` autentica una WS usando solo il cookie di sessione firmato senza confrontare `session.tokenVersion` con `user.tokenVersion`. `tokenVersion` e' il meccanismo di revoca (incrementato su cambio password al primo accesso, disattivazione MFA, reset password). Dopo una revoca, una sessione compromessa/loggata-out puo' comunque aprire e mantenere una connessione WS (presenza, lock dei piani, broadcast chat).
- **Fix**: aggiungere `tokenVersion` alla query e rifiutare in caso di mismatch, replicando `requireAuth` (righe 105-109):
  ```js
  const row = db.prepare('SELECT id, username, tokenVersion, isAdmin, isSuperAdmin, disabled, avatarUrl FROM users WHERE id = ?').get(session.userId);
  if (!row) return null;
  if (Number(row.disabled) === 1) return null;
  if (Number(row.tokenVersion) !== Number(session.tokenVersion)) return null;
  ```
  Opzionale: selezionare anche `mustChangePassword` e rifiutare se = 1.
- **Rischio fix**: basso.

### 2.2 [HIGH] Endpoint pubblici meeting senza rate limiting
- **File**: `server/routes/meetingPublic.cjs:464` (anche 524, 562)
- **Impatto**: i tre endpoint pubblici (`GET .../schedule`, `POST .../checkin-toggle`, `POST .../help-request`) sono non autenticati e CSRF-exempt, senza alcun rate limiter (non esiste limiter globale in `index.cjs`). `help-request` invia una mail SMTP per richiesta -> spam verso le mailbox IT/pulizie/caffe'; `schedule` consente enumerazione; `checkin-toggle` consente scritture illimitate. Ogni chiamata esegue `readState()` -> amplificatore DoS.
- **Fix**: applicare `rateLimit({ name, windowMs, max, key })` IP-keyed a tutti e tre. Per `help-request` bucket piu' stretto con `key: req => `${req.ip}:${req.params.roomId}`` e max 3-5/min. Verificare `trust proxy` in produzione.
- **Rischio fix**: basso.

### 2.3 [HIGH] Bypass guardia SSRF: il fallback curl ri-risolve l'hostname
- **File**: `server/customImport/network.cjs:409-466`
- **Impatto**: in-process e child-process pinnano l'IP validato via `connectAddress`, ma `requestImportPayloadViaCurl` NON onora `connectAddress`: scrive `url = "..."` senza direttiva `--resolve`, quindi curl risolve da solo il DNS. Un attaccante con DNS-rebinding (TTL ~0) la cui hostname passa `validateImportUrl` ma ri-risolve a `169.254.169.254` / `127.0.0.1` / `10.x` bypassa la guardia. Il path curl e' raggiungibile su errori retryable inducibili dall'attaccante.
- **Fix**: pinnare l'IP validato nel config curl con direttiva `resolve`:
  ```js
  const parsed = new URL(rawUrl);
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  const host = normalizeHostLiteral(parsed.hostname);
  if (ip && net.isIP(ip)) lines.push(`resolve = "${escapeCurlConfigValue(`${host}:${port}:${ip}`)}"`);
  ```
  In alternativa, eliminare del tutto il fallback curl (gli altri due path coprono gia' gli errori retryable). Opzionale `max-redirs = 0`.
- **Rischio fix**: basso.

### 2.4 [HIGH] `global_presence` divulga gli IP di tutti gli utenti a tutti i client
- **File**: `server/realtime.cjs:285` (`emitGlobalPresence`)
- **Impatto**: `broadcastToAll()` invia a ogni client WS senza gating admin; il payload include `ip: info.ip` (riga 234). Ogni utente autenticato riceve l'IP di tutti gli altri connessi. Emesso su connect, close, join/leave e ogni cambio di lock -> leak PII cross-user.
- **Fix**: redazione lato server. Inviare la presence di default SENZA `ip`, e una variante arricchita (con IP) solo ai socket admin/superAdmin via loop filtrato/`sendToUser`. Applicare identicamente sia a `computeGlobalPresence` (riga 233) che a `computePresence` (riga 192).
- **Rischio fix**: basso.

### 2.5 [HIGH] XSS stored: `clientLabel` interpolato non-escaped in innerHTML (export PDF)
- **File**: `src/utils/pdf.ts:1267` (`exportClientNotesToPdf`)
- **Impatto**: il corpo note e' sanificato, ma `params.clientLabel` e il data URL del logo sono interpolati in `header.innerHTML` senza escape. `clientLabel` deriva da campi editabili (`client.shortName||name — selected.title`). L'header viene aggiunto al documento live per html2canvas -> un `<img src=x onerror=...>` esegue script nell'origine app (cookie CSRF auto-allegato). XSS stored reale.
- **Fix**: non interpolare `clientLabel` in innerHTML. Opzione (1) helper `escapeHtml`; opzione (2) preferita: costruire il blocco via DOM con `document.createElement` e `.textContent = params.clientLabel || ''`. Inoltre emettere `<img>` del logo solo se `desklyLogo` inizia con `'data:image/'`.
- **Rischio fix**: basso.

### 2.6 [HIGH] App mobile salva la password in chiaro in localStorage
- **File**: `src/components/mobile/MobileAppPage.tsx:1517` (anche 823-861, 1018)
- **Impatto**: con `rememberPassword` la password raw viene scritta in localStorage e auto-sottomessa al load successivo; sopravvive al logout. localStorage e' leggibile da qualsiasi XSS nell'origine. Trasforma il modello cookie/CSRF in esposizione di credenziali persistenti.
- **Fix**: smettere di persistere la password. Rimuovere `password` dall'oggetto scritto (1517-1526) e dal re-write di logout, rimuovere il rehydrate (831-832) e l'auto-login basato su password (841-861). Affidarsi al cookie di sessione HttpOnly 30-giorni gia' emesso: `fetchMe` su `/api/auth/me` ripristina la sessione. Mantenere solo `username`/`rememberUsername`.
- **Rischio fix**: medio.

### 2.7 [MEDIUM] Iniezione formula CSV nell'export log scaduti
- **File**: `server/logRetention.cjs:35` (`escapeCsv`)
- **Impatto**: `escapeCsv` non neutralizza i prefissi formula (`= + - @`) ne' tab/CR iniziali. Colonne attacker-influenced (username, ip, userAgent, path, recipient, subject...). Un superadmin che apre il `.csv` in Excel esegue formule (es. `=HYPERLINK(...)`). Inoltre non quota `\r` da solo.
- **Fix**: defangare i prefissi PRIMA del check di quoting e aggiungere `\r` al regex:
  ```js
  const escapeCsv = (value) => {
    let raw = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`;
    if (!/[,"\r\n]/.test(raw)) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
  };
  ```
- **Rischio fix**: basso.

### 2.8 [MEDIUM] Admin regolare puo' degradare/disabilitare altri admin
- **File**: `server/routes/users.cjs:700-808` (PUT) e ~937 (DELETE)
- **Impatto**: `PUT /api/users/:id` blocca solo la modifica di superadmin e la promozione ad admin. Nessuna guardia impedisce a un admin regolare di degradare (`isAdmin:false`), bloccare (`disabled:true`) o ri-permissionare un altro admin regolare. Account admin mutuamente distruttibili.
- **Fix**: dopo il caricamento del target, aggiungere:
  ```js
  if (target.isAdmin && !req.isSuperAdmin) {
    if (isAdmin === false || disabled === true || Array.isArray(permissions)) {
      res.status(403).json({ error: 'Only superadmin can modify another admin\'s privileges' }); return;
    }
  }
  ```
  Applicare lo stesso check a DELETE. Confermare prima se si desidera un modello flat-admin intenzionale.
- **Rischio fix**: medio.

### 2.9 [MEDIUM] `sanitizeHtmlBasic` e' un sanitizer denylist con bypass noti
- **File**: `src/utils/sanitizeHtml.ts:5`
- **Impatto**: rimuove una denylist fissa di tag e `on*`/`javascript:`, ma NON strippa: attributi `style`, schemi `data:`/`vbscript:`, vettori SVG, `srcset`/`formaction`/`xlink:href`. Fallback catch strippa solo `<script>` via regex. E' il gate per notesHtml legacy e il path PDF/export.
- **Fix**: sostituire con DOMPurify (gia' dipendenza — ma da spostare da "overrides" a "dependencies") con config allowlist; oppure indurire il walker (allowlist tag, drop `style`, allowlist schemi su href/src/xlink:href/srcset/formaction, fallback catch -> textContent). Sanificare anche lato server prima della persistenza. Includere i tag emessi da Lexical.
- **Rischio fix**: medio.

### 2.10 [LOW] IP client WebSocket si fida di X-Forwarded-For ignorando trust-proxy
- **File**: `server/index.cjs:1187` (`getWsClientIp`)
- **Impatto**: legge `x-forwarded-for` incondizionatamente. Senza proxy fidato, qualsiasi client WS puo' falsificare l'IP registrato. Solo display presence/admin, ma incoerente con il resto.
- **Fix**: onorare `serverConfig.trustProxy`; usare `req.socket.remoteAddress` (req e' http.IncomingMessage raw, non Express):
  ```js
  const direct = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  if (serverConfig.trustProxy) { const xff = req.headers['x-forwarded-for']; if (xff) return normalizeIp(xff); }
  return normalizeIp(direct);
  ```
- **Rischio fix**: basso.

### 2.11 [LOW] CSRF token confrontato con uguaglianza non constant-time
- **File**: `server/index.cjs:362`
- **Impatto**: `String(headerToken) !== String(cookieToken)` non e' timing-safe. Rischio pratico basso ma incoerente con `timingSafeEqual` usato altrove.
- **Fix**: confronto Buffer con guardia di lunghezza (obbligatoria — `timingSafeEqual` lancia su lunghezze diverse):
  ```js
  const a = Buffer.from(String(headerToken)); const b = Buffer.from(String(cookieToken));
  if (!cookieToken || !headerToken || a.length !== b.length || !crypto.timingSafeEqual(a, b)) { res.status(403)...; return; }
  ```
- **Rischio fix**: basso.

### 2.12 [LOW] Token di sessione senza validazione di scadenza server-side
- **File**: `server/auth.cjs:62`
- **Impatto**: `verifySession` verifica solo la firma HMAC, mai l'eta' max contro `iat`. La scadenza dipende solo dal cookie Max-Age (hint client). Un token catturato e' replayabile indefinitamente finche' `serverInstanceId` e `tokenVersion` non cambiano.
- **Fix**: aggiungere check eta' assoluta in `requireAuth` e `getWsAuthContext`:
  ```js
  const SESSION_MAX_AGE_MS = 30*24*60*60*1000;
  const iat = Number(session.iat);
  if (!Number.isFinite(iat) || Date.now() - iat > SESSION_MAX_AGE_MS) { clearSessionCookie(res); res.status(401)...; return; }
  ```
- **Rischio fix**: basso.

### 2.13 [LOW] `checkin-toggle` pubblico accetta `entryKey` arbitrario non validato
- **File**: `server/routes/meetingPublic.cjs:524`
- **Impatto**: scrive `key` dalla request in `meeting_checkins` senza verificare che appartenga a un partecipante reale del booking, ne' la finestra temporale. Anonimo che indovina roomId+meetingId inquina lo stato check-in.
- **Fix**: costruire il set di chiavi consentite da `mapMeetingRow(booking).participants` via `buildCheckInKeyForRealParticipant` (+ chiave guest esterni `EXT::name::email`), rifiutare con 400 se `key` non e' nel set. Forzare anche il check finestra (`startAt <= now < endAt`). Caricare la riga completa per ottenere i partecipanti. Aggiungere rate limiting per-IP.
- **Rischio fix**: medio.

### 2.14 [LOW] Rilevamento IPv6 privati incompleto (NAT64, IPv4-compatible, 6to4)
- **File**: `server/customImport/network.cjs:34-43` (`isPrivateIpv6`)
- **Impatto**: cattura solo `::`, `::1`, `fe80*`, `fc/fd`. Manca IPv4-compatible (`::a.b.c.d`), NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`), Teredo (`2001::/32`). Loopback/metadata esprimibili come literal IPv6.
- **Fix**: hardening low. Estendere per decodificare l'IPv4 embedded e ri-eseguire `isPrivateIpv4`; oppure preferibilmente sostituire i check manuali con `ipaddr.js` (`ipaddr.parse(ip).range()`). Aggiungere unit test per ogni forma.
- **Rischio fix**: medio.

### 2.15 [LOW] `force_unlock_done` si fida dell'identita' e dell'esito asseriti dal client
- **File**: `server/realtime.cjs:811`
- **Impatto**: il check `entry.targetUserId === info.userId` e' corretto, ma il rilascio del lock e il takeover si basano puramente sul flag `ok`/`action` auto-riportato dal client. Il salvataggio avviene via HTTP separato, quindi il layer WS non puo' conoscere l'esito reale -> audit log puo' registrare un esito non avvenuto.
- **Fix**: fix di fedelta' audit, NON di access-control. Etichettare l'azione come client-asserted: `details: { reason: 'force_unlock_done', assertedAction: action, outcomeVerified: false }`. Opzionalmente derivare l'azione reale confrontando `updatedAt`/revision prima/dopo. NON gateare il rilascio sull'`action`.
- **Rischio fix**: medio.

---

## 3. Bug, race condition ed edge case

### 3.1 [MEDIUM] Race: fallimento WS transitorio disabilita permanentemente presence E lock gate
- **File**: `src/components/plan/PlanView.tsx:3615`
- **Impatto**: `onclose`/`onerror` impostano `realtimeDisabled = true` senza mai resettarlo e senza logica di riconnessione. Un singolo blip (restart server, glitch rete) uccide presence e locking per l'intera sessione. Peggio: `lockRequired = !realtimeDisabled && ...` -> con realtime disabilitato il lock gate cade (fail-open), due utenti possono editare lo stesso piano senza coordinamento (last-write-wins).
- **Fix**: (1) riconnessione con backoff esponenziale limitato; resettare `realtimeDisabled` su `onopen`; rimuovere `realtimeDisabledRef.current` dalla guardia di early-return (3394). (2) semantica lock fail-safe: quando degradato, mantenere read-only (fail-closed) o mostrare banner esplicito. Verificare che il reconnect ri-invii `join`/`wantLock`.
- **Rischio fix**: medio.

### 3.2 [MEDIUM] `decryptSecret` di MFA lancia invece di restituire null
- **File**: `server/mfa.cjs:18`
- **Impatto**: nessun try/catch; su mismatch auth-tag/blob malformato (es. dopo rotazione `authSecret`) crypto lancia. Tutti i caller si aspettano null -> invece di 401/400 ottengono 500. Critico per `/mfa/disable`: se `mfaSecretEnc` non e' piu' decifrabile, l'utente non puo' MAI disattivare MFA (500 prima dell'UPDATE).
- **Fix**: wrappare la sezione decrypt in try/catch e ritornare null (come `configStore.decryptString`). NON auto-disabilitare MFA su secret indecifrabile (bypasserebbe TOTP). Recovery gia' fornito da `POST /api/users/:id/mfa-reset` e CLI. Opzionalmente keyare l'encryption MFA su `getOrCreateDataSecret` stabile.
- **Rischio fix**: basso.

### 3.3 [MEDIUM] DM offline restano bloccati: mai conteggiati unread, mai markabili read per client REST-only
- **File**: `server/routes/chat.cjs:600`
- **Impatto**: `deliveredAt` settato solo se il destinatario ha una WS attiva; altrimenti NULL. Tutti i path unread/read filtrano `deliveredAt IS NOT NULL`, e `deliveredAt` e' flippato solo su WS connect. Un destinatario REST-only (mobile overview) non vede il messaggio negli unread ne' puo' markarlo read -> il mittente non ottiene mai la read receipt.
- **Fix**: in `GET /api/chat/:clientId/messages` ramo DM, prima di rispondere chiamare `chatServices.deliverPendingDmMessagesToUser(req.userId)` (o UPDATE mirato `deliveredAt`), poi l'UPDATE /read esistente funziona invariato. Mantenere l'evento receipt al mittente e l'esclusione `recipientHasBlockedSender`.
- **Rischio fix**: medio.

### 3.4 [MEDIUM] Warning email su autonomous-create saltano notifiche technical-setup + audit log
- **File**: `server/routes/meetingLifecycle.cjs:267`
- **Impatto**: in `POST /api/meetings`, se `canCreateAutonomously && sendEmail` e una mail invito ritorna warning SMTP, l'handler fa `res.json({...warnings})` e ritorna subito, saltando il blocco notifica technicalSetup (278), il DM (291-300) e il `writeAuditLog meeting_created` (302-311). Meeting creato ma contatto tecnico mai notificato e mai loggato.
- **Fix**: non ritornare in anticipo. Far cadere l'esecuzione, accumulare `mailWarnings`, eseguire il blocco technicalSetup e `writeAuditLog` incondizionatamente, includere `warnings: mailWarnings` nel `res.json` finale.
- **Rischio fix**: basso.

### 3.5 [LOW] Approvazione object-type-request muta stato globale in step non-transazionati
- **File**: `server/routes/objectTypeRequests.cjs:109`
- **Impatto**: tre mutazioni non atomiche (UPDATE request, readState+writeState, tx custom fields). Se step 2/3 fallisce, la request resta 'approved' ma objectType/custom fields non persistiti, senza retry. Il `try{tx()}catch{}` ingoia gli errori. Nessun rate limiting sul POST.
- **Fix**: (1) aggiungere `rateByUser('object_type_request_create', 10*60*1000, 30)` al POST. (2) NON wrappare `writeState` in transazione SQLite (fa I/O su file e muta cache in-memory che non rollbackano). Riordinare: persistere objectType e custom fields PRIMA, e fare l'UPDATE status='approved' solo dopo il successo. Loggare il catch del tx invece di ingoiarlo.
- **Rischio fix**: medio.

### 3.6 [LOW] ID path interpolati negli URL senza `encodeURIComponent`
- **File**: `src/api/auth.ts:204` (+248,258,263,268), `objectTypeRequests.ts:49,63,74`, `customFields.ts:50,60,65,71`
- **Impatto**: ID server-generati (rischio injection basso) ma un valore con `/ ? # %` romperebbe la route. Incoerente con state.ts/chat.ts/ai.ts/email.ts che usano `encodeURIComponent`.
- **Fix**: wrappare ogni segmento in `encodeURIComponent`. Cambiamento puramente di robustezza/coerenza.
- **Rischio fix**: basso.

### 3.7 [LOW] `parseDateOnly` non valida i range mese/giorno
- **File**: `src/components/plan/ObjectModal.tsx:146`
- **Impatto**: `2024-13-40` passa il regex e `new Date` fa rollover silenzioso -> data security-document accettata e mis-datata, influenzando il sort expiry/status.
- **Fix**: validazione round-trip:
  ```js
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
  ```
  Difesa in profondita': rifiutare `validUntil` malformato anche in `normalizeSecurityDocuments` (dataStoreNormalization.ts:134).
- **Rischio fix**: basso.

### 3.8 [LOW] Client workspace importati spinti nello store non normalizzati
- **File**: `src/components/settings/BackupPanel.tsx:548`
- **Impatto**: `applyWorkspaceImport` chiama `setServerState({clients})` (normalizza) MA anche `setClients(nextClients)` (riga 549) che salva l'array raw senza normalizzatori. Tra il set e il reload differito (600ms) l'app renderizza su dati non normalizzati -> piani/oggetti malformati possono lanciare.
- **Fix**: rimuovere la riga 549 (`setClients(nextClients)`). `setServerState` gia' committa via normalizzatori canonici. Opzionalmente mostrare toast warning se `saveState` lancia.
- **Rischio fix**: medio.

### 3.9 [LOW] `stripHtml` decodifica entita' in ordine errato (double-decode di `&amp;lt;`)
- **File**: `src/components/meetings/MeetingNotesModal.tsx:51`
- **Impatto**: sostituisce `&amp;`->`&` PRIMA di `&lt;`->`<`, quindi `&amp;lt;` diventa `<`. Bug di fedelta' testo (non injection, output non HTML).
- **Fix**: decodificare `&amp;` per ULTIMO: prima `&nbsp; &lt; &gt; &quot; &#39;`, poi `.replace(/&amp;/gi, '&')`.
- **Rischio fix**: basso.

### 3.10 [LOW] `unlimitedRooms` sempre 0 (dichiarato, mai incrementato)
- **File**: `src/utils/capacityMetrics.ts:195`
- **Impatto**: `floorUnlimitedRooms` inizializzato a 0, assegnato a `floorMetric.unlimitedRooms` (259), mai incrementato. UI/PDF che mostrano "unlimited rooms" mostrano dati sbagliati.
- **Fix**: rimuovere il campo `unlimitedRooms` (interface 74, dichiarazione 195, assegnazione 259) — mai letto e nessun concetto dati di stanza illimitata. NON derivarlo da `capacity===0` (significa "non impostato").
- **Rischio fix**: basso.

### 3.11 [LOW] Listener di resize ImageNode leak su pointercancel
- **File**: `src/components/ui/notes/nodes/ImageNode.tsx:88`
- **Impatto**: `pointermove` rimosso solo in `onUp` (su `pointerup`). Se il gesto termina con `pointercancel` (interruzione touch), `onUp` non parte: listener resta attaccato, `isResizing` resta true. Resize interrotti accumulano listener.
- **Fix**: estrarre `finish()` condiviso bindato sia a `pointerup` che `pointercancel` (entrambi once:true); `finish()` rimuove tutti i listener e resetta `isResizing`. Cleanup anche nell'effect di unmount.
- **Rischio fix**: basso.

### 3.12 [LOW] Admin/superadmin puo' disabilitare il proprio account via PUT
- **File**: `server/routes/users.cjs:700-769`
- **Impatto**: DELETE blocca self-delete, PUT no. Un admin puo' settare `disabled:true` su se stesso e auto-bloccarsi; se unico admin attivo, richiede recovery DB-level.
- **Fix**: guardia self condizionale (non bloccare tutti i self-edit):
  ```js
  if (targetId === req.userId) {
    if (disabled === true) return res.status(400).json({ error: 'Cannot disable self' });
    if (isAdmin === false && Number(target.isAdmin) === 1) return res.status(400).json({ error: 'Cannot demote self' });
  }
  ```
- **Rischio fix**: basso.

### 3.13 [LOW] Export chat: `deletedFor` (hide per-utente) esportato a chi puo' esportare il thread
- **File**: `server/routes/chat.cjs:948` (+877-879)
- **Impatto**: il fetch interattivo filtra con `isMessageHiddenForUser`, l'export no -> esportare un thread resuscita messaggi che l'utente aveva nascosto via DELETE ?mode=me.
- **Fix**: applicare `.filter((row) => !chat.isMessageHiddenForUser(row, req.userId))` prima di `.map` in entrambi i rami (le query gia' SELECTano `deletedForJson`). Filtrare sulla riga raw prima del normalize.
- **Rischio fix**: basso.

### 3.14 [LOW] Ricerca log email non escapa wildcard LIKE
- **File**: `server/email.cjs:200`
- **Impatto**: `%${q}%` senza escape di `%`/`_` -> termini con quei caratteri agiscono da wildcard. Problema minore di correttezza/UX (no SQL injection, e' parametrizzato).
- **Fix**: `const escaped = q.replace(/[%_\\]/g, '\\$&');` usare `%${escaped}%`; aggiungere `ESCAPE '\\'` alle tre condizioni LIKE nella stringa `where` condivisa.
- **Rischio fix**: basso.

### 3.15 [LOW] Culling viewport oggetti usa solo l'anchor — oggetti grandi cullati mentre parzialmente visibili
- **File**: `src/components/plan/CanvasStage.tsx:391`
- **Impatto**: `isObjectPotentiallyVisible` testa solo `(obj.x, obj.y)` con margine fisso 420u, ignorando width/height/scale/rotation. Un oggetto grande (immagine, rack scalato) il cui anchor e' fuori viewport ma il corpo dentro viene cullato erroneamente. Oggetti selezionati non esentati -> maniglie selezione spariscono.
- **Fix**: dentro la useMemo `visibleRegularObjects` (2924) usare l'AABB reale via `getObjectBounds(obj)` (gia' memoizzato) e testare intersezione vs viewport con piccolo slack. Includere sempre gli oggetti selezionati/in-drag a prescindere dal culling.
- **Rischio fix**: medio.

### 3.16 [LOW] Export Excel/XML non strippa caratteri di controllo XML-illegali
- **File**: `src/components/settings/BackupPanel.tsx:44` (`escapeXml`)
- **Impatto**: escapa `&<>"'` ma non i control char C0 illegali in XML 1.0. Free-text da dati importati possono contenerli -> file SpreadsheetML che Excel rifiuta/segnala corrotto.
- **Fix**: strippare i control char per primo (preservando Tab/LF/CR): `.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')` prima degli escape entita'.
- **Rischio fix**: basso.

### 3.17 [LOW] join handler: nessun cap join per-utente ne' rate-limit messaggi WS
- **File**: `server/realtime.cjs:496`
- **Impatto**: il message loop WS non e' rate-limited (a differenza delle route HTTP). Un client puo' spammare `join` per molti planId e messaggi che fanno fan-out a tutti -> amplificazione carico broadcast.
- **Fix**: (1) rate limiter per-connessione (token bucket) in cima a `ws.on('message')`; (2) debounce/coalesce trailing-edge attorno a `emitGlobalPresence`; (3) `maxPayload` sul WebSocketServer. Saltare il cap max-join (join gia' idempotenti). Skippare l'emit a riga 605 se il socket era gia' membro.
- **Rischio fix**: medio.

---

## 4. Refactoring SOLID/DRY/SSOT e decomposizione file giganti

> Principio guida per TUTTI i refactoring di decomposizione: **incrementale, bottom-up, una slice per PR/commit, con typecheck + smoke test tra ogni step**. Mai spostare un hook attraverso un confine condizionale/early-return.

### 4.1 [HIGH] `PlanView.tsx` — singolo componente da ~22.000 righe
- **File**: `src/components/plan/PlanView.tsx:219`
- **Impatto**: una function component da 219 a 22089: ~12k righe di hook/logica + ~9.900 righe di JSX. 66 useState, 122 useEffect, 238 useCallback, 133 useMemo, 29 useRef, ~105 handler. 3 suppress `exhaustive-deps` (3099/5098/5125) che mascherano dipendenze mancanti. La dir vuota `presentation/` conferma uno split abbandonato.
- **Piano di suddivisione** (ordine consigliato):
  1. **JSX prima**: estrarre i ~30 modali lazy in un `<PlanModals>` dichiarativo guidato da config map (leaf renderer, prop esplicite) — massimo valore/minimo rischio, taglia migliaia di righe.
  2. Risolvere le 3 suppress exhaustive-deps PRIMA di estrarre (verificare se ref stabili o stale-closure reali).
  3. Estrarre hook self-contained bottom-up: `usePlanUrlParams` (effetti `location.search` dv/tm/pa/cd), poi `usePlanRevisions`, poi `usePlanRealtime`.
  - Target: shell sotto ~600 righe.
- **Rischio fix**: alto.

### 4.2 [MEDIUM] `CanvasStage.tsx` — render Konva monolitico da ~4.100 righe
- **File**: `src/components/plan/CanvasStage.tsx:3066`
- **Impatto**: `CanvasStageImpl` (da 418) ritorna un tree react-konva da 3066 a 7176, con molte closure `.map()` (rooms, corridors, walls, objects, racks, links, drafts, overlay selezione, safety cards). 36 useEffect/37 useCallback/16 useMemo.
- **Piano di suddivisione**:
  1. Spostare i 7 helper geometrici (320-1068) in `canvasGeometry.ts` (rischio zero).
  2. Raggruppare gli 11 ref RAF in un hook `useRafScheduler`.
  3. Estrarre prima i layer leaf low-interaction: `SafetyCardsLayer`, `LinksLayer`, `DraftOverlayLayer`; poi `ObjectsLayer`.
  4. Per la closure a riga 5425 estrarre `<CanvasObject>` memoizzato keyed by `obj.id`, preservando: ref callback in `objectNodeRefs.current[obj.id]`, predicato draggable, `onDragStart`/`cancelBubble`, attach Transformer. Comparatori memo conservativi inizialmente.
- **Rischio fix**: alto.

### 4.3 [HIGH] `SidebarTree.tsx` (4579 righe) — god component (nav tree + ~8 modali client + sottosistema timeline meeting)
- **File**: `src/components/layout/SidebarTree.tsx:293`
- **Impatto**: 41 useState, ~241 riferimenti al cluster `clientMeetings*`. Mescola nav tree, 8+ modali client, e un'intera feature timeline/search/duplicate/check-in con date math inline.
- **Piano di suddivisione**:
  1. Estrarre gli helper puri (date/coord) in util condivisi — **NB**: `src/utils/meetingTime.ts` ESISTE ma NON contiene ancora `hmToMinutes/minutesToHm/monthAnchorFromIso/...` (li ha `getMeetingTimePhase` etc.); l'azione e' MUOVERLI li' e aggiornare anche `PlanView.tsx` (che duplica `hmToMinutes`). `parseCoords` (parser lat/lng) va in `src/utils/coords.ts`, non in meetingTime.ts.
  2. Estrarre `ClientMeetingsTimelineModal` self-contained (riceve client id + onClose), spostandoci dentro l'intero cluster `clientMeetings*` — isola la maggior superficie di stale-closure.
  3. Introdurre `ClientModalsHost` per gli 8 stati id-modal con render lazy.
  4. Lasciare SidebarTree come tree render + selection/expand, opzionalmente con hook `useSidebarTreeData`.
- **Rischio fix**: alto.

### 4.4 [HIGH] `MobileAppPage.tsx` (3444 righe) — intera app mobile, 79 useState
- **File**: `src/components/mobile/MobileAppPage.tsx:1`
- **Impatto**: 79 useState/30 useEffect/21 useCallback. Copre login/MFA, agenda, 3 cache chat (overview/thread/agenda) con TTL hand-rolled copy-pasted (~396/430/462), tema, viewport, keyboard-inset, settings, meeting detail.
- **Piano di suddivisione**:
  1. (basso rischio) Estrarre hook generico `useSessionCache<T>(prefix, ttlMs, opts)` per le 3 coppie read/write (396-489) — rimuove subito la violazione DRY.
  2. (basso) Estrarre `useMobileViewportLock` (overflow-lock 804-814 + visualViewport 906-912).
  3. (alto) Split del render in subcomponenti route-level (`MobileLogin/MFA`, `MobileAgendaTab`, `MobileChatTab`, `MobileSettingsMenu`, `MobileMeetingDetail`), sollevando solo lo stato genuinamente condiviso (auth, tema, check-in maps) in context/parent. Incrementale per tab.
- **Rischio fix**: alto.

### 4.5 [MEDIUM] `ClientChatDock.tsx` (4019 righe, ~97 hook)
- **File**: `src/components/chat/ClientChatDock.tsx:1`
- **Impatto**: message list, compose/send, edit/delete/reply, voice recording, attachment, export, profile, lightbox.
- **Piano**: estrarre `useVoiceRecorder.ts`, `useChatAttachments.ts`, `ChatAttachmentList.tsx`+`VoiceNoteAttachment`, `ChatMediaModal.tsx`, `chatExport.ts`. **Caveat critico**: estraendo `useVoiceRecorder` PRESERVARE il pattern `replyToIdRef`-at-send-time (ref letto in `onstop` MediaRecorder) — e' una mitigazione corretta, non un bug da "sistemare". Esporre `onComplete(file)` e passare il replyTo via ref/argomento fresco. E' decomposizione/manutenibilita', non difetto funzionale.
- **Rischio fix**: medio.

### 4.6 [LOW] `MeetingNotesModal.tsx` (4326 righe)
- **File**: `src/components/meetings/MeetingNotesModal.tsx:1`
- **Piano**: (1) estrarre helper puri in `meetingNotesText.ts` (stripHtml, sanitizeFileName) e `meetingNotesPdf.ts` text/date utils; (2) spostare `exportNotesPdf` in `meetingNotesPdf.ts` con options object esplicito; (3) opzionale: hook `useMeetingManagerFields`/`useMeetingNoteEditor`. Una PR per step, esercitare PDF/save/AI/manager tra step.
- **Rischio fix**: medio.

### 4.7 [MEDIUM] `useDataStore.ts` (2053 righe)
- **File**: `src/store/useDataStore.ts:1`
- **Piano**: (1) riconciliare le due `normalizeClientLayers` divergenti, tenere copia canonica in `dataStoreNormalization.ts`, importarla (rimuove ~410 righe + hazard divergenza); spostare li' anche `SYSTEM_LAYER_IDS`/`defaultLayers`/`ensureLayerTypes`/`normalizeSupportContactValue`. (2) estrarre `DataState` + union `Pick<>` in `dataStoreTypes.ts`. (3) estrarre tree walker + revision math in `dataStoreTree.ts`. (4) opzionale: raggruppare le ~55 action per dominio.
- **Rischio fix**: medio.

### 4.8 [MEDIUM] `InternalMapModal.tsx` (3932 righe) e `ObjectTypesPanel.tsx` (2827) e `SafetyPanel.tsx` (2500)/`ClientDevicesImportPanel.tsx` (1825)
- **InternalMapModal** (`src/components/plan/InternalMapModal.tsx:1`): (1) estrarre `escapeHtml` + geometrie (66-200) in `planGeometry.ts`; (2) image utils in `exportImages.ts`; (3) lift dei builder SVG/HTML annidati a funzioni pure con arg espliciti -> `routePdfHtml.ts` con test di escaping (step medio rischio: chiudono su `selectedClient/routeResult/getRoomLabel/t/lang`); (4) lasciare jsPDF + shell React. **Rischio**: medio.
- **ObjectTypesPanel** (`:173`): (1) estrarre prima i modali leaf `DoorMapPreviewModal`/`DoorHistoryModal`/`WifiModal`; (2) hook condivisi `useIconOptions`/`polygonPath`; (3) per ultimi `ObjectTypeRequestsModal`/`ObjectTypeCustomFieldsModal` con `useObjectTypeDraft`. **Rischio**: alto.
- **SafetyPanel/ClientDevicesImportPanel** (`SafetyPanel.tsx:1`): estrarre prima le primitive di import duplicate (isSuperAdmin guard, CSV template builder/parser, WebAPI config+test) in `settings/importShared/` (pure functions/hook); differire lo split JSX. **Rischio**: alto.

### 4.9 [LOW] God-file backend: `chat.cjs` (1026), `index.cjs` (2159), `dataRoutes.cjs` (528), `imports.cjs` (510), `realtime.cjs` (~1150)
- **chat.cjs** (`server/routes/chat.cjs:1`): split in `chatUnread/chatMessages/chatReactions/chatExport/chatBlocks.cjs`; estrarre `resolveDmContext(req, threadId)` che ritorna primitive (NON un verdetto `canChat` unico, ogni handler gatea diversamente) + `renderChatExport(messages, {title, format})`. Aggiungere test authz DM prima. **Rischio**: medio.
- **index.cjs** (`:1`): low (solo manutenibilita'). Estrarre route maintenance in `routes/maintenance.cjs` via `registerMaintenanceRoutes(app, deps)`; capacity in `capacityHistory.cjs`; CSP/CSRF in `security.cjs`. **Cruciale**: esportare le Map condivise live (`rateBuckets`, `filteredStateCache`, `planAccessCacheByKey`, `chatClientIdsCacheByUser`) NON copie, perche' `writeState` le clear-a. **Rischio**: medio.
- **dataRoutes.cjs** (`:1`): split in `auditRoutes/customFieldsRoutes/stateRoutes.cjs`; estrarre tree traversal in `planTreeOps.cjs`; refactorare `applyLockedPlans` in funzione pura `(serverClients, incomingClients, lockedByOthers) -> merged | {locked: planId}` testabile. **Rischio**: basso.
- **imports.cjs** (`:45-500`): estrarre CSV parser puri in `csvParse.cjs` (parseCsvRows iniettato), preview mapper in `previewMappers.cjs`, unificare normalizer con `customImport.cjs`. Aggiungere unit test. **Rischio**: basso.
- **realtime.cjs** (`:3`): il router ha **13** tipi messaggio (non 16) e il chat broadcast NON ne fa parte. Estrarre `RuntimeContext` con le map mutabili (preservare identita'); primo step alto-valore: helper `parseMessageFields`/payload-shaping + dispatch table `type->handler`. **Rischio**: medio.

### 4.10 [LOW-MEDIUM] Violazioni SSOT/DRY puntuali (quasi tutte basso rischio)

| # | Problema | File:line | Fix | Rischio |
|---|----------|-----------|-----|---------|
| a | `SYSTEM_LAYER_IDS` triplicato | PlanView.tsx:206, useDataStore.ts:496, dataStoreNormalization.ts:36 | estrarre in `src/store/data.ts` e importare. Per `normalizePlan` (duplicato e drifted) riconciliare deliberatamente, NON switchare alla versione dataStoreNormalization (alterebbe runtime) | basso |
| b | Helper geometria duplicati in 3 modali | EscapeRouteModal.tsx:125, InternalMapModal.tsx, RoomAllocationModal.tsx | creare `planGeometry.ts` canonico; **riconciliare divergenze** (empty-guard pointInPolygon, tolleranza pointOnPolygonBoundary 1.25 vs 1.8, return centroid vuoto) prima di sostituire | medio |
| c | Handler AI-transform duplicato (~150 righe) | meetingNotes.cjs:343 e :499 | estrarre `runNotesAiTransform({req,res,client,usageScopeId,auditEventPrefix,auditDetailsExtra})` | basso |
| d | Destructuring deps duplicato in 5 import route | imports/webapiRoutes.cjs:1-54 (+4) | ridurre ogni destructure ai soli nomi usati | basso |
| e | Logica lock-acquisition duplicata join/request_lock | realtime.cjs:546 | estrarre `buildGrantPayload`, `buildLockStatePayload`, `tryAcquireLock`. NON collassare renew_lock | basso |
| f | AES-256-GCM duplicato divergente | configStore.cjs:3 / mfa.cjs | estrarre `secretCrypto.cjs` (key derivation + cipher), MA mantenere 2 adapter di serializzazione/error (formato on-disk vincolato) | medio |
| g | Branch verifica password identici | users.cjs:832-842 | collassare in `if ((!requesterIsAdmin \|\| isSelf) && (!oldPassword \|\| !verify...))` | basso |
| h | Render export DM/client duplicato (~120 righe) | chat.cjs:886 | estrarre `renderChatTimestamp`/`renderMessageHtmlItem`/`renderChatHtmlDocument`/`renderChatTxtLines` | basso |
| i | Aggregazione unread duplicata x3 | chat.cjs:51 | estrarre `getLastReadAtByClient`/`getClientUnreadCounts`/`getDmUnreadByPair` in services/chat.cjs | basso |
| j | normalize/compare duplicato imports/customImport (changed-detection x3) | imports.cjs:299-317 | estrarre `EXTERNAL_USER_DIFF_FIELDS`+`diffExternalUser` (e device) condivisi | medio |
| k | Plan-tree traversal duplicato | dataRoutes.cjs:35 vs permissions.cjs | modulo `planTree` (forEachPlan/buildPlanIndex/findPlan/mapPlans) con guardie optional-chaining uniformi | basso |
| l | Boilerplate npm/last-check maintenance | index.cjs:1236/1333 | `readLastCheck`, `trimOutput`, costanti `NPM_CMD`/`NPM_EXEC_OPTS`. NON mergiare i POST | basso |
| m | normalizer divergenti useDataStore/dataStoreNormalization | useDataStore.ts:518 | eliminare gli export morti diverged da dataStoreNormalization.ts, NON portare la logica stale nello store | medio |
| n | catalogo default layer triplicato | data.ts:316, useDataStore.ts:477, dataStoreNormalization.ts:381 | DEFAULT_LAYERS canonico in data.ts; eliminare la copia morta in dataStoreNormalization | medio |
| o | hydrate()/login() wiring duplicato | useAuthStore.ts:43 | estrarre `applyAuthenticatedSession(me)` | basso |
| p | customImport.ts (1031 righe) ~50 export | src/api/customImport.ts | split domain MA mantenere barrel re-export per non rompere 7 importer; helper generico user/device opzionale | medio |
| q | error-handling boilerplate ~20 moduli api | chat.ts:27-31 | `requestJson<T>`/`requestBlob` in client.ts con `ApiError`; lasciare opt-in i casi divergenti (auth lockout, fetchBootstrapStatus) | medio |
| r | `clamp` implementato 3+ volte | geometry.ts:1 vs pdf.ts:57 (+CapacityGauge/ImageNode/CableModal/useClipboard) | importare da geometry.ts, rimuovere locali | basso |
| s | helper download-blob/clipboard duplicati | BackupPanel.tsx:22, NerdAreaPanel.tsx:139/149, ClientDevicesImportPanel ~906 | `downloadBlob`/`downloadText`/`copyToClipboard` in `src/utils/files.ts`. NON fondere fetchAsDataUrl con readFileAsDataUrl | basso |

---

## 5. Codice morto / naming / struttura / performance

### Codice morto (tutti basso rischio salvo nota)
- **[LOW] `RichTextEditor.tsx` (1155 righe) interamente morto + sink XSS link non sanificato** — `src/components/ui/RichTextEditor.tsx:1`. Nessun importer (l'editor attivo e' LexicalNotesEditor). `applyLinkPrompt/exec('createLink')` non valida lo schema (`javascript:` possibile); `innerHTML = value` non sanificato. **Fix**: eliminare il file (dopo `grep -rn "RichTextEditor" .` finale). Rischio: basso.
- **[LOW] Export normalizer morti** — `dataStoreNormalization.ts:243` (normalizePlan/normalizeClientLayers/normalizeSiteSchedule/...): mai importati (solo useDataStore importa, e usa copie locali). **Fix**: eliminarli. Rischio: basso.
- **[LOW] Branch morto in `getEffectiveVisibleLayerIds`** — `src/utils/layerVisibility.ts:43`: entrambi i rami ritornano `nonAllLayerIds`. **Fix**: collassare in `return nonAllLayerIds;`; considerare rimozione dell'export (nessun caller). Rischio: basso.
- **[LOW] Import destructurati inutilizzati** — `server/routes/meetings.cjs:13`: `broadcastMeetingPendingSummary`, `normalizeMeetingAdminIds` non usati. **Fix**: rimuoverli dal destructuring. Rischio: basso.

### Naming/struttura
- **[LOW] Import `apiFetch` in fondo al file** — `src/api/auth.ts:304` (+ nerd.ts:153, email.ts:159, objectTypeRequests.ts:81, audit.ts:79, customFields.ts:79, mfa.ts:37). **Fix**: spostare l'import in cima (no-op runtime, gli import sono hoisted). NON aggiungere regola ESLint (il repo non ha config ESLint; `lint` = `tsc --noEmit`). Rischio: basso.

### Performance
- **[MEDIUM] NerdAreaPanel: selettore Zustand v5 che ritorna oggetto senza `useShallow`** — `src/components/settings/NerdAreaPanel.tsx:97`. Re-render a ogni mutazione dello store + warning getSnapshot. **Fix**: selettori atomici (primitivi/funzioni stabili) o `useShallow`. **Stesso fix** ai call site che passano `shallow` come secondo argomento inefficace sotto v5: App.tsx:113, UserMenu.tsx:22, HelpPanel.tsx:16, ChangelogPanel.tsx:11, ClientChatDock.tsx:249. Rischio: basso.
- **[MEDIUM] Aggregazione unread/overview DM: N+1 + full-scan per richiesta** — `server/routes/chat.cjs:125`. Loop per-client di `clientUnreadStmt`, 4 full-scan `dm_chat_messages`, load di TUTTI gli utenti + per-utente `getChatClientIdsForUser` + `getLatestVisibleDmChatMessage`. **Fix**: query singola join per client unread; derivare il candidate set da dmHistory+common-client invece dello scan all-users; query windowed batch per latest-DM; bulk permissions query; cache breve/`rateByUser` su endpoint di polling. Rischio: medio (preservare semantica `isMessageHiddenForUser`/block in JS).
- **[LOW] Export chat senza LIMIT** — `server/routes/chat.cjs:870` (+948). Carica l'intero thread in memoria, nessun rate limiter. **Fix**: `rateByUser('chat_export', 60000, 10)` + `LIMIT 50000` (DESC+reverse se i recenti contano), documentare il troncamento. Rischio: basso.
- **[LOW] `computePresence`/`computeGlobalPresence`/`getLockedPlansSnapshot` ricostruiscono `buildPlanPathMap` a ogni evento** — `server/realtime.cjs:134`. Un singolo `emitLockState` ricostruisce la mappa 3+ volte; O(N broadcast) + full-scan per evento. **Fix**: cache module-level keyed su `state.updatedAt` (come `getClientScopeMaps` in index.cjs); `getPlanPathMap()` sostituisce le chiamate inline a 167-168/207-208/247-248/300-301/518-519/734-735/907-908/1061-1062. Rischio: basso.
- **[LOW] `filteredStateCache` Map illimitata tra le scritture** — `server/routes/dataRoutes.cjs:384`. Solo `.clear()` su writeState, nessun max-size (a differenza di `planAccessCacheByKey`). **Fix**: cap FIFO `MAX_FILTERED_STATE_CACHE_ENTRIES = 200` (NO TTL, ridondante perche' la key include `updatedAt`). Rischio: basso.
- **[LOW] `floorMetrics.sort` dentro il loop per-plan** — `src/utils/capacityMetrics.ts:270`. Sort O(n^2 log n) ridondante col sort post-loop (298). **Fix**: eliminare la riga 270. Rischio: basso.

### Manutenibilita' schema (low)
- **[LOW] Schema definito due volte (CREATE inline in openDb + migrazioni)** — `server/db.cjs:700`. Doppia source of truth (es. migration 24 crea UNIQUE index su meetingNumber assente nel CREATE inline). **Fix**: NON ristrutturare il bootstrap (rischioso/inutile, fresh e upgraded convergono). Aggiungere un check di consistenza non-fatale dopo `runMigrations()` (`PRAGMA table_info`/`index_list` vs set atteso, warning su differenze). NON gateare le migrazioni dietro schemaVersion (creerebbe la divergenza temuta). Rischio: medio.

---

## 6. Piano di implementazione consigliato

### FASE 1 — Quick win sicurezza (basso rischio, fare subito)
Tutti i fix sotto sono additivi/localizzati e non cambiano il path di successo:
1. **WS tokenVersion** (auth.cjs:126) — chiude la revoca sessione su WS. [2.1]
2. **Rate limiting endpoint meeting pubblici** (meetingPublic.cjs:464/524/562). [2.2]
3. **SSRF curl `--resolve`** o rimozione fallback (network.cjs:409-466). [2.3]
4. **Redazione IP nella presence** (realtime.cjs:285/233/192). [2.4]
5. **XSS PDF clientLabel** via DOM/escape (pdf.ts:1267). [2.5]
6. **CSV formula injection** (logRetention.cjs:35). [2.7]
7. **CSRF timingSafeEqual** (index.cjs:362). [2.11]
8. **Session iat max-age** (auth.cjs:62 / requireAuth / getWsAuthContext). [2.12]
9. **getWsClientIp trust-proxy** (index.cjs:1187). [2.10]
10. **checkin-toggle validazione entryKey** (meetingPublic.cjs:524). [2.13]
11. **Guardie admin** PUT/DELETE users (users.cjs:700-808). [2.8] e self-guard [3.12]

### FASE 2 — Quick win bug/correttezza (basso rischio)
12. **MFA decryptSecret try/catch** (mfa.cjs:18). [3.2]
13. **Meeting autonomous-create: no early return** (meetingLifecycle.cjs:267). [3.4]
14. **BackupPanel: rimuovere setClients raw** (BackupPanel.tsx:548). [3.8]
15. **stripHtml ordine entita'** (MeetingNotesModal.tsx:51). [3.9]
16. **parseDateOnly round-trip** (ObjectModal.tsx:146). [3.7]
17. **ImageNode pointercancel** (ImageNode.tsx:88). [3.11]
18. **encodeURIComponent** path ID api (auth/objectTypeRequests/customFields). [3.6]
19. **escapeXml control char** (BackupPanel.tsx:44). [3.16]
20. **LIKE wildcard escape** (email.cjs:200). [3.14]
21. **Export chat: filtro hidden + LIMIT + rate limit** (chat.cjs:870/948). [3.13] [4.9 chat / perf]
22. **Rimuovere `unlimitedRooms`** (capacityMetrics.ts:195) e **sort ridondante** (270). [3.10]

### FASE 3 — Quick win performance + DRY/SSOT a basso rischio
23. **Zustand selettori atomici** (NerdAreaPanel + 5 call site). [5/perf]
24. **planPathMap cache** (realtime.cjs:134). [5/perf]
25. **filteredStateCache cap** (dataRoutes.cjs:384). [5/perf]
26. **SYSTEM_LAYER_IDS** in data.ts; **DEFAULT_LAYERS** canonico; **eliminare normalizer/layer morti** in dataStoreNormalization. [4.10 a/m/n, 5 dead-code]
27. **clamp/download/copy/import-deps/lock-helpers/AI-transform/chat-render/unread-aggregation/applyAuthenticatedSession** — le voci DRY a basso rischio della tabella 4.10 (c, d, e, g, h, i, o, r, s). [4.10]
28. **Eliminare RichTextEditor.tsx morto**, branch morto layerVisibility, import meetings.cjs inutilizzati, import apiFetch in cima. [5 dead-code/naming]

### FASE 4 — Refactoring medi (richiedono conferma + test)
- WS realtime resilience/lock fail-safe (PlanView.tsx:3615). [3.1]
- DM offline delivery su REST (chat.cjs:600). [3.3]
- object-type-request riordino atomicita' + rate limit (objectTypeRequests.cjs:109). [3.5]
- sanitizeHtmlBasic -> allowlist/DOMPurify (sanitizeHtml.ts). [2.9]
- secretCrypto.cjs condiviso (configStore/mfa). [4.10 f]
- AES/diff fields condivisi, planTree, ipaddr.js IPv6, force_unlock audit, WS message rate-limit, overview DM N+1, culling AABB, schema consistency check, encodeURI. [vari medi]
- Split god-file backend a basso/medio rischio: dataRoutes.cjs, imports.cjs, chat.cjs, realtime.cjs (dispatch table), index.cjs (maintenance routes). [4.9]

### FASE 5 — Grandi decomposizioni (alto rischio, una slice/PR, smoke test tra step)
- **PlanView.tsx** (22k) — partire da `<PlanModals>`, poi risolvere exhaustive-deps, poi hook bottom-up. [4.1]
- **CanvasStage.tsx** (7k) — geometria -> RAF -> layer leaf -> CanvasObject. [4.2]
- **SidebarTree.tsx** (4.5k) — helper puri -> ClientMeetingsTimelineModal -> ClientModalsHost. [4.3]
- **MobileAppPage.tsx** (3.4k) — useSessionCache/useMobileViewportLock -> tab subcomponent. [4.4]
- **ClientChatDock.tsx** (4k) — preservare replyToIdRef. [4.5]
- **MeetingNotesModal.tsx** / **InternalMapModal.tsx** / **ObjectTypesPanel.tsx** / **SafetyPanel.tsx**+**ClientDevicesImportPanel.tsx** / **useDataStore.ts** / **customImport.ts** / **pdf.ts**. [4.6, 4.7, 4.8, 4.10 p]

**Nota trasversale**: prima delle decomposizioni dei file frontend, aggiungere/eseguire smoke test sui flussi piu' sensibili (timeline meeting, modali client, PDF export, lock collaborativo, chat send/read), poiche' il repo ha copertura test limitata e i bug attesi sono di stale-closure/effect-ordering.