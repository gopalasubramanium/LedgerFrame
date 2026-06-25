# LedgerFrame

[![Repository](https://img.shields.io/badge/GitHub-LedgerFrame-d9a566?logo=github&logoColor=white)](https://github.com/gopalasubramanium/LedgerFrame)
[![License: MIT](https://img.shields.io/badge/License-MIT-4ea88b)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi%205-c51a4a?logo=raspberrypi&logoColor=white)](ARCHITECTURE.md)

**A local-first, always-on personal financial intelligence display for Raspberry Pi 5 + Hailo AI HAT+ 2.**

LedgerFrame is a private, self-hosted financial command centre: market monitoring,
portfolio & net-worth tracking, interactive dashboards, optional local voice, and
grounded AI explanations — all running on your own hardware. Your portfolio data
stays on the device by default. Nothing is sent off-device unless you explicitly
configure it.

> This is **not** a trading or execution platform. It contains no order placement,
> no brokerage integration, and gives no buy/sell recommendations or financial advice.

---

## Highlights

- **Local-first & offline-capable** — last-known data is kept and clearly marked
  *stale* when connectivity drops. The dashboard never goes blank.
- **Deterministic financial engine** — all valuations, FIFO cost basis, allocations,
  and net worth are computed in Python with `Decimal`. The AI never calculates a number.
- **Grounded AI** — answers are built only from verified, timestamped facts produced
  by the backend; the model explains, it does not invent. Falls back to deterministic
  templates when the Hailo NPU is unavailable.
- **Provider-abstracted market data** — runs fully in **DEMO mode** (synthetic data,
  no API key) out of the box; swap in a CSV source or an opt-in external provider.
- **Private by design** — localhost-only binding, Argon2 PIN lock, encrypted backups
  (`age`), no telemetry, secrets kept out of the repo.

See `docs/` for architecture, security, data sources, voice setup, and testing.

---

## Quick start (development / any Linux/macOS machine)

```bash
git clone <your-repo-url> LedgerFrame && cd LedgerFrame
cp .env.example .env
# For local dev, point the data dir somewhere writable:
export LEDGERFRAME_DATA_DIR="$PWD/data" LEDGERFRAME_ENV=development

# Backend
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
ledgerframe              # serves API on http://127.0.0.1:8321

# Frontend (separate terminal)
cd frontend && npm install && npm run dev   # http://127.0.0.1:5173
```

Open <http://127.0.0.1:5173> in development, or <http://127.0.0.1:8321> once the
frontend is built (`npm run build`) and served by the API.

The app boots in **DEMO mode** with seeded holdings, watchlists, and synthetic
market data — no keys or network required.

---

## Install on Raspberry Pi 5

```bash
./scripts/install.sh \
  --data-dir /mnt/ledgerframe-data \
  --enable-kiosk \
  --enable-voice false \
  --demo-mode true
```

Then verify the hardware & runtime:

```bash
./scripts/doctor.sh
```

Full operational guide: [`OPERATIONS.md`](OPERATIONS.md). Hardware/AI setup and
constraints: [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md).

---

## Day-to-day commands

| Action            | Command                                                        |
|-------------------|----------------------------------------------------------------|
| Start (dev)       | `ledgerframe`                                                  |
| Start services    | `sudo systemctl start ledgerframe-api ledgerframe-worker`      |
| Stop services     | `sudo systemctl stop ledgerframe-api ledgerframe-worker`       |
| Status / health   | `curl http://127.0.0.1:8321/health` · `./scripts/doctor.sh`    |
| Update            | `./scripts/update.sh`                                          |
| Back up           | `./scripts/backup.sh`                                          |
| Restore           | `./scripts/restore.sh <backup-file>`                           |
| Benchmark         | `./scripts/benchmark.sh`                                       |
| Reset demo data   | `./scripts/reset-demo-data.sh`                                 |
| Run tests         | `pytest` · `cd frontend && npm test`                           |

---

## License

MIT. See `LICENSE`. Market data and any external providers are subject to their own
terms — see [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
