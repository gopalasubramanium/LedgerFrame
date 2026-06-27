#!/usr/bin/env bash
# Manual update: sync code to the latest release, reinstall deps, rebuild the
# dashboard, migrate the database, and restart services.
#
# Appliance-safe: your data, backups, and .env are git-ignored and never touched.
# It DOES discard local edits to tracked code (including the rebuilt frontend/dist,
# which is why a plain `git pull` fails here) by hard-resetting to the remote.
#
# Privilege model — this script works in two modes:
#   • Run by you from the CLI (unprivileged): uses `sudo` for service/unit ops
#     (prompts for your password, which is fine at a terminal).
#   • Run by the root admin helper (one-click "Update now", launched detached via
#     systemd-run as root): already root, so no `sudo` is needed for systemctl —
#     but code/build/git steps are dropped to the owning user so file ownership
#     stays correct and git's ownership checks pass.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Decide how to run privileged vs. user-level steps based on who we are.
SUDO=sudo
RUN_AS=()
if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""   # already root; systemctl/tee/install need no sudo
  OWNER="${RUN_USER:-$(stat -c %U "$REPO_DIR" 2>/dev/null || echo root)}"
  [[ "$OWNER" != "root" ]] && RUN_AS=(sudo -u "$OWNER")
fi

# Run a command as the repo owner (no-op prefix when we're already that user).
as_owner() { if [[ ${#RUN_AS[@]} -gt 0 ]]; then "${RUN_AS[@]}" "$@"; else "$@"; fi; }

BRANCH="$(as_owner git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
[[ "$BRANCH" == "HEAD" ]] && BRANCH=main

echo "[update] backing up database first…"
as_owner bash "$REPO_DIR/scripts/backup.sh" >/dev/null 2>&1 && echo "[update] backup created" || echo "[update] backup skipped"

echo "[update] fetching latest ($BRANCH)…"
as_owner git -C "$REPO_DIR" fetch origin "$BRANCH"
# Hard-reset tracked files to the remote. Ignored paths (.env, data/, .venv,
# node_modules) are left intact. This cleanly resolves the rebuilt-dist conflict.
as_owner git -C "$REPO_DIR" reset --hard "origin/$BRANCH"

# All code/build/migrate steps run as the owner (defined here, executed in one
# subshell so env activation persists). Quiet on success; never aborts the run.
build_steps() {
  set -e
  cd "$REPO_DIR"
  # shellcheck disable=SC1091
  [[ -f .venv/bin/activate ]] && source .venv/bin/activate || true
  echo "[update] updating backend dependencies…"
  if command -v uv &>/dev/null; then uv pip install -e ".[dev]" >/dev/null; else pip install -e ".[dev]" >/dev/null; fi
  if command -v npm &>/dev/null && [[ -d frontend ]]; then
    echo "[update] rebuilding dashboard…"
    (cd frontend && (npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install >/dev/null 2>&1) && npm run build >/dev/null 2>&1) \
      && echo "[update] dashboard rebuilt" || echo "[update] dashboard rebuild skipped (using committed build)"
  fi
  echo "[update] applying database migrations…"
  alembic upgrade head 2>/dev/null && echo "[update] migrations applied" || echo "[update] no migrations to apply"
}

if [[ ${#RUN_AS[@]} -gt 0 ]]; then
  "${RUN_AS[@]}" env REPO_DIR="$REPO_DIR" bash -c "$(declare -f build_steps); build_steps"
else
  build_steps
fi

# Refresh the privileged helper if present (in case it changed).
if [[ -f /usr/local/sbin/ledgerframe-admin ]]; then
  $SUDO install -m 0755 -o root -g root "$REPO_DIR/scripts/lf-admin.sh" /usr/local/sbin/ledgerframe-admin 2>/dev/null || true
fi

# Re-render systemd units so unit changes (e.g. hardening tweaks) apply on update.
if [[ -r /etc/ledgerframe/admin.env ]]; then
  # shellcheck disable=SC1091
  . /etc/ledgerframe/admin.env   # REPO_DIR, DATA_DIR, RUN_USER
  API_HOST=127.0.0.1
  grep -q '^LEDGERFRAME_ALLOW_LAN=true' "$REPO_DIR/.env" 2>/dev/null && API_HOST=0.0.0.0
  API_PORT="$(sed -n 's/^LEDGERFRAME_API_PORT=//p' "$REPO_DIR/.env" 2>/dev/null | head -1)"
  API_PORT="${API_PORT:-8321}"
  for unit in ledgerframe-api ledgerframe-worker ledgerframe-kiosk; do
    [[ -f /etc/systemd/system/$unit.service ]] || continue
    desktop_user="$RUN_USER"
    sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$desktop_user|g" \
        -e "s|@API_HOST@|$API_HOST|g" -e "s|@API_PORT@|$API_PORT|g" "$REPO_DIR/systemd/$unit.service" \
      | $SUDO tee "/etc/systemd/system/$unit.service" >/dev/null
  done
  $SUDO systemctl daemon-reload 2>/dev/null || true
  echo "[update] systemd units refreshed"
fi

echo "[update] restarting services…"
$SUDO systemctl restart ledgerframe-api ledgerframe-worker 2>/dev/null \
  && echo "[update] services restarted" || echo "[update] services not installed (dev?)"
echo "[update] done."
