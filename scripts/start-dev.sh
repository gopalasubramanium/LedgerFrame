#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run backend (API) and frontend (Vite) together for local development.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
export LEDGERFRAME_ENV=development
# shellcheck source=lib/datadir.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/datadir.sh"   # the ONE data-dir answer (release-readiness Part B/1)
export LEDGERFRAME_DATA_DIR="$(lf_data_dir)"
mkdir -p "$LEDGERFRAME_DATA_DIR"
# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
echo "Data dir: $LEDGERFRAME_DATA_DIR"
( uvicorn app.main:app --host 127.0.0.1 --port 8321 --reload ) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
( cd frontend && npm run dev )
