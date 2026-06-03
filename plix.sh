#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PLIX_PORT:-8787}"
HOST="${PLIX_HOST:-localhost}"
SERVICE_URL="${PLIX_URL:-http://${HOST}:${PORT}}"
SERVICE_URL="${SERVICE_URL%/}"
SERVICE_ORIGIN="$(printf '%s' "$SERVICE_URL" | sed -E 's#^(https?://[^/]+).*$#\1#')"
SERVICE_TARGET="${SERVICE_ORIGIN#*://}"
LOG_FILE="${PLIX_LOG_FILE:-$PROJECT_DIR/plix.log}"
START_CMD="${PLIX_START_CMD:-npm start}"
BUILD_CMD="${PLIX_BUILD_CMD:-npm run build}"
START_TIMEOUT="${PLIX_START_TIMEOUT:-60}"
STOP_TIMEOUT="${PLIX_STOP_TIMEOUT:-20}"
LAST_MATCHED_URL=""

log() {
  printf '[plix] %s\n' "$*"
}

die() {
  printf '[plix] Errore: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Uso: ./plix.sh <start|stop|restart|release|status>

Comandi:
  start    Avvia Plixmap in background e apre la pagina in Chrome
  stop     Chiude le tab Chrome del servizio e ferma il processo sulla porta $PORT
  restart  Esegue stop + start
  release  Esegue stop + build + start
  status   Mostra se la porta $PORT e occupata

Variabili opzionali:
  PLIX_PORT=$PORT
  PLIX_HOST=$HOST
  PLIX_URL=$SERVICE_URL
  PLIX_START_CMD=$START_CMD
  PLIX_BUILD_CMD=$BUILD_CMD
  PLIX_LOG_FILE=$LOG_FILE
EOF
}

pids_on_port() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk '!seen[$0]++'
}

is_listening() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_port_down() {
  local attempt
  for ((attempt = 1; attempt <= STOP_TIMEOUT; attempt++)); do
    if ! is_listening; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_service_up() {
  local attempt
  for ((attempt = 1; attempt <= START_TIMEOUT; attempt++)); do
    if curl -fsS --max-time 2 "$SERVICE_ORIGIN/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

close_chrome_tabs() {
  LAST_MATCHED_URL=""

  if [[ "$(uname -s)" != "Darwin" ]]; then
    log "Chiusura tab Chrome saltata: script pensato per macOS."
    return 0
  fi

  if ! osascript -e 'id of app "Google Chrome"' >/dev/null 2>&1; then
    log "Google Chrome non trovato, salto chiusura tab."
    return 0
  fi

  local result=""
  if ! result="$(
    osascript - "$SERVICE_TARGET" "$PORT" <<'APPLESCRIPT'
on run argv
  set primaryTarget to item 1 of argv
  set portNumber to item 2 of argv
  set firstMatch to ""

  if application "Google Chrome" is not running then
    return firstMatch
  end if

  tell application "Google Chrome"
    repeat with w from (count of windows) to 1 by -1
      repeat with t from (count of tabs of window w) to 1 by -1
        set tabUrl to URL of tab t of window w
        if my matchesPlixmap(tabUrl, primaryTarget, portNumber) then
          if firstMatch is "" then set firstMatch to tabUrl
          close (tab t of window w)
        end if
      end repeat
    end repeat
  end tell

  return firstMatch
end run

on matchesPlixmap(tabUrl, primaryTarget, portNumber)
  if tabUrl is missing value then return false
  set normalizedUrl to tabUrl as text
  if normalizedUrl does not start with "http://" and normalizedUrl does not start with "https://" then return false
  if normalizedUrl contains primaryTarget then return true
  if normalizedUrl contains ("localhost:" & portNumber) then return true
  if normalizedUrl contains ("127.0.0.1:" & portNumber) then return true
  return false
end matchesPlixmap
APPLESCRIPT
  )"; then
    log "Impossibile gestire Chrome via AppleScript. Controlla i permessi Automazione."
    return 0
  fi

  LAST_MATCHED_URL="${result//$'\r'/}"
  if [[ -n "$LAST_MATCHED_URL" ]]; then
    log "Tab Chrome chiuse: $LAST_MATCHED_URL"
  else
    log "Nessuna tab Chrome aperta sul servizio."
  fi
}

open_service_url() {
  local target_url="${1:-$SERVICE_URL}"

  if [[ "$(uname -s)" != "Darwin" ]]; then
    log "Apertura browser saltata: script pensato per macOS."
    return 0
  fi

  if open -a "Google Chrome" "$target_url" >/dev/null 2>&1; then
    log "Pagina aperta in Chrome: $target_url"
    return 0
  fi

  if open "$target_url" >/dev/null 2>&1; then
    log "Pagina aperta col browser di default: $target_url"
    return 0
  fi

  log "Impossibile aprire automaticamente $target_url"
}

stop_service() {
  close_chrome_tabs

  local pids=()
  local pid
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(pids_on_port || true)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    log "Nessun processo in ascolto sulla porta $PORT."
    return 0
  fi

  log "Stop del servizio sulla porta $PORT (PID: ${pids[*]})"
  kill "${pids[@]}" 2>/dev/null || true

  if wait_for_port_down; then
    log "Servizio fermato."
    return 0
  fi

  pids=()
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(pids_on_port || true)
  if [[ "${#pids[@]}" -gt 0 ]]; then
    log "Il processo non si e fermato in tempo, forzo la chiusura."
    kill -9 "${pids[@]}" 2>/dev/null || true
  fi

  if wait_for_port_down; then
    log "Servizio fermato."
    return 0
  fi

  die "Impossibile liberare la porta $PORT."
}

start_service() {
  local reopen_url="${1:-$SERVICE_URL}"

  if is_listening; then
    log "La porta $PORT e gia in ascolto. Nessun riavvio eseguito."
    open_service_url "$reopen_url"
    return 0
  fi

  local quoted_project_dir
  quoted_project_dir="$(printf '%q' "$PROJECT_DIR")"

  log "Avvio Plixmap con: $START_CMD"
  nohup bash -lc "cd $quoted_project_dir && exec $START_CMD" >>"$LOG_FILE" 2>&1 &

  if wait_for_service_up; then
    log "Servizio disponibile su $SERVICE_ORIGIN"
    open_service_url "$reopen_url"
    return 0
  fi

  log "Avvio non confermato entro ${START_TIMEOUT}s. Ultime righe di log:"
  tail -n 20 "$LOG_FILE" 2>/dev/null || true
  die "Il servizio non risponde su $SERVICE_ORIGIN"
}

build_release() {
  log "Build release con: $BUILD_CMD"
  (
    cd "$PROJECT_DIR"
    eval "$BUILD_CMD"
  )
  log "Build completata."
}

status_service() {
  local pids=()
  local pid
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(pids_on_port || true)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    log "OFFLINE: nessun processo sulla porta $PORT"
    return 1
  fi

  log "ONLINE: porta $PORT occupata dai PID ${pids[*]}"
  log "URL servizio: $SERVICE_ORIGIN"
  return 0
}

command="${1:-restart}"

case "$command" in
  start)
    start_service "$SERVICE_URL"
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    start_service "${LAST_MATCHED_URL:-$SERVICE_URL}"
    ;;
  release)
    stop_service
    build_release
    start_service "${LAST_MATCHED_URL:-$SERVICE_URL}"
    ;;
  status)
    status_service
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
