#!/usr/bin/env bash
# Remove services and (optionally) the service user. NEVER touches the data dir
# or the NVMe — your data and backups are left intact.
set -euo pipefail
SERVICE_USER="${SERVICE_USER:-ledgerframe}"
echo "Stopping and disabling services…"
for unit in ledgerframe-kiosk ledgerframe-voice ledgerframe-worker ledgerframe-api; do
  sudo systemctl disable --now "$unit" 2>/dev/null || true
  sudo rm -f "/etc/systemd/system/$unit.service"
done
sudo systemctl daemon-reload
echo "Services removed. Data directory and backups were NOT touched."
read -rp "Also remove service user '$SERVICE_USER'? [y/N] " ans
[[ "$ans" =~ ^[Yy]$ ]] && sudo userdel "$SERVICE_USER" 2>/dev/null || true
echo "Done."
