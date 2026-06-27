# Changelog

All notable changes to LedgerFrame. Dates are UTC.

## v1.0.3 — 2026-06-27

- Added a minimal, responsive credit footer on every page: "Concept & direction by
  Gopala Subramanium" + social links (website, GitHub, LinkedIn, X, YouTube, Facebook)
  and a PayPal support link. Author/credits section added to the README.

## v1.0.2 — 2026-06-27

- Briefing & Ask no longer leak reasoning-model chain-of-thought (`<think>`) — only
  the final answer is shown (stripped server- and client-side; prompt updated).
- Instrument page: per-instrument **news** (replaces Notes) and a **Your position**
  summary when you hold it (watchlist shown otherwise).
- Global/Markets use named index ETF proxies: US S&P 500 / Nasdaq 100 / Dow Jones,
  Japan Nikkei 225, Europe Euro Stoxx 50, UK FTSE 100, Hong Kong Hang Seng,
  India Nifty 50, Singapore STI.
- Denser layouts (tighter cards/padding) to reduce scrolling.
- Docker build validated (wheel + frontend build); `docker compose up -d --build`.

## v1.0.1 — 2026-06-27

- **Consistent live data:** Home/Markets/Global/benchmark now use live-provider-friendly
  ETF proxies (no raw `^GSPC` "—"); all displayed symbols are refreshed & cached;
  performance vs benchmark defaults to SPY so it renders on live providers.
- **Heatmap** reflects your actual holdings (size = position value).
- **Smart FX** on Home derives pairs from your holdings' currencies.
- **Net-worth history** is reconstructed from holdings × price history (shows immediately).
- **Watchlist management** — create/delete watchlists, add (☆) / remove symbols on Markets.
- **Configurable ticker** source (Markets / Holdings / Global / Watchlist).
- **Richer AI briefing** — narrates the day's portfolio moves when an AI provider is set.
- **Settings completeness** — timezone, staleness, auto-lock, **kiosk**, **web port**,
  **data folder**, backup keep/recipient; plus **Check & update** with a snoozable
  update banner (auto-checks the latest release).
- **Runs anywhere** — added Docker (`Dockerfile` + `docker-compose.yml`); Pi/HAT optional.
- **Legal** page (disclaimer/terms/MIT) + an install-time acknowledgement.
- **Browser icon** (favicon) and richer page metadata.
- Docs: refreshed README (with a table of contents), ARCHITECTURE, DELIVERY; added
  PROMOTION playbook. 75 backend tests + e2e green.

## v1.0.0 — 2026-06-27

First public release. A private, local-first personal financial intelligence
display for Raspberry Pi 5 (or any machine / Docker).

### Core
- Deterministic portfolio engine: FIFO cost basis (buy/sell/split/bonus/dividend/
  interest/fees/taxes), multi-currency valuation + FX, realised/unrealised P/L,
  income & yield, net worth with liabilities, allocations, concentration.
- Benchmarked performance analytics with selectable index and risk stats
  (return, vs-benchmark, max drawdown, annualised volatility); DB-cached history.
- All money handled as `Decimal`; the AI never computes financial values.

### Data & AI
- Switchable market providers (`mock` / `csv` / `alphavantage`), applied in-process.
  Honest failures (unavailable shows "—", never a fabricated price); quote & history
  caching to respect provider quotas; crypto + FX support; ETF proxies for indices.
- Free RSS/Atom news feeds (configurable) + grounded AI briefing.
- Configurable AI provider: on-device Hailo/Ollama or any OpenAI-compatible endpoint
  (OpenAI/OpenRouter/Anthropic/remote Ollama), or disabled — set & tested in Settings.

### UI
- Original slate + emerald design with light / dark / system themes; responsive
  (desk display + mobile). Pages: Home, Portfolio, Holdings, Markets, Global, Heatmap,
  News, Snapshot, Settings, Instrument. Benchmark picker, key-stats panel, transaction
  & asset editor, grounded Ask panel, dashboard rotation, accessibility modes.

### Security & ops
- Argon2 PIN with auto-prompt on expiry, signed sessions, auto-lock; CSP + security
  headers; encrypted (`age`) rotating backups; CSV injection guards; no telemetry.
- Deploy via native systemd (guided, idempotent, non-destructive installer) or Docker
  (`docker compose up`). Scoped sudoers helper for in-app system controls. Scripts for
  install/doctor/backup/restore/update/benchmark/reset.

### Tests
- 72 backend (pytest) + frontend (vitest) + Playwright e2e covering the acceptance
  criteria; ruff + tsc clean.
