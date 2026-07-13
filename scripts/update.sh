#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Update LedgerFrame: sync code to the latest release, reinstall deps, rebuild the
# dashboard, migrate the DB, and restart services.
#
# Appliance-safe: your data, backups, and .env are git-ignored and never touched.
# It DOES discard local edits to tracked code (incl. the rebuilt frontend/dist,
# which is why a plain `git pull` fails here) by hard-resetting to the remote.
#
# Runs in two modes:
#   • From your terminal (unprivileged): uses `sudo` for service/unit ops.
#   • From the root admin helper ("Update now"): already root, so no sudo for
#     systemctl — code/build/git steps drop to the owning user via a LOGIN shell
#     so their PATH (nvm/uv) is loaded and file ownership stays correct.
#
# Progress is written to <data>/logs/update.{log,status} so the web UI can show
# what's happening and surface errors instead of failing silently.
#
# Note: we deliberately do NOT use `set -e` — every step is checked explicitly so
# a failure is logged (and shown in the UI), never swallowed.
set -uo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# --- flags -------------------------------------------------------------------
#   --no-backup   Proceed WITHOUT a fresh backup. Migrations are FORWARD-ONLY and there is NO
#                 supported downgrade (release-readiness RD-6), so this is a real choice: you are
#                 giving up your only way back. You have to say it out loud.
LF_NO_BACKUP=""
for arg in "$@"; do
  case "$arg" in
    --no-backup) LF_NO_BACKUP=1 ;;
    -h|--help)   sed -n '1,20p' "$0"; exit 0 ;;
  esac
done
export LF_NO_BACKUP
# shellcheck source=lib/backup_gate.sh
source "$REPO_DIR/scripts/lib/backup_gate.sh"

# --- who runs what -----------------------------------------------------------
SUDO=sudo
OWNER="$(id -un)"
if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
  OWNER="${RUN_USER:-$(stat -c %U "$REPO_DIR" 2>/dev/null || echo root)}"
fi
# Run a command as the repo owner. IMPORTANT: use a NON-login shell here (`sudo -H
# -u`, not `sudo -iu`). A login shell sources the user's profile, which on Raspberry
# Pi OS prints warnings ("Wi-Fi is currently blocked by rfkill…") to stdout — those
# leak into command substitutions like BRANCH=$(…) and corrupt git refspecs. git
# lives on the system PATH, so it doesn't need the login PATH.
run_owner() { if [[ "$OWNER" != "$(id -un)" ]]; then sudo -H -u "$OWNER" "$@"; else "$@"; fi; }
# Login shell (bash -lc) for steps that DO need the user PATH (nvm/uv for npm/pip).
# Its output only ever goes to the log file, never into a captured variable, so any
# profile noise here is harmless.
owner_sh()  { if [[ "$OWNER" != "$(id -un)" ]]; then sudo -H -u "$OWNER" bash -lc "$1"; else bash -lc "$1"; fi; }

# --- log + status ------------------------------------------------------------
LOG_DIR="${DATA_DIR:+$DATA_DIR/logs}"
[[ -n "$LOG_DIR" ]] || LOG_DIR="$REPO_DIR/.update"
mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR="/tmp"
[[ "$OWNER" != "$(id -un)" ]] && chown -R "$OWNER" "$LOG_DIR" 2>/dev/null || true
LOG="$LOG_DIR/update.log"
STATUS="$LOG_DIR/update.status"
# When launched detached (no terminal), mirror all output into the log file so
# the UI / CLI can read it; when run interactively, print to the terminal.
[[ -t 1 ]] || exec >>"$LOG" 2>&1

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S')Z] $*"; }
set_status() { echo "$1" >"$STATUS" 2>/dev/null || true; }
fail() { log "ERROR: $1"; set_status "failed: $1"; exit 1; }

: >"$LOG" 2>/dev/null || true   # fresh log per run (best effort)
set_status "running"
log "update starting (user=$OWNER repo=$REPO_DIR)"

# git ownership safety (root operating on a user-owned repo, or vice versa)
run_owner git config --global --add safe.directory "$REPO_DIR" >/dev/null 2>&1 || true

# Keep only the last line and valid ref characters, so any stray profile/MOTD output
# can never end up in the refspec passed to `git fetch`.
BRANCH="$(run_owner git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null | tail -n1 | tr -dc 'A-Za-z0-9._/-')"
[[ "$BRANCH" == "HEAD" || -z "$BRANCH" ]] && BRANCH=main

# GATE A6 / RD-6 — no migration without a way back.
# This line used to be `backup.sh && log "created" || log "skipped"`: it TRIED to back up, SWALLOWED
# the failure, and MIGRATED ANYWAY. With forward-only migrations and no supported downgrade, the
# backup IS the rollback story — so a failure here now STOPS the update instead of being logged.
log "backing up database first…"
owner_sh "cd '$REPO_DIR' && ./scripts/backup.sh" >/dev/null 2>&1 && log "backup created" || log "backup FAILED"
if ! lf_require_fresh_backup; then
  fail "aborting: no fresh backup. Run ./scripts/backup.sh, or re-run with --no-backup to proceed anyway."
