#!/usr/bin/env bash
# =============================================================================
# LedgerFrame privileged admin helper.
#
# This is the ONLY command the LedgerFrame service user may run as root (via a
# scoped /etc/sudoers.d/ledgerframe rule the installer creates). It exposes a
# fixed allow-list of safe actions so the Settings page can control the system
# without granting the web app general root access.
#
# It deliberately does NOT run apt/Hailo installs (those stay CLI-only). Config
# is read from /etc/ledgerframe/admin.env (written by the installer).
#
#   Usage: ledgerframe-admin <action> [arg]
#   Actions: status | restart | lan <on|off> | voice <on|off> | ai <on|off>
#            | kiosk <on|off> | update | doctor | backup
# =============================================================================
set -euo pipefail

CONF=/etc/ledgerframe/admin.env
[[ -r "$CONF" ]] || { echo "missing $CONF (re-run installer)"; exit 2; }
# shellcheck disable=SC1090
. "$CONF"   # provides REPO_DIR, DATA_DIR, RUN_USER
ENV_FILE="$REPO_DIR/.env"
API_UNIT=/etc/systemd/system/ledgerframe-api.service

set_env() { # set_env KEY VALUE  (in the app .env)
  local k="$1" v="$2"
  if grep -q "^$k=" "$ENV_FILE"; then sed -i "s|^$k=.*|$k=$v|" "$ENV_FILE"; else printf '%s=%s\n' "$k" "$v" >> "$ENV_FILE"; fi
}

as_user() { sudo -u "$RUN_USER" "$@"; }

action="${1:-status}"
case "$action" in
  status)
    for u in ledgerframe-api ledgerframe-worker ledgerframe-voice; do
      state="$(systemctl is-active "$u" 2>/dev/null || true)"
      enabled="$(systemctl is-enabled "$u" 2>/dev/null || true)"
      printf '%s active=%s enabled=%s\n' "$u" "${state:-unknown}" "${enabled:-unknown}"
    done
    ;;
  restart)
    systemctl restart ledgerframe-api ledgerframe-worker
    echo "restarted"
    ;;
  lan)
    case "${2:-}" in
      on)  set_env LEDGERFRAME_ALLOW_LAN true;  host=0.0.0.0 ;;
      off) set_env LEDGERFRAME_ALLOW_LAN false; host=127.0.0.1 ;;
      *) echo "usage: lan <on|off>"; exit 1 ;;
    esac
    sed -i -E "s|(--host )[0-9.]+|\1$host|" "$API_UNIT"
    systemctl daemon-reload
    systemctl restart ledgerframe-api
    echo "lan ${2}: API now on $host"
    ;;
  voice)
    case "${2:-}" in
      on)
        set_env LEDGERFRAME_VOICE_ENABLED true
        if [[ -f "$REPO_DIR/systemd/ledgerframe-voice.service" ]]; then
          sed -e "s|@REPO_DIR@|$REPO_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" -e "s|@USER@|$RUN_USER|g" \
              "$REPO_DIR/systemd/ledgerframe-voice.service" > /etc/systemd/system/ledgerframe-voice.service
          systemctl daemon-reload
          systemctl enable --now ledgerframe-voice || true
        fi
        echo "voice on" ;;
      off)
        set_env LEDGERFRAME_VOICE_ENABLED false
        systemctl disable --now ledgerframe-voice 2>/dev/null || true
        echo "voice off" ;;
      *) echo "usage: voice <on|off>"; exit 1 ;;
    esac
    ;;
  ai)
    case "${2:-}" in
      on)  set_env LEDGERFRAME_AI_ENABLED true ;;
      off) set_env LEDGERFRAME_AI_ENABLED false ;;
      *) echo "usage: ai <on|off>"; exit 1 ;;
    esac
    systemctl restart ledgerframe-api ledgerframe-worker
    echo "ai ${2}" ;;
  kiosk)
    case "${2:-}" in
      on)
        if [[ -f /etc/systemd/system/ledgerframe-kiosk.service ]]; then
          systemctl enable --now ledgerframe-kiosk; echo "kiosk on"
        else echo "kiosk unit not installed (re-run installer with --enable-kiosk)"; exit 1; fi ;;
      off) systemctl disable --now ledgerframe-kiosk 2>/dev/null || true; echo "kiosk off" ;;
      *) echo "usage: kiosk <on|off>"; exit 1 ;;
    esac ;;
  update)
    # The update restarts ledgerframe-api/worker — so it must run OUTSIDE this
    # process tree, or it would be killed mid-flight when the API (its parent)
    # restarts. systemd-run puts it in its own cgroup (survives the restart);
    # setsid is the fallback. update.sh writes progress to <data>/logs/update.*
    # which the UI polls, so failures are visible rather than silent.
    LOG_DIR="${DATA_DIR:+$DATA_DIR/logs}"; [[ -n "$LOG_DIR" ]] || LOG_DIR="$REPO_DIR/.update"
    mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR=/tmp
    chown -R "$RUN_USER" "$LOG_DIR" 2>/dev/null || true
    echo "running" > "$LOG_DIR/update.status" 2>/dev/null || true
    if command -v systemd-run >/dev/null 2>&1; then
      systemd-run --collect --quiet \
        --setenv=RUN_USER="$RUN_USER" --setenv=REPO_DIR="$REPO_DIR" --setenv=DATA_DIR="$DATA_DIR" \
        bash "$REPO_DIR/scripts/update.sh" \
        && echo "update started in the background (transient unit); watch progress in Settings" \
        || { echo "failed: could not launch background update" > "$LOG_DIR/update.status"; echo "could not launch update"; exit 1; }
    else
      setsid env RUN_USER="$RUN_USER" REPO_DIR="$REPO_DIR" DATA_DIR="$DATA_DIR" \
        bash "$REPO_DIR/scripts/update.sh" >>"$LOG_DIR/update.log" 2>&1 < /dev/null &
      echo "update started in the background (detached); watch progress in Settings"
    fi
    ;;
  doctor)
    as_user bash "$REPO_DIR/scripts/doctor.sh" || true ;;
  backup)
    as_user bash "$REPO_DIR/scripts/backup.sh" ;;
  *)
    echo "unknown action: $action"; exit 1 ;;
esac
