#!/usr/bin/env bash
# Restore a backup. Refuses to overwrite an existing DB unless --force.
#   ./scripts/restore.sh <backup-filename> [--force] [--identity age-identity.txt]
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
FILE="${1:?usage: restore.sh <backup-filename> [--force] [--identity FILE]}"
FORCE=False; IDENTITY=None
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=True; shift ;;
    --identity) IDENTITY="'$2'"; shift 2 ;;
    *) echo "unknown arg: $1"; exit 1 ;;
  esac
done
# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
python3 -c "from app.services.backup import restore_backup; import json; print(json.dumps(restore_backup('$FILE', $FORCE, $IDENTITY)))"
echo "Restart services: sudo systemctl restart ledgerframe-api ledgerframe-worker"
