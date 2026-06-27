# LedgerFrame — Delivery Report

## 1. Architecture summary

Local-first FastAPI backend + React/TS SPA, deployed natively via systemd on a
Raspberry Pi 5 with the Hailo AI HAT+ 2. A deterministic financial core (Decimal
math, FIFO cost basis) computes every number; pluggable providers supply market
data (mock/csv/external), AI (Hailo/disabled/OpenAI-compatible), and voice. The AI
layer only *explains* verified, timestamped facts — it never calculates. SQLite
(WAL) on the USB NVMe holds all mutable state. Full detail in
[`ARCHITECTURE.md`](../ARCHITECTURE.md).

## 2. Implemented features

- **Backend engine:** FIFO cost basis (buy/sell/split/**bonus**/dividend/interest/fees/
  **taxes**), multi-currency valuation + FX, unrealised/realised P/L, income & income
  yield, day change, allocations (class/currency/sector/account), top movers,
  concentration, net worth with liabilities, manual/illiquid price overrides.
- **Performance analytics:** benchmarked invested-portfolio value series vs a
  user-selectable index, with deterministic stats (return, vs-benchmark, max drawdown,
  annualised volatility, return/vol). DB-cached daily history.
- **Market data abstraction:** `mock` (DEMO), `csv`, `alphavantage` (equities/ETFs,
  crypto, FX; index ETF proxies on Global). Switchable from Settings, applied
  in-process. Per-quote provenance/entitlement/staleness; **honest failures** (no
  fabricated price); history & quote caching to respect provider quotas.
- **Configurable AI:** Hailo/Ollama (on-device, runtime model discovery) or any
  OpenAI-compatible endpoint (OpenAI/OpenRouter/Anthropic/remote Ollama) or disabled;
  set + connection-tested in Settings. Tool-backed grounding, refusal on missing data,
  "not financial advice", no fabricated numbers.
- **API:** documented `/api/v1` (OpenAPI at `/api/docs`), typed models, auth on
  mutations, SSE streaming; data-source / AI / config / reset / refresh / fetch-history
  / scoped-admin endpoints.
- **Data model:** 21 entities (+ `taxes`), Alembic migrations + idempotent boot schema,
  seed-once demo, full reset.
- **Frontend:** original **slate + emerald** design system with **light/dark/system**
  themes; pages Home (now), Portfolio (analytics), **Holdings** (manage), Markets (your
  markets + search), Global (world indices via ETF proxies), Heatmap, News, Snapshot,
  Settings, Instrument. Responsive (mobile drawer nav), benchmark picker, key-stats
  panel, transaction/asset editor, Ask panel, auto PIN prompt, rotation, accessibility
  modes, offline banners, theme-aware ECharts.
- **Security:** Argon2 PIN (auto-prompt on 401/expiry, first-PIN-with-LAN handled),
  signed sessions + auto-lock, CSP + security headers, log redaction, CSV size/row caps
  + formula-injection guard, age-encrypted rotating backups, scoped sudoers helper,
  audit events, no telemetry.
- **Ops & deployment:** native **systemd** (installer renders units; re-rendered on
  update) **or Docker** (`Dockerfile` + `docker-compose.yml`); scripts: install, doctor,
  backup/restore, benchmark, update, uninstall, reset-demo, start-dev, lf-admin;
  background worker (refresh/snapshots/briefing/backup).
- **Tests:** 72 backend (pytest), frontend vitest, Playwright e2e covering the 10
  acceptance criteria.

## 3. Deferred features (v1.1+)

Live external news feed (demo returns synthetic headlines), per-instrument note editing
UI, cross-asset correlation matrix (omitted until sufficient history — correlation ≠
causation), full end-to-end voice capture loop (Protocols + privacy-safe service skeleton
shipped), cash-runway forecasting (needs recurring-expense data), multi-account transfer
reconciliation. See [`ASSUMPTIONS.md`](ASSUMPTIONS.md).

## 4. Exact install commands

```bash
git clone <repo-url> LedgerFrame && cd LedgerFrame
./scripts/install.sh --data-dir /mnt/ledgerframe-data --enable-kiosk --enable-voice false --demo-mode true
./scripts/doctor.sh
```

## 5. Start / stop / update / backup / restore

```bash
sudo systemctl start|stop|restart ledgerframe-api ledgerframe-worker
sudo systemctl enable --now ledgerframe-kiosk        # after desktop session
./scripts/update.sh                                  # manual, non-destructive
./scripts/backup.sh                                  # encrypted (age) + rotate
./scripts/restore.sh <file>.db.age --identity age-identity.txt --force
curl http://127.0.0.1:8321/health                    # health
```

## 6. Hardware verification report

Run `./scripts/doctor.sh` on the device — it produces the report (arch, Pi model, OS,
Hailo identify + model list, NVMe data-dir writability + free space, API health, display
+ Chromium, audio when voice is on). Sample (dev x86_64 box, no Hailo) — see
[`TESTING.md`](TESTING.md): 7 passed · 5 warnings (no Pi/Hailo/Chromium on dev) · 0 failed.
On Pi 5 hardware all checks should pass; warnings indicate optional components.

## 7. Test report

| Suite | Result |
|-------|--------|
| Backend (pytest) | **35 passed** |
| Frontend unit (vitest) | **4 passed** |
| E2E (Playwright, all 10 criteria) | **7 passed** |
| Lint (ruff) / typecheck (tsc) | clean |
| Benchmark | `/health` ~2 ms · `/dashboard/home` ~38 ms (2.2 KB) · RSS ~79 MB (< 700 MB target) |

## 8. Screenshots / walkthrough

In [`screenshots/`](screenshots/): `home`, `portfolio`, `markets`, `heatmap`, `news`,
`snapshot`, `settings`, `ask`. Walkthrough:
- **Home** — clock, market open/closed, portfolio value + day change, top movers, FX,
  market overview, daily briefing, DEMO badge, Ask + Rotate controls.
- **Portfolio** — total value, unrealised P/L, allocation donut, currency exposure, full
  holdings table (FIFO quantities, native prices, base-currency values, day change).
- **Markets / Heatmap / News / Snapshot / Settings** — overview + watchlist, treemap
  heatmap with coverage note, briefing + headlines, net worth/assets/liabilities, and
  base currency / accessibility / security / AI / backup controls.

## 9. External services requiring API keys or paid entitlements

| Capability | Requirement |
|------------|-------------|
| Demo + portfolio + FIFO + net worth | None (works offline) |
| Delayed live quotes | External provider key (e.g. Alpha Vantage free tier) |
| Real-time quotes | Paid market-data entitlement (not bundled) |
| Live news | News-capable provider (not bundled) |
| Local AI | Hailo HAT + `hailo-ollama` + local model (no cloud key) |
| Off-device AI (optional) | `LEDGERFRAME_OPENAI_*` — transmits data off-device |

Details + licensing notes: [`DATA_SOURCES.md`](DATA_SOURCES.md).

## 10. Limitations

- **Not real-time:** bundled providers are demo/delayed/EOD. No real-time claim is made
  anywhere; entitlement and staleness are shown on every quote.
- **Small local AI:** a 1–2B instruct model is modest — answers are concise explanations
  of provided facts, not analysis. The model can be unavailable; the app degrades to
  deterministic, fact-only answers.
- **DEMO data is synthetic** and clearly labelled; do not interpret it as market reality.
- **Validated on x86_64 dev hardware;** Pi 5 + Hailo paths are guarded and exercised via
  mocks. Run `doctor.sh`/`benchmark.sh` on the device to confirm at deployment.
- **Not financial advice** and not a trading platform — by design.
