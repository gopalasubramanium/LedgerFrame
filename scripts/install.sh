#!/usr/bin/env bash
# LedgerFrame installer — idempotent, non-destructive.
#
#   Never formats or repartitions disks. Never overwrites a non-empty config
#   without first backing it up. Validates the data directory before use.
#
# Usage:
#   ./scripts/install.sh \
#     --data-dir /mnt/ledgerframe-data \
#     --enable-kiosk \
#     --enable-voice false \
#     --demo-mode true
set -euo pipefail

# ---------------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}"
ENABLE_KIOSK=false
ENABLE_VOICE=false
DEMO_MODE=true
SERVICE_USER="${SERVICE_USER:-ledgerframe}"

log()  { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --data-dir)     DATA_DIR="$2"; shift 2 ;;
    --enable-kiosk) ENABLE_KIOSK=true; shift ;;
    --enable-voice) ENABLE_VOICE="${2:-true}"; shift 2 ;;
    --demo-mode)    DEMO_MODE="${2:-true}"; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done

# ---------------------------------------------------------------------------
log "Repository: $REPO_DIR"
log "Data dir:   $DATA_DIR (storage only — will NOT be formatted)"

# 1. Validate data directory (must exist & be writable; we never create the mount).
if [[ ! -d "$DATA_DIR" ]]; then
  warn "Data directory $DATA_DIR does not exist."
  warn "Create/mount your USB NVMe there first, then re-run. Not creating it automatically."
  die  "aborting to avoid writing to the wrong location"
fi
touch "$DATA_DIR/.lf-write-test" 2>/dev/null || die "data dir not writable: $DATA_DIR"
rm -f "$DATA_DIR/.lf-write-test"
log "Data directory is writable."

# 2. Service account (non-root). Idempotent.
if ! id "$SERVICE_USER" &>/dev/null; then
  log "Creating service user '$SERVICE_USER'"
  sudo useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER" || true
fi

# 3. Subdirectories with strict perms.
for sub in db cache imports logs backups generated-audio; do
  sudo -u "$SERVICE_USER" mkdir -p "$DATA_DIR/$sub" 2>/dev/null || mkdir -p "$DATA_DIR/$sub"
done
chmod 700 "$DATA_DIR" 2>/dev/null || true

# 4. .env — never clobber a customised one.
if [[ -f "$REPO_DIR/.env" ]]; then
  if ! grep -q "^LEDGERFRAME_" "$REPO_DIR/.env" 2>/dev/null; then
    warn ".env exists but looks empty; leaving as-is."
  else
    log ".env already present; backing up before any change."
    cp -n "$REPO_DIR/.env" "$REPO_DIR/.env.bak.$(date +%s)"
  fi
else
  log "Creating .env from template."
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
  sed -i "s|^LEDGERFRAME_SECRET_KEY=.*|LEDGERFRAME_SECRET_KEY=$SECRET|" "$REPO_DIR/.env"
  sed -i "s|^LEDGERFRAME_DATA_DIR=.*|LEDGERFRAME_DATA_DIR=$DATA_DIR|" "$REPO_DIR/.env"
  sed -i "s|^LEDGERFRAME_VOICE_ENABLED=.*|LEDGERFRAME_VOICE_ENABLED=$ENABLE_VOICE|" "$REPO_DIR/.env"
  [[ "$DEMO_MODE" == "false" ]] && sed -i "s|^LEDGERFRAME_MARKET_PROVIDER=.*|LEDGERFRAME_MARKET_PROVIDER=csv|" "$REPO_DIR/.env"
  chmod 600 "$REPO_DIR/.env"
fi

# 5. Backend deps (prefer uv).
log "Installing backend dependencies."
cd "$REPO_DIR"
if command -v uv &>/dev/null; then
  uv venv --python 3.12 .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  uv pip install -e ".[dev]"
  [[ "$ENABLE_VOICE" == "true" ]] && uv pip install -e ".[voice]" || true
else
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -U pip
  pip install -e ".[dev]"
fi

# 6. Frontend build.
if command -v npm &>/dev/null; then
  log "Building frontend."
  (cd frontend && npm ci --no-audit --no-fund 2>/dev/null || npm install) && (cd frontend && npm run build)
else
  warn "npm not found — skipping frontend build. Install Node 20+ and run 'cd frontend && npm install && npm run build'."
fi

# 7. systemd units.
log "Installing systemd units."
TMP=$(mktemp -d)
for unit in ledgerframe-api ledgerframe-worker; do
  sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$SERVICE_USER|g" \
      "$REPO_DIR/systemd/$unit.service" > "$TMP/$unit.service"
  sudo cp "$TMP/$unit.service" "/etc/systemd/system/$unit.service"
done
if [[ "$ENABLE_KIOSK" == "true" ]]; then
  sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@USER@|${SUDO_USER:-$USER}|g" \
      "$REPO_DIR/systemd/ledgerframe-kiosk.service" | sudo tee /etc/systemd/system/ledgerframe-kiosk.service >/dev/null
fi
if [[ "$ENABLE_VOICE" == "true" ]]; then
  sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$SERVICE_USER|g" \
      "$REPO_DIR/systemd/ledgerframe-voice.service" | sudo tee /etc/systemd/system/ledgerframe-voice.service >/dev/null
fi
rm -rf "$TMP"

# Ownership of repo data the service writes (DB lives under DATA_DIR, owned by service user).
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR" 2>/dev/null || true

sudo systemctl daemon-reload
sudo systemctl enable --now ledgerframe-api ledgerframe-worker
[[ "$ENABLE_KIOSK" == "true" ]] && sudo systemctl enable ledgerframe-kiosk || true
[[ "$ENABLE_VOICE" == "true" ]] && sudo systemctl enable --now ledgerframe-voice || true

# 8. Health check.
log "Waiting for API health…"
for i in {1..20}; do
  if curl -fsS "http://127.0.0.1:8321/health" >/dev/null 2>&1; then
    log "API healthy."
    break
  fi
  sleep 1
  [[ $i -eq 20 ]] && warn "API did not become healthy in time — check 'journalctl -u ledgerframe-api'."
done

cat <<EOF

\033[1;32mLedgerFrame installed.\033[0m

Next steps:
  • Verify hardware/runtime:   ./scripts/doctor.sh
  • Open the dashboard:        http://127.0.0.1:8321
  • Service logs:              journalctl -u ledgerframe-api -f
  • Set a PIN in Settings to protect changes (required before enabling LAN access).
  • For live market data, edit .env (LEDGERFRAME_MARKET_PROVIDER + key) — see docs/DATA_SOURCES.md.
  • For AI, install the Hailo stack and hailo-ollama — see ARCHITECTURE.md §AI.

EOF
