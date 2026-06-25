#!/usr/bin/env bash
# =============================================================================
# LedgerFrame installer — smart, friendly, idempotent, and non-destructive.
#
# Run with no arguments for a guided setup:
#     ./scripts/install.sh
#
# Or fully unattended with sensible defaults:
#     ./scripts/install.sh --yes
#
# Flags (all optional — the wizard asks for anything not given):
#     --data-dir DIR        Where to store data (default: /mnt/ledgerframe-data on a Pi)
#     --enable-kiosk [BOOL] Launch the full-screen display on boot (auto-detected)
#     --enable-voice [BOOL] Install optional local voice (default: false)
#     --demo-mode   [BOOL]  Start with safe synthetic data, no API keys (default: true)
#     --service-user NAME   System account to run the services (default: ledgerframe)
#     --no-deps             Don't install system packages (assume they're present)
#     --yes, -y             Don't ask questions; accept all defaults
#     --dry-run             Show exactly what would happen, change nothing
#     --help, -h            Show this help
#
# SAFETY: this script NEVER formats, partitions, or erases any disk. It only
#         creates a folder on a drive you already have mounted.
# =============================================================================
set -euo pipefail

# --- pretty output ----------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_CYAN=$'\033[1;36m'; C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""; C_BOLD=""
fi
STEP=0
step() { STEP=$((STEP+1)); printf '\n%s▶ Step %s: %s%s\n' "$C_CYAN" "$STEP" "$*" "$C_RESET"; }
info() { printf '   %s\n' "$*"; }
ok()   { printf '   %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '   %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()  { printf '\n%s✗ %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# --- defaults & arg parsing -------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Default to the current login user. Running as the same user that owns the cloned
# repo avoids home-directory permission problems (a separate system account can't
# read an app installed under /home/<you>/). Override with --service-user for an
# isolated account, but then install the app to a shared path like /opt.
RUN_USER="${SUDO_USER:-$USER}"
SERVICE_USER="${SERVICE_USER:-}"
SET_USER=false
DATA_DIR="${LEDGERFRAME_DATA_DIR:-}"
ENABLE_KIOSK=""; ENABLE_VOICE=""; DEMO_MODE=""
ASSUME_YES=false; DRY_RUN=false; INSTALL_DEPS=true
SET_KIOSK=false; SET_VOICE=false; SET_DEMO=false; SET_DATA=false

bool() { case "${1,,}" in true|yes|y|1|on) echo true ;; *) echo false ;; esac; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --data-dir)     DATA_DIR="$2"; SET_DATA=true; shift 2 ;;
    --enable-kiosk) if [[ "${2:-}" =~ ^(true|false|yes|no)$ ]]; then ENABLE_KIOSK=$(bool "$2"); shift 2; else ENABLE_KIOSK=true; shift; fi; SET_KIOSK=true ;;
    --enable-voice) ENABLE_VOICE=$(bool "${2:-true}"); SET_VOICE=true; shift 2 ;;
    --demo-mode)    DEMO_MODE=$(bool "${2:-true}"); SET_DEMO=true; shift 2 ;;
    --service-user) SERVICE_USER="$2"; SET_USER=true; shift 2 ;;
    --no-deps)      INSTALL_DEPS=false; shift ;;
    --yes|-y)       ASSUME_YES=true; shift ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --help|-h)      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

INTERACTIVE=false
[[ -t 0 && "$ASSUME_YES" == false ]] && INTERACTIVE=true

# Resolve which account runs the services. Default = current user (works with a
# home-dir install); only a custom --service-user creates a system account.
[[ -z "$SERVICE_USER" ]] && SERVICE_USER="$RUN_USER"

SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"

ask() { # ask "Question" "default"  -> echoes answer
  local q="$1" def="$2" reply
  if [[ "$INTERACTIVE" == false ]]; then echo "$def"; return; fi
  read -r -p "   $q [$def]: " reply || true
  echo "${reply:-$def}"
}
ask_yn() { # ask_yn "Question" "y|n" -> returns 0 for yes
  local def_label; [[ "$2" == "y" ]] && def_label="Y/n" || def_label="y/N"
  if [[ "$INTERACTIVE" == false ]]; then [[ "$2" == "y" ]]; return; fi
  local reply; read -r -p "   $1 ($def_label): " reply || true
  reply="${reply:-$2}"; [[ "${reply,,}" =~ ^y ]]
}

