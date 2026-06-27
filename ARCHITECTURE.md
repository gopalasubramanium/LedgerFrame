# LedgerFrame — Architecture

## Overview

LedgerFrame is a modular, local-first application with a clear separation between
a **deterministic financial core** and **pluggable providers** (market data, AI,
voice). Nothing in the UI depends on a specific vendor, and the financial engine
never delegates calculation to an LLM.

```
┌──────────────────────────────────────────────────────────────────┐
│ Chromium kiosk → React SPA (Vite, TS, Tailwind, ECharts)           │
│        │ same-origin fetch / SSE                                   │
└────────┼───────────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ FastAPI (127.0.0.1:8321)                                           │
│  ├─ /api/v1 routes (typed Pydantic models, auth on mutations)      │
│  ├─ Services (deterministic):                                      │
│  │     portfolio (FIFO), fx, market (cache+staleness), briefing,   │
│  │     backup, csv_import                                          │
│  ├─ AI grounding layer (tools → facts → prompt → stream)           │
│  └─ Provider registries:                                           │
│        market: mock | csv | external(opt-in)                       │
│        ai:     hailo | disabled | openai_compatible(opt-in)        │
│        voice:  whispercpp/vosk + piper (optional)                  │
└────────┬───────────────────────────────┬───────────────────────────┘
         ▼                               ▼
   SQLite (WAL) on USB NVMe       hailo-ollama @127.0.0.1:8000 (Hailo-10H NPU)
   (SQLAlchemy + Alembic)
```

### Services (systemd)

| Unit | Role | Binds / runs as |
|------|------|-----------------|
| `ledgerframe-api` | FastAPI + serves built SPA | `127.0.0.1:8321`, service user |
| `ledgerframe-worker` | market refresh, snapshots, briefing, cache prune, backups | service user |
| `ledgerframe-kiosk` | Chromium full-screen (no `--no-sandbox`) | desktop user |
| `ledgerframe-voice` | optional local STT/TTS | service user (group `audio`) |
| `hailo-ollama` | (external) NPU inference REST service | provided by Hailo install |

All app units use `Restart=on-failure`, journald logging, memory/CPU limits, and
systemd sandboxing (`ProtectSystem=strict`, `ReadWritePaths` limited to the data
dir + repo). Each is independently restartable and health-checkable.

## Technology

- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async) + Alembic,
  APScheduler, httpx, argon2-cffi, itsdangerous.
- **Frontend:** React 18 + TypeScript, Vite, Tailwind (custom token theme),
  Apache ECharts (canvas, tree-shaken imports).
- **Storage:** SQLite (WAL) on the data dir (USB NVMe on a Pi). Money stored as TEXT
  and round-tripped through `Decimal` to avoid float affinity.
- **Packaging / deployment:** `uv`/venv for backend, npm for frontend build.
  Two first-class options:
  - **Native systemd** (default on the Pi) — installer renders the units.
  - **Docker** (any host) — multi-stage `Dockerfile` + `docker-compose.yml` run the
    API + worker with a persistent data volume. The Pi and Hailo HAT are optional;
    without them you lose the kiosk + on-device AI only (AI falls back to a remote
    Ollama / OpenAI-compatible endpoint, or deterministic answers).

## Runtime configuration (no restart)

Most settings are editable from the UI and applied **in-process**: `reload_settings()`
re-reads `.env` and resets the provider/registry/FX caches, so switching market or
AI provider, theme, currency, etc. takes effect immediately. Service-level actions
(restart, LAN/voice/AI/kiosk toggles) go through a scoped, PIN-gated root helper
(`/usr/local/sbin/ledgerframe-admin`) — see SECURITY.md.

## Data flow & key decisions

### Money is `Decimal`, end to end
`app/core/money.py` provides `D`, `money` (2dp), `price` (6dp). The DB uses a
`DecimalText` column type. Floats appear only at the JSON boundary via `to_display`.

### Deterministic engine, AI only explains
`app/services/portfolio.py` computes FIFO cost basis, valuations, allocations, and
movers. The AI layer (`app/ai/`) gathers these **already-computed** numbers as
`GroundingFact`s and passes them to the model with a system prompt that forbids
inventing or recalculating values. If the NPU is unavailable, a deterministic
template renders the facts directly — the feature degrades, never breaks.

