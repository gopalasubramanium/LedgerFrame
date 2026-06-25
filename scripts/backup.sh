#!/usr/bin/env bash
# Create an (optionally age-encrypted) backup of the LedgerFrame database.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
python3 -c "from app.services.backup import create_backup; import json; print(json.dumps(create_backup(), indent=2))"
