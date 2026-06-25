#!/usr/bin/env bash
# Run backend (API) and frontend (Vite) together for local development.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
export LEDGERFRAME_ENV=development
export LEDGERFRAME_DATA_DIR="${LEDGERFRAME_DATA_DIR:-$REPO_DIR/data}"
mkdir -p "$LEDGERFRAME_DATA_DIR"
# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
echo "Data dir: $LEDGERFRAME_DATA_DIR"
( uvicorn app.main:app --host 127.0.0.1 --port 8321 --reload ) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
( cd frontend && npm run dev )