### Provider abstraction
`MarketDataProvider` and `AIProvider` are `Protocol`s. Registries
(`get_provider`, `get_ai_provider`) return whatever is configured and fall back to
safe defaults (mock market data, disabled AI) on any error. Adding a vendor means
adding one adapter — no business-logic changes.

- **Market:** `mock` (DEMO), `csv`, `alphavantage` (US equities/ETFs, crypto via the
  currency endpoint, FX; raw indices unsupported → the Global page uses ETF proxies).
- **AI:** `hailo`/Ollama (on-device), `openai_compatible` (OpenAI/OpenRouter/
  Anthropic/remote Ollama), `disabled`. Configured in Settings.

### Honest live data + caching
A live provider that can't serve a symbol returns **unavailable (no price)** — the
app never fabricates a price and never writes a null into the DB. Page loads use
`display_quote()`: serve fresh cache, and only do a live fetch for "cheap" providers
(`mock`/`csv`); rate-limited providers (Alpha Vantage, `fetch_on_demand=False`) serve
cache and are refreshed by the worker or the Settings **Refresh** button. Daily
history is cached in `price_history` (`get_history_cached`, ~12h freshness) so a page
load can't exhaust a provider's quota.

### Staleness is explicit
`app/services/market.py` stores `source`, `entitlement`, `market_time`, and
`received_at` on every quote. `get_cached_quote` computes staleness against
`LEDGERFRAME_STALE_AFTER_SECONDS` and labels stale data `cached`. Live data is
never silently replaced by stale data, and entitlement (real-time / delayed /
end-of-day / cached / unavailable) is surfaced in the UI on every quote.

### Offline-first
The React `useApi` hook keeps the last good payload and flags it `stale` after a
failed refresh, so panes show last-known data with a warning banner rather than
going blank. Portfolio, history, notes, and manual entries work entirely offline.

## AI integration (Hailo AI HAT+ 2)

- Client: `app/providers/ai/hailo_ollama.py` talks to `hailo-ollama` at
  `http://127.0.0.1:8000`, discovers models via `/hailo/v1/list`, and chats via
  `/api/chat` with streaming and strict timeouts.
- **No hard-coded model versions.** Models are discovered at runtime; the client
  auto-selects the smallest instruct model (target 1–2B) unless `LEDGERFRAME_AI_MODEL`
  is set. A larger model is used only if explicitly configured and present.
- Expected install (documented, not run automatically):
  ```bash
  sudo apt update && sudo apt full-upgrade -y
  sudo rpi-eeprom-update -a
  sudo apt install -y dkms hailo-h10-all
  ```
  Then install `hailo-ollama` and pull a model into the GenAI model zoo. See
  `docs/DATA_SOURCES.md` and `docs/ASSUMPTIONS.md` for the variables involved.

## Hardware constraints honoured

- The **PCIe lane is reserved for the AI HAT+ 2** — no NVMe-HAT/PCIe-storage
  assumptions. The NVMe is **USB 3, storage only**; the installer never formats or
  repartitions it and aborts if the data dir isn't already mounted/writable.
- All mutable data (DB, cache, imports, logs, backups, audio) lives under
  `LEDGERFRAME_DATA_DIR` (default `/mnt/ledgerframe-data`).
- The app runs without the AI HAT and without a network; AI and live data degrade
  gracefully.

## Repository layout

```
app/            FastAPI backend
  core/         config, money, logging, security
  db/           engine/session, models, Alembic migrations
  providers/    market/ ai/ voice/ adapters (+ registries)
  services/     portfolio, fx, market, briefing, backup, csv_import
  ai/           grounding orchestration, tools, prompts
  api/v1/       routes + dependencies
  seed/         demo data
  worker.py     APScheduler background jobs
frontend/       React + TS SPA (built to frontend/dist, served by the API)
scripts/        install, doctor, backup, restore, benchmark, update, …
systemd/        unit templates
docs/           assumptions, data sources, voice, testing, screenshots
tests/          pytest (unit + integration); frontend has vitest + playwright
```