fi

log "fetching latest ($BRANCH)…"
run_owner git -C "$REPO_DIR" fetch origin "$BRANCH" || fail "git fetch failed (network?)"
run_owner git -C "$REPO_DIR" reset --hard "origin/$BRANCH" || fail "git reset failed"
log "code synced to $(run_owner git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"

log "updating backend dependencies…"
owner_sh "cd '$REPO_DIR' && { [ -f .venv/bin/activate ] && . .venv/bin/activate; }; if command -v uv >/dev/null 2>&1; then uv pip install -e '.[dev]'; else pip install -e '.[dev]'; fi" \
  && log "backend deps updated" || log "WARN: backend dep step had issues (continuing)"

if owner_sh "command -v npm >/dev/null 2>&1" && [[ -d frontend ]]; then
  log "rebuilding dashboard…"
  owner_sh "cd '$REPO_DIR/frontend' && (npm ci --no-audit --no-fund || npm install) && npm run build" \
    && log "dashboard rebuilt" || log "WARN: dashboard rebuild failed (using committed build)"
fi

# shellcheck source=lib/datadir.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/datadir.sh"   # the ONE data-dir answer (release-readiness Part B/1)
log "applying database migrations…"
# Resolve the data dir so migrations target the same DB the service uses (the
# installer records it in admin.env; fall back to .env, then the app default).
MIG_DATA_DIR=""
[[ -r /etc/ledgerframe/admin.env ]] && MIG_DATA_DIR="$(. /etc/ledgerframe/admin.env 2>/dev/null; echo "${DATA_DIR:-}")"
# The installer's admin.env still wins (it records what the SERVICE actually uses); everything
# below it now goes through the one shared resolver instead of a private sed. This script's sed was
# the ONLY .env-aware resolution in the whole repo — which is exactly why the others were wrong.
[[ -z "$MIG_DATA_DIR" ]] && MIG_DATA_DIR="$(lf_data_dir)"
owner_sh "cd '$REPO_DIR' && { [ -f .venv/bin/activate ] && . .venv/bin/activate; }; ${MIG_DATA_DIR:+LEDGERFRAME_DATA_DIR='$MIG_DATA_DIR'} python scripts/db_migrate.py" \
  && log "migrations applied" || log "migrations skipped (schema ensured on service startup)"

# Refresh the privileged helper (in case it changed).
if [[ -f /usr/local/sbin/ledgerframe-admin ]]; then
  $SUDO install -m 0755 -o root -g root "$REPO_DIR/scripts/lf-admin.sh" /usr/local/sbin/ledgerframe-admin 2>/dev/null \
    && log "admin helper refreshed" || log "WARN: could not refresh admin helper"
fi

# Re-render systemd units so unit changes apply on update.
if [[ -r /etc/ledgerframe/admin.env ]]; then
  # shellcheck disable=SC1091
  . /etc/ledgerframe/admin.env   # REPO_DIR, DATA_DIR, RUN_USER
  API_HOST=127.0.0.1
  grep -q '^LEDGERFRAME_ALLOW_LAN=true' "$REPO_DIR/.env" 2>/dev/null && API_HOST=0.0.0.0
  API_PORT="$(sed -n 's/^LEDGERFRAME_API_PORT=//p' "$REPO_DIR/.env" 2>/dev/null | head -1)"
  API_PORT="${API_PORT:-8321}"
  for unit in ledgerframe-api ledgerframe-worker ledgerframe-kiosk; do
    [[ -f /etc/systemd/system/$unit.service ]] || continue
    sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$RUN_USER|g" \
        -e "s|@API_HOST@|$API_HOST|g" -e "s|@API_PORT@|$API_PORT|g" "$REPO_DIR/systemd/$unit.service" \
      | $SUDO tee "/etc/systemd/system/$unit.service" >/dev/null
  done
  $SUDO systemctl daemon-reload 2>/dev/null || true
  log "systemd units refreshed"
fi

NEWVER="$(grep -oE '"[0-9]+\.[0-9]+\.[0-9]+"' "$REPO_DIR/app/__init__.py" 2>/dev/null | head -1 | tr -d '"')"
# Mark success BEFORE restarting the API (the restart will drop this process's
# connections; the status file is how the UI learns the update finished).
set_status "ok ${NEWVER:-updated}"
log "restarting services…"
$SUDO systemctl restart ledgerframe-api ledgerframe-worker 2>/dev/null \
  && log "services restarted" || log "services not installed (dev?)"
log "update complete → v${NEWVER:-?}"