# --- environment detection --------------------------------------------------
ARCH="$(uname -m)"
OS_ID=""; [[ -f /etc/os-release ]] && OS_ID="$(. /etc/os-release; echo "$ID")"
PKG=""; have apt-get && PKG="apt"
IS_PI=false
[[ -f /proc/device-tree/model ]] && grep -qi "raspberry pi" /proc/device-tree/model 2>/dev/null && IS_PI=true
HAS_DISPLAY=false; [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && HAS_DISPLAY=true
HAS_CHROMIUM=false; (have chromium-browser || have chromium) && HAS_CHROMIUM=true

cat <<EOF

${C_BOLD}╭─────────────────────────────────────────────╮
│            LedgerFrame  ·  Installer          │
╰─────────────────────────────────────────────╯${C_RESET}
${C_DIM}Local-first financial display for Raspberry Pi 5 + Hailo AI HAT+ 2${C_RESET}

   Detected: arch=$ARCH  os=${OS_ID:-unknown}  raspberry-pi=$IS_PI  display=$HAS_DISPLAY
EOF
[[ "$DRY_RUN" == true ]] && warn "DRY RUN — nothing will be changed."

# =============================================================================
step "Choose where to store your data"
# Suggest a default; on a Pi prefer the external drive mount, else a local folder.
suggest_data_dir() {
  if [[ -n "$DATA_DIR" ]]; then echo "$DATA_DIR"; return; fi
  if [[ "$IS_PI" == true ]]; then
    # Prefer an already-mounted USB drive under /mnt or /media if one exists.
    local m
    m="$(lsblk -rno MOUNTPOINT,TRAN 2>/dev/null | awk '$2=="usb" && $1!="" {print $1; exit}')"
    [[ -n "$m" ]] && { echo "$m/ledgerframe-data"; return; }
    echo "/mnt/ledgerframe-data"
  else
    echo "$REPO_DIR/data"
  fi
}
DATA_DIR="$(suggest_data_dir)"

if [[ "$IS_PI" == true && "$INTERACTIVE" == true ]]; then
  info "Drives currently connected (for reference — none will be erased):"
  lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,TRAN 2>/dev/null | sed 's/^/     /' || true
  info ""
  info "Your USB SSD/NVMe should already be plugged in and mounted (e.g. under /mnt or /media)."
fi
[[ "$SET_DATA" == false ]] && DATA_DIR="$(ask "Data folder" "$DATA_DIR")"

# Create the folder only if its parent already exists. Never format a drive.
PARENT="$(dirname "$DATA_DIR")"
if [[ ! -d "$DATA_DIR" ]]; then
  if [[ ! -d "$PARENT" ]]; then
    die "The location '$PARENT' doesn't exist. Plug in and mount your drive first, then re-run.
       (This installer never creates or formats drives — only a folder on an existing one.)"
  fi
  if ask_yn "Folder '$DATA_DIR' doesn't exist. Create it now?" "y"; then
    if [[ "$DRY_RUN" == false ]]; then
      # Use sudo only if a plain mkdir would fail (e.g. creating under /mnt).
      mkdir -p "$DATA_DIR" 2>/dev/null || $SUDO mkdir -p "$DATA_DIR" || die "could not create '$DATA_DIR'"
      $SUDO chown "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR" 2>/dev/null || true
      ok "Created: $DATA_DIR"
    else
      ok "Would create: $DATA_DIR"
    fi
  else
    die "Need a data folder to continue."
  fi
fi
if [[ "$DRY_RUN" == false ]]; then
  # Make sure the account that will RUN the services can write here.
  $SUDO chown "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR" 2>/dev/null || true
  if ! $SUDO -u "$SERVICE_USER" test -w "$DATA_DIR" 2>/dev/null; then
    warn "fixing permissions on $DATA_DIR for user '$SERVICE_USER'"
    $SUDO chmod 700 "$DATA_DIR" 2>/dev/null || true
  fi
fi
ok "Data folder: $DATA_DIR"

# =============================================================================
step "Choose features"
[[ "$SET_DEMO" == false ]] && { ask_yn "Start in DEMO mode (safe sample data, no signup/keys needed)?" "y" && DEMO_MODE=true || DEMO_MODE=false; }
# Kiosk default: on if this looks like a Pi with a screen.
if [[ "$SET_KIOSK" == false ]]; then
  local_default="n"; { [[ "$IS_PI" == true || "$HAS_DISPLAY" == true ]]; } && local_default="y"
  ask_yn "Auto-launch the full-screen dashboard on this device (kiosk mode)?" "$local_default" && ENABLE_KIOSK=true || ENABLE_KIOSK=false
fi
[[ "$SET_VOICE" == false ]] && { ask_yn "Install optional local voice control (microphone)?" "n" && ENABLE_VOICE=true || ENABLE_VOICE=false; }

# =============================================================================
step "Review the plan"
cat <<EOF
   ${C_BOLD}Data folder:${C_RESET}   $DATA_DIR
   ${C_BOLD}Demo mode:${C_RESET}     $DEMO_MODE   ${C_DIM}(synthetic data, no API keys)${C_RESET}
   ${C_BOLD}Kiosk mode:${C_RESET}    $ENABLE_KIOSK
   ${C_BOLD}Voice:${C_RESET}         $ENABLE_VOICE
   ${C_BOLD}Service user:${C_RESET}  $SERVICE_USER
   ${C_BOLD}Install deps:${C_RESET}  $INSTALL_DEPS   ${C_DIM}(uv, Node, build tools, age$([[ "$ENABLE_KIOSK" == true ]] && echo ", Chromium"))${C_RESET}
EOF
if [[ "$DRY_RUN" == true ]]; then
  warn "Dry run complete — no changes made. Re-run without --dry-run to install."
  exit 0
fi
ask_yn "Proceed with installation?" "y" || die "Cancelled. Nothing was changed."

if [[ -n "$SUDO" ]] && ! sudo -n true 2>/dev/null; then
  info "Some steps need administrator rights; you may be asked for your password."
fi

# =============================================================================
step "Install system prerequisites"
apt_has() { apt-cache show "$1" >/dev/null 2>&1; }   # is this package name available?
apt_one() { # install one package, tolerate failure, report it
  local p="$1"
  if $SUDO apt-get install -y "$p" >/dev/null 2>&1; then ok "$p"; else warn "could not install '$p' (skipped)"; fi
}
if [[ "$INSTALL_DEPS" == true && "$PKG" == "apt" ]]; then
  info "Updating package lists…"
  $SUDO apt-get update -qq || warn "apt update failed (continuing)"

  # Core build/runtime deps. Install one at a time so a single bad name can't
  # abort the whole batch (the original bug on Debian Trixie).
  PKGS=(curl ca-certificates git build-essential libffi-dev python3-venv)
  have node || PKGS+=(nodejs npm)
  if ! have age && apt_has age; then PKGS+=(age); fi
  [[ "$ENABLE_VOICE" == true ]] && PKGS+=(portaudio19-dev libsndfile1 alsa-utils)
  # Chromium package name differs across distros: 'chromium' (Debian) vs
  # 'chromium-browser' (some Raspberry Pi OS images). Pick whichever exists.
  if [[ "$ENABLE_KIOSK" == true && "$HAS_CHROMIUM" == false ]]; then
    if apt_has chromium; then PKGS+=(chromium)
    elif apt_has chromium-browser; then PKGS+=(chromium-browser)
    else warn "no chromium package found in apt — install a browser manually for kiosk mode"; fi
  fi
  info "Installing: ${PKGS[*]}"
  for p in "${PKGS[@]}"; do apt_one "$p"; done

  # Debian Trixie often ships Node without a standalone 'npm' package. If npm is
  # missing but Node + corepack are present, enable npm via corepack (bundled).
  if (have node || have nodejs) && ! have npm && have corepack; then
    $SUDO corepack enable npm >/dev/null 2>&1 || $SUDO corepack enable >/dev/null 2>&1 || true
    have npm && ok "npm enabled via corepack"
  fi

  # If Node is still missing/old, the frontend can't be rebuilt — but a prebuilt
  # dashboard ships in the repo, so this is only informational.
  NODE_CMD="$(command -v node || command -v nodejs || true)"
  if [[ -n "$NODE_CMD" ]]; then
    NODE_MAJOR="$("$NODE_CMD" -v 2>/dev/null | sed 's/[^0-9.]//g' | cut -d. -f1)"
    [[ "${NODE_MAJOR:-0}" -lt 18 ]] && warn "Node $("$NODE_CMD" -v) is old (<18); will use the prebuilt dashboard."
  fi
elif [[ "$INSTALL_DEPS" == true ]]; then
  warn "No apt detected — ensure curl, git, Node 18+, a C toolchain, and (optionally) age are installed."
else
  info "Skipping system package install (--no-deps)."
fi

# uv (manages Python 3.12 itself, even if the OS Python is older/newer).
if ! have uv; then
  info "Installing uv (Python toolchain manager)…"
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1 || warn "uv install script failed."
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi
have uv && ok "uv $(uv --version 2>/dev/null | awk '{print $2}')" || warn "uv unavailable — will fall back to system python3."

# =============================================================================
step "Set up the service account and data folders"
if id "$SERVICE_USER" &>/dev/null; then
  ok "Services will run as '$SERVICE_USER'."
  # Warn if a non-login user would be running an app stored under someone's home.
  if [[ "$SERVICE_USER" != "$RUN_USER" && "$REPO_DIR" == /home/* ]]; then
    warn "App is under /home but will run as '$SERVICE_USER'. If it can't start, move the"
    warn "app to /opt/ledgerframe, or re-run without --service-user to run as '$RUN_USER'."
  fi
else
  $SUDO useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER" 2>/dev/null || true
  ok "Created service user '$SERVICE_USER'."
fi
for sub in db cache imports logs backups generated-audio; do
  $SUDO mkdir -p "$DATA_DIR/$sub"
done
$SUDO chmod 700 "$DATA_DIR" 2>/dev/null || true
ok "Data folders ready under $DATA_DIR"

# =============================================================================
step "Write configuration (.env)"
# Strip any trailing inline comment from a KEY=value line. systemd's EnvironmentFile
# treats "KEY=value  # note" as the literal value "value  # note", which breaks
# numeric/boolean settings. Only touches LEDGERFRAME_* lines whose value has no
# spaces (true for all our settings), so it can't corrupt a real value.
sanitize_env() {
  sed -i -E 's/^(LEDGERFRAME_[A-Z0-9_]+=[^[:space:]#]*)[[:space:]]+#.*$/\1/' "$1"
}
if [[ -f "$REPO_DIR/.env" ]]; then
  cp -n "$REPO_DIR/.env" "$REPO_DIR/.env.bak.$(date +%s)" 2>/dev/null || true
  if grep -qE '^LEDGERFRAME_[A-Z0-9_]+=[^[:space:]#]*[[:space:]]+#' "$REPO_DIR/.env"; then
    sanitize_env "$REPO_DIR/.env"
    ok "Existing .env had inline comments — cleaned them (backup saved)."
  else
    ok "Existing .env kept (a timestamped backup was made)."
  fi
else
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))' 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -d '/+=')"
  sed -i "s|^LEDGERFRAME_SECRET_KEY=.*|LEDGERFRAME_SECRET_KEY=$SECRET|" "$REPO_DIR/.env"
  sed -i "s|^LEDGERFRAME_DATA_DIR=.*|LEDGERFRAME_DATA_DIR=$DATA_DIR|" "$REPO_DIR/.env"
  sed -i "s|^LEDGERFRAME_VOICE_ENABLED=.*|LEDGERFRAME_VOICE_ENABLED=$ENABLE_VOICE|" "$REPO_DIR/.env"
  [[ "$DEMO_MODE" == false ]] && sed -i "s|^LEDGERFRAME_MARKET_PROVIDER=.*|LEDGERFRAME_MARKET_PROVIDER=csv|" "$REPO_DIR/.env"
  chmod 600 "$REPO_DIR/.env"
  ok "Created .env with a freshly generated secret key."
fi

# =============================================================================
step "Install the application (backend)"
cd "$REPO_DIR"
if have uv; then
  uv venv --python 3.12 .venv >/dev/null 2>&1 || uv venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  uv pip install -e ".[dev]" >/dev/null 2>&1 || die "backend dependency install failed (see above)."
  [[ "$ENABLE_VOICE" == true ]] && { uv pip install -e ".[voice]" >/dev/null 2>&1 || warn "voice extras failed."; }
else
  have python3 || die "Python 3 is required but not found."
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -U pip >/dev/null 2>&1
  pip install -e ".[dev]" >/dev/null 2>&1 || die "backend dependency install failed."
fi
ok "Backend installed."

# =============================================================================
step "Prepare the dashboard (frontend)"
BUILT=false
if have npm && [[ "${NODE_MAJOR:-0}" -ge 18 || -z "${NODE_MAJOR:-}" ]]; then
  info "Building the latest dashboard from source…"
  if ( cd frontend && (npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install >/dev/null 2>&1) && npm run build >/dev/null 2>&1 ); then
    BUILT=true; ok "Dashboard built from source."
  fi
fi
if [[ "$BUILT" == false ]]; then
  if [[ -f "$REPO_DIR/frontend/dist/index.html" ]]; then
    ok "Using the existing built dashboard (skipped rebuild)."
  else
    warn "Dashboard not built (Node 18+ needed). The API will still run; finish the UI later with:"
    warn "   (cd $REPO_DIR/frontend && npm install && npm run build) && sudo systemctl restart ledgerframe-api"
  fi
fi

# =============================================================================
step "Install and start the background services"
render_unit() { # render_unit name use-service-user?
  local name="$1" user_kind="$2" run_user
  [[ "$user_kind" == "desktop" ]] && run_user="${SUDO_USER:-$USER}" || run_user="$SERVICE_USER"
  sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$run_user|g" \
      "$REPO_DIR/systemd/$name.service" | $SUDO tee "/etc/systemd/system/$name.service" >/dev/null
}
render_unit ledgerframe-api service
render_unit ledgerframe-worker service
[[ "$ENABLE_KIOSK" == true ]] && render_unit ledgerframe-kiosk desktop
[[ "$ENABLE_VOICE" == true ]] && render_unit ledgerframe-voice service

$SUDO chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR" 2>/dev/null || true
$SUDO chown -R "$SERVICE_USER":"$SERVICE_USER" "$REPO_DIR/.venv" "$REPO_DIR/frontend/dist" 2>/dev/null || true

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now ledgerframe-api ledgerframe-worker >/dev/null 2>&1
[[ "$ENABLE_KIOSK" == true ]] && $SUDO systemctl enable ledgerframe-kiosk >/dev/null 2>&1 || true
[[ "$ENABLE_VOICE" == true ]] && $SUDO systemctl enable --now ledgerframe-voice >/dev/null 2>&1 || true
ok "Services installed and started."

# =============================================================================
step "Final check"
HEALTHY=false
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8321/health" >/dev/null 2>&1; then HEALTHY=true; break; fi
  sleep 1
done
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ "$HEALTHY" == true ]]; then
  ok "LedgerFrame is running."
else
  warn "The app didn't respond yet. Check logs with:  journalctl -u ledgerframe-api -e"
fi

cat <<EOF

${C_GREEN}${C_BOLD}✓ All done!${C_RESET}

   Open the dashboard in a browser:
      ${C_BOLD}http://127.0.0.1:8321${C_RESET}   (on this device)
$( [[ -n "$LAN_IP" ]] && printf '      %shttp://%s:8321%s   (from another device — enable LAN access first)\n' "$C_DIM" "$LAN_IP" "$C_RESET" )

   Handy commands:
      Verify everything:   ./scripts/doctor.sh
      View live logs:      journalctl -u ledgerframe-api -f
      Stop / start:        sudo systemctl stop|start ledgerframe-api ledgerframe-worker
      Update later:        ./scripts/update.sh

   Next:
      • In ${C_BOLD}Settings${C_RESET}, set a PIN to protect changes.
$( [[ "$DEMO_MODE" == true ]] && echo "      • You're in DEMO mode with sample data. To use live prices, see docs/DATA_SOURCES.md." )
      • For local AI answers, install the Hailo stack + hailo-ollama (see ARCHITECTURE.md).

EOF
