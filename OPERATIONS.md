# LedgerFrame — Operations Guide

## Install (Raspberry Pi 5)

Prerequisites: Raspberry Pi OS 64-bit (Trixie preferred), the USB 3 NVMe **mounted
and writable** at your chosen data dir (default `/mnt/ledgerframe-data`), Node 20+,
Python 3.12, and (optionally) the Hailo stack + `hailo-ollama` for AI.

```bash
git clone <repo-url> LedgerFrame && cd LedgerFrame
./scripts/install.sh \
  --data-dir /mnt/ledgerframe-data \
  --enable-kiosk \
  --enable-voice false \
  --demo-mode true
./scripts/doctor.sh        # verify hardware, OS, Hailo, data dir, display, audio
```

The installer is idempotent: creates the service user, runtime dirs (strict perms),
`.env` (with a generated secret) without clobbering an existing one, installs
backend + frontend, builds the SPA, installs systemd units, and runs a health check.

## Start / stop / status

```bash
sudo systemctl start  ledgerframe-api ledgerframe-worker
sudo systemctl stop   ledgerframe-api ledgerframe-worker
sudo systemctl restart ledgerframe-api ledgerframe-worker
sudo systemctl status  ledgerframe-api

curl http://127.0.0.1:8321/health           # liveness
curl http://127.0.0.1:8321/api/v1/system/status | jq   # full status
./scripts/doctor.sh                          # full environment check
journalctl -u ledgerframe-api -f             # live logs
journalctl -u ledgerframe-worker -f
```

Kiosk (after a desktop session is up):

```bash
sudo systemctl enable --now ledgerframe-kiosk
```

## Development

```bash
cp .env.example .env
export LEDGERFRAME_DATA_DIR="$PWD/data" LEDGERFRAME_ENV=development
uv venv && source .venv/bin/activate && uv pip install -e ".[dev]"
(cd frontend && npm install)
./scripts/start-dev.sh     # API :8321 (reload) + Vite :5173
```

## Update (manual, non-destructive)

```bash
./scripts/update.sh        # backs up DB, git pull --ff-only, reinstall, rebuild,
                           # alembic upgrade head, restart services
```

There is no unattended/remote auto-update by design.

## Database migrations

```bash
source .venv/bin/activate
alembic upgrade head                          # apply
alembic revision --autogenerate -m "message"  # create (review the diff!)
```

Fresh installs are also bootstrapped by `create_all` on first boot; Alembic is the
source of truth for evolving the schema thereafter.

## Backup & restore

```bash
./scripts/backup.sh                       # snapshot → (age-encrypt) → rotate
./scripts/restore.sh ledgerframe-XXXX.db.age --identity age-identity.txt --force
```

Backups are written under `<data-dir>/backups`, rotated to `LEDGERFRAME_BACKUP_KEEP`
(default 14). The worker also runs a daily backup at 02:00 UTC. Configure
`LEDGERFRAME_BACKUP_AGE_RECIPIENT` (generate keys with `age-keygen -o age-identity.txt`)
to encrypt; keep the identity file off-device.

## Benchmark

```bash
./scripts/benchmark.sh     # API latency, payload sizes, RSS/CPU, disk, Hailo latency
```

Observed on the x86_64 dev machine in demo mode: `/health` ~2 ms,
`/dashboard/home` ~38 ms (2.2 KB), app RSS ~79 MB. On a Pi 5 expect higher but
well within the < 700 MB / < 4 s first-render targets.

## Switching out of demo mode

1. Edit `.env`: set `LEDGERFRAME_MARKET_PROVIDER` (e.g. `csv` or an external
   adapter) and, for external, `LEDGERFRAME_MARKET_API_KEY`. See
   `docs/DATA_SOURCES.md` for licensing and entitlement labelling.
2. For AI: install Hailo + `hailo-ollama`, set `LEDGERFRAME_AI_ENABLED=true`.
   Optionally pin `LEDGERFRAME_AI_MODEL` (else the smallest instruct model is used).
3. `sudo systemctl restart ledgerframe-api ledgerframe-worker`.

Reset demo data at any time: `./scripts/reset-demo-data.sh`.

## Uninstall

```bash
./scripts/uninstall.sh     # stops/removes services; NEVER touches your data or backups
```

## Troubleshooting

| Symptom | Check |
|--------|-------|
| API won't start | `journalctl -u ledgerframe-api -e`; data dir writable? `.env` valid? |
| "Locked" on every action | A PIN is set — unlock in the UI or `POST /api/v1/auth/unlock` |
| Quotes show "Stale"/"Cached" | Provider unreachable or refresh older than threshold — expected offline |
| AI says "data only" | `hailo-ollama` unreachable — run `doctor.sh`; dashboard still works |
| Kiosk blank | API healthy? `ExecStartPre` waits on `/health`; check `DISPLAY`/Wayland env |
| Heatmap empty | Needs priced instruments; warms on first load — refresh after worker runs |
