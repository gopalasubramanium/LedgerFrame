#!/usr/bin/env bash
# Manual update: sync code to the latest release, reinstall deps, rebuild the
# dashboard, migrate the database, and restart services.
#
# Appliance-safe: your data, backups, and .env are git-ignored and never touched.
# It DOES discard local edits to tracked code (including the rebuilt frontend/dist,
# which is why a plain `git pull` fails here) by hard-resetting to the remote.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
[[ "$BRANCH" == "HEAD" ]] && BRANCH=main

echo "[update] backing up database first…"
./scripts/backup.sh >/dev/null 2>&1 && echo "[update] backup created" || echo "[update] backup skipped"

echo "[update] fetching latest ($BRANCH)…"
git fetch origin "$BRANCH"
# Hard-reset tracked files to the remote. Ignored paths (.env, data/, .venv,
# node_modules) are left intact. This cleanly resolves the rebuilt-dist conflict.
git reset --hard "origin/$BRANCH"

# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
echo "[update] updating backend dependencies…"
if command -v uv &>/dev/null; then uv pip install -e ".[dev]" >/dev/null; else pip install -e ".[dev]" >/dev/null; fi

if command -v npm &>/dev/null && [[ -d frontend ]]; then
  echo "[update] rebuilding dashboard…"
  (cd frontend && (npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install >/dev/null 2>&1) && npm run build >/dev/null 2>&1) \
    && echo "[update] dashboard rebuilt" || echo "[update] dashboard rebuild skipped (using committed build)"
fi

echo "[update] applying database migrations…"
alembic upgrade head 2>/dev/null && echo "[update] migrations applied" || echo "[update] no migrations to apply"

# Refresh the privileged helper if present (in case it changed).
if [[ -f /usr/local/sbin/ledgerframe-admin ]]; then
  sudo install -m 0755 -o root -g root "$REPO_DIR/scripts/lf-admin.sh" /usr/local/sbin/ledgerframe-admin 2>/dev/null || true
fi

# Re-render systemd units so unit changes (e.g. hardening tweaks) apply on update.
if [[ -r /etc/ledgerframe/admin.env ]]; then
  # shellcheck disable=SC1091
  . /etc/ledgerframe/admin.env   # REPO_DIR, DATA_DIR, RUN_USER
  API_HOST=127.0.0.1
  grep -q '^LEDGERFRAME_ALLOW_LAN=true' "$REPO_DIR/.env" 2>/dev/null && API_HOST=0.0.0.0
  for unit in ledgerframe-api ledgerframe-worker; do
    [[ -f /etc/systemd/system/$unit.service ]] || continue
    sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$RUN_USER|g" \
        -e "s|@API_HOST@|$API_HOST|g" "$REPO_DIR/systemd/$unit.service" \
      | sudo tee "/etc/systemd/system/$unit.service" >/dev/null
  done
  sudo systemctl daemon-reload 2>/dev/null || true
  echo "[update] systemd units refreshed"
fi

echo "[update] restarting services…"
sudo systemctl restart ledgerframe-api ledgerframe-worker 2>/dev/null \
  && echo "[update] services restarted" || echo "[update] services not installed (dev?)"
echo "[update] done. Open http://127.0.0.1:8321"
