# LedgerFrame — Operations Guide

## First-time setup (no experience needed)

You can't break anything — the installer never erases or formats drives.

1. **Flash the OS.** Install **Raspberry Pi Imager** (raspberrypi.com/software),
   pick *Raspberry Pi 5* → *Raspberry Pi OS (64-bit)* → your microSD. In **Edit
   Settings** set a username/password, your Wi-Fi, and time zone. Write.
2. **Assemble.** (Fit the AI HAT+ 2 if you have one.) Insert the card; connect the
   monitor (HDMI0), keyboard, mouse, and your **USB SSD** (blue USB-3 port). Plug in
   power last — the desktop appears after a minute or two.
3. **The USB SSD** usually mounts automatically (you'll see it in the Files app).
   That's all that's needed; the installer finds it.
4. **Open the Terminal** (the `>_` icon, or Ctrl+Alt+T) and paste these one at a
   time (paste with Ctrl+Shift+V):
   ```bash
   cd ~
   sudo apt update && sudo apt install -y git
   git clone https://github.com/gopalasubramanium/LedgerFrame.git
   cd ~/LedgerFrame && ./scripts/install.sh
   ```
5. **Answer the prompts** (press Enter to accept the safe defaults). When it prints
   **"✓ All done!"**, open **Chromium → http://127.0.0.1:8321**. `sudo reboot` makes
   it launch full-screen automatically on every boot.

> Troubleshooting & the “view it on my phone” (LAN) steps are below and in the README.

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

## Managing data & system from the UI

Most day-to-day operation is now in the app (no CLI needed):

- **Pages:** **Home** (glanceable command centre), **Portfolio** (analytics:
  benchmarked performance, allocation, key stats, concentration), **Holdings**
  (the only place to add/edit/delete positions), **Markets** (your markets via a
  view dropdown + symbol search), **Global** (world markets via ETF proxies),
  **Heatmap**, **News**, **Snapshot**, **Settings**.
- **Edit holdings:** Holdings → **Add / Edit / Delete** — transactions
  (date/time, type incl. buy/sell/dividend/split/**bonus**/…, symbol, quantity,
  price, fees, taxes, currency, note; CSV import) and manual assets/liabilities.
- **Data source (demo ↔ live):** Settings → *Data source* — switch provider
  (`mock` / `csv` / `alphavantage`), set the API key. **Applies immediately.**
  - **Refresh live prices** — pulls quotes for everything shown; lists what
    updated/failed and why.
  - **Fetch & cache history** — backfills daily history for new holdings only.
  - **Clear demo / all data** — wipe to a clean slate (demo won't re-seed).
- **AI provider:** Settings → *AI assistant* — local Hailo/Ollama (set the IP) or
  any OpenAI-compatible endpoint (OpenAI / OpenRouter / Anthropic / remote Ollama);
  saves, applies, and tests the connection.
- **Appearance:** Settings → *Appearance* — light / dark / system theme (also a
  top-bar toggle), reduced motion, high contrast.
- **News feeds:** Settings → *News feeds* — paste free RSS/Atom URLs; **Test feeds**.
- **System controls:** Settings → *System controls* / *Service & maintenance* —
  enable/disable LAN, voice, AI; restart services; diagnostics; backups (requires
  the installer's scoped helper; see SECURITY.md). Package/Hailo **installation
  stays on the CLI** by design.
- **Security:** Settings → set a PIN; the PIN screen now pops up automatically when
  a session is locked/expired.

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
