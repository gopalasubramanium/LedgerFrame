#!/usr/bin/env bash
# LedgerFrame doctor — validates hardware, OS, Hailo stack, data dir, display, audio.
# Read-only: makes no changes. Exit code is non-zero if any CRITICAL check fails.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}"
HAILO_URL="${LEDGERFRAME_HAILO_BASE_URL:-http://127.0.0.1:8000}"
API_URL="http://127.0.0.1:${LEDGERFRAME_API_PORT:-8321}"

PASS=0; WARN=0; FAIL=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
note() { printf '  \033[1;33m!\033[0m %s\n' "$*"; WARN=$((WARN+1)); }
bad()  { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
hdr()  { printf '\n\033[1;36m%s\033[0m\n' "$*"; }

hdr "System"
ARCH=$(uname -m)
[[ "$ARCH" == "aarch64" ]] && ok "Architecture: aarch64" || note "Architecture is $ARCH (expected aarch64 on Pi 5; OK for dev)"
if [[ -f /proc/device-tree/model ]]; then
  MODEL=$(tr -d '\0' < /proc/device-tree/model)
  [[ "$MODEL" == *"Raspberry Pi 5"* ]] && ok "Model: $MODEL" || note "Model: $MODEL (expected Raspberry Pi 5)"
else
  note "Not running on a Raspberry Pi (no device-tree model) — dev machine?"
fi
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  ok "OS: ${PRETTY_NAME:-unknown}"
  [[ "$(getconf LONG_BIT)" == "64" ]] && ok "64-bit userland" || bad "Not a 64-bit OS"
fi

hdr "Hailo AI HAT+ 2"
if command -v hailortcli &>/dev/null; then
  if hailortcli fw-control identify &>/dev/null; then
    ok "hailortcli fw-control identify succeeded"
  else
    note "hailortcli present but identify failed (HAT seated? PCIe enabled?)"
  fi
else
  note "hailortcli not found — AI features will be disabled (dashboard still works)"
fi
if curl -fsS "$HAILO_URL/hailo/v1/list" >/dev/null 2>&1; then
  MODELS=$(curl -fsS "$HAILO_URL/hailo/v1/list" 2>/dev/null)
  ok "hailo-ollama reachable at $HAILO_URL"
  printf '    models: %s\n' "$(echo "$MODELS" | head -c 200)"
else
  note "hailo-ollama not reachable at $HAILO_URL — local AI unavailable (deterministic fallback active)"
fi

hdr "Data directory (USB NVMe — storage only)"
if [[ -d "$DATA_DIR" ]]; then
  if touch "$DATA_DIR/.lf-doctor" 2>/dev/null; then rm -f "$DATA_DIR/.lf-doctor"; ok "Writable: $DATA_DIR"
  else bad "Not writable: $DATA_DIR"; fi
  AVAIL=$(df -h "$DATA_DIR" | awk 'NR==2{print $4}')
  ok "Free space: ${AVAIL:-?}"
else
  bad "Data directory missing: $DATA_DIR (mount the NVMe; installer will NOT create it)"
fi

hdr "Application"
if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
  ok "API healthy at $API_URL"
  curl -fsS "$API_URL/api/v1/system/status" 2>/dev/null | python3 -m json.tool 2>/dev/null | sed 's/^/    /' | head -20
else
  note "API not running (start with: systemctl start ledgerframe-api)"
fi

hdr "Display & Chromium"
[[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && ok "Display detected (${DISPLAY:-$WAYLAND_DISPLAY})" || note "No display env (headless session?)"
if command -v chromium-browser &>/dev/null || command -v chromium &>/dev/null; then
  ok "Chromium installed"
else
  note "Chromium not found — needed for kiosk mode"
fi

hdr "Audio (voice features)"
if [[ "${LEDGERFRAME_VOICE_ENABLED:-false}" == "true" ]]; then
  command -v arecord &>/dev/null && arecord -l 2>/dev/null | grep -q card && ok "Microphone device present" || note "No capture device"
  command -v aplay &>/dev/null && aplay -l 2>/dev/null | grep -q card && ok "Playback device present" || note "No playback device"
else
  ok "Voice disabled — skipping audio checks"
fi

hdr "Summary"
printf '  %d passed · %d warnings · %d failed\n\n' "$PASS" "$WARN" "$FAIL"
[[ $FAIL -gt 0 ]] && exit 1 || exit 0
