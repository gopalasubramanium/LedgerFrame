#!/usr/bin/env bash
# scripts/dev.sh — the one command to run LedgerFrame in development.
#
# Starts the backend (uvicorn on 127.0.0.1:8321) and the frontend (Vite) together
# with prefixed logs; Ctrl+C stops both. On first run it creates a dev-appropriate
# .env from .env.example (a local data dir under your home + a generated strong
# SECRET_KEY) and says so. It NEVER touches the appliance data dir (/mnt/...);
# real deployments keep their own .env unchanged.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/datadir.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/datadir.sh"   # the ONE data-dir answer (release-readiness Part B/1)
DEV_DATA="${LEDGERFRAME_DEV_DATA_DIR:-$HOME/.local/share/ledgerframe-dev}"

# 1) First run: create a dev .env with safe local defaults (never /mnt).
if [ ! -f .env ]; then
  echo "[dev] no .env found — creating one from .env.example with dev defaults"
  cp .env.example .env
  SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  python3 - "$DEV_DATA" "$SECRET" <<'PY'
import pathlib, re, sys
data_dir, secret = sys.argv[1], sys.argv[2]
p = pathlib.Path(".env"); t = p.read_text()
def setkey(t, k, v):
    if re.search(rf'^{k}=', t, re.M):
        return re.sub(rf'^{k}=.*$', f'{k}={v}', t, flags=re.M)
    return t.rstrip("\n") + f"\n{k}={v}\n"
t = setkey(t, "LEDGERFRAME_DATA_DIR", data_dir)
t = setkey(t, "LEDGERFRAME_SECRET_KEY", secret)
p.write_text(t)
PY
  echo "[dev] wrote .env — LEDGERFRAME_DATA_DIR=$DEV_DATA (under your home, not /mnt); strong SECRET_KEY generated"
fi

mkdir -p "$DEV_DATA"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "[dev] .venv not found — set it up first:  uv venv .venv && uv pip install -e '.[dev]'" >&2
  exit 1
fi

# 1a) Port pre-check — never silently half-start. If a port is already held, print the owning
#     PID + a one-line kill hint and exit non-zero, so a stale server can't shadow this one.
port_held() {  # $1 = port → echoes PID if held, empty otherwise.
  # Trailing `|| true`: when the port is FREE, grep matches nothing and (under pipefail) the whole
  # pipeline returns non-zero — which, via the `pid="$(port_held …)"` assignment below, would trip
  # `set -e` and abort the script SILENTLY before any server starts. A free port is the normal case,
  # so swallow that non-zero and just echo the empty result.
  ss -ltnpH "sport = :$1" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true
}
blocked=0
for port in 8321 5173; do
  pid="$(port_held "$port")"
  if [ -n "$pid" ]; then
    cmd="$(ps -o comm= -p "$pid" 2>/dev/null || echo '?')"
    echo "[dev] port $port already in use by PID $pid ($cmd)." >&2
    echo "[dev]   kill it:  kill $pid   (or: kill \$(lsof -ti tcp:$port))" >&2
    blocked=1
  fi
done
if [ "$blocked" = 1 ]; then
  echo "[dev] refusing to half-start — free the port(s) above and re-run." >&2
  exit 1
fi

# 2) Start backend + frontend with prefixed logs; Ctrl+C (or any exit) stops both.
PIDS=()
cleanup() {
  echo
  echo "[dev] stopping…"
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  # also reap uvicorn --reload / vite children in our process group
  pkill -P $$ 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# F-8c: backend logs must actually reach the terminal.
#   1. Python block-buffers stdout when it is a PIPE (which it is — we prefix through awk), so
#      output arrived in 4-8KB bursts or, on a killed process, never. PYTHONUNBUFFERED fixes that.
#   2. Print where the rotating log file lives. When the terminal is piped through `tee`, that file
#      is the authoritative record — the owner's F-8 investigation lost hours because nothing said
#      so. (The reason it was EMPTY past startup was the Alembic logging clobber, fixed separately
#      in app/db/migrations/env.py + app/db/migrate.py.)
LOG_FILE="$(.venv/bin/python -c 'from app.core.config import get_settings; print(get_settings().logs_dir / "ledgerframe.log")' 2>/dev/null || echo '?')"
echo "[dev] backend  → http://127.0.0.1:8321   (uvicorn --reload)"
echo "[dev] backend log file → $LOG_FILE"
echo "[dev]   follow it:  tail -f $LOG_FILE"
( PYTHONUNBUFFERED=1 .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8321 --reload 2>&1 \
    | awk '{ print "[backend]  " $0; fflush() }' ) &
PIDS+=($!)

echo "[dev] frontend → http://127.0.0.1:5173   (vite)"
( cd frontend && npm run dev 2>&1 | awk '{ print "[frontend] " $0; fflush() }' ) &
PIDS+=($!)

echo "[dev] both running — press Ctrl+C to stop both."
wait
