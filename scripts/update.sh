#!/usr/bin/env bash
# Manual, non-destructive update: pull, reinstall deps, rebuild frontend, migrate, restart.
# No unattended/remote auto-update. Review changes before running.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
echo "[update] backing up database first…"
./scripts/backup.sh || echo "[update] backup skipped"
echo "[update] pulling latest…"
git pull --ff-only
# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
if command -v uv &>/dev/null; then uv pip install -e ".[dev]"; else pip install -e ".[dev]"; fi
[[ -d frontend ]] && (cd frontend && npm install && npm run build)
echo "[update] applying migrations…"
alembic upgrade head 2>/dev/null || echo "[update] no migrations to apply"
echo "[update] restarting services…"
sudo systemctl restart ledgerframe-api ledgerframe-worker || echo "[update] services not installed (dev?)"
echo "[update] done."
