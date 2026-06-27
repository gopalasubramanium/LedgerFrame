# Changelog

All notable changes to LedgerFrame. Dates are UTC.

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
