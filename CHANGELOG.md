# Changelog

All notable changes to LedgerFrame. Dates are UTC.

## v1.2.0 — 2026-06-28

- **New free data provider: Yahoo Finance (no API key).** Select `yahoo` in
  Settings → Data source for live **real index levels** (S&P 500, Nasdaq, FTSE,
  Nikkei, Hang Seng, Nifty, STI, DAX, Euro Stoxx…), global equities
  (`RELIANCE.NSE`, `VOD.L`, `7203.T`), FX and crypto — each in its own currency,
  converted to your base via FX. No key, no signup.
- **Global page shows real indices** on index-capable providers (Yahoo) in each
  market's local currency, instead of ETF proxies. Alpha Vantage/mock keep the ETF
  proxies (AV has no usable raw-index endpoint — validated against their docs/API).
- Yahoo's public endpoint rate-limits bursts, so the provider **paces** requests
  (serialized, ~1.5s apart, with 429 backoff) and serves the cache on page load
  while the worker refreshes gradually; throttled symbols show "—" (never fake),
  and FX/search fall back to the demo provider so valuation never breaks.

## v1.1.1 — 2026-06-28

- **Ask now shows live progress.** Instead of a blank pause, the Ask panel
  immediately shows an animated "thinking" indicator with a staged message
  ("Gathering your portfolio data" → "Analyzing with the AI model"), an elapsed
  timer, and a "local/reasoning models can take longer" hint — plus a **Stop**
  button and a blinking caret while the answer streams. The input auto-focuses.
- **PIN screen accepts the keyboard** (digits, Backspace, Enter) as well as the
  on-screen keypad.
- **Fixed a concurrency crash** ("UNIQUE constraint failed: quotes.instrument_id"):
  concurrent dashboard requests that refreshed the same symbol could collide and
  500 ("Unable to load dashboard"). Quote writes are now an atomic upsert and
  instrument creation is race-safe.

## v1.1.0 — 2026-06-28

- **Smarter AI assistant — it now uses the right data and reasons over it.**
  - **Intent-routed grounding:** questions are matched to the relevant dataset —
    world indices (Global/Markets), net worth (assets/liabilities), performance &
    risk (return, 1Y vol, max drawdown, return/vol, concentration, income/yield),
    allocation by asset class or currency, top holdings, movers, news headlines, or
    a specific ticker. "How did the markets do?" now pulls the **global indices**
    (not your watchlist), and portfolio questions are anchored with the headline
    numbers — so answers are relevant and rich.
  - **Analyst-grade prompt:** the model now compares, ranks and connects the facts
    (what drove the day, concentration, vs. benchmark) instead of reciting them —
    while staying strictly grounded (no invented numbers).
  - Fact numbers are cleanly formatted (no raw 14-decimal percentages) and
    allocation weights use gross assets (never >100%).
- **Refresh buttons** for the **Daily briefing** (Home & News) and **Headlines**
  (Home & News) — regenerate the AI briefing or re-pull RSS on demand, with toast
  feedback. The briefing now also relates your portfolio to how markets did.

## v1.0.14 — 2026-06-28

- **Catches the missing-port mistake in AI base URLs.** A base URL without a port
  (e.g. `http://192.168.0.12/v1`) silently tries the default web port and gets
  refused. The connection test now detects this and says exactly what to do:
  "the URL has no port — Ollama listens on 11434, use `http://<host>:11434/v1`".
  The Settings field label/placeholder now show the port explicitly. (The app
  stores/round-trips the URL verbatim — verified — so once the port is included it
  works.)

## v1.0.13 — 2026-06-28

- **Actionable AI connection errors.** "Saved, but not reachable: …ConnectError:
  All connection attempts failed" was opaque. The connection test now names the
  real cause — *connection refused* (with the `OLLAMA_HOST=0.0.0.0` hint),
  *timed out / no route* (subnet/firewall), or *can't resolve the host* — and
  reminds you the connection is made from the **device running LedgerFrame** (the
  Pi), not your laptop. README gains an AI troubleshooting note.
  (The app's probe is verified working; an unreachable endpoint is a network issue
  between that device and the model server.)

## v1.0.12 — 2026-06-28

- **Much better AI answers + reasoning models (e.g. Ollama qwen3) now work.**
  - Tighter system prompt → concise, plain-prose answers (2-4 sentences), no
    markdown headings, no "let's analyze" preamble, and no mischaracterising
    instruments (it was calling stocks "tokens"/"coins").
  - Reasoning models stream their chain-of-thought in a separate field and burn a
    large share of the token budget before answering — the old 800-token cap cut
    the answer off (or produced nothing). The budget is now 4000 (a ceiling only),
    so the answer completes; the reasoning is still hidden.
  - Facts sent to the model are filtered/de-duplicated and capped for a precise,
    focused prompt.
  - Verified end-to-end against a real LAN Ollama (`qwen3.6`): clean, complete,
    correctly-grounded answers.
- **Migration tests slimmed** — moved the migrate logic to `app.db.migrate` and
  test it in-process; the suite no longer spawns subprocesses (seconds, not
  minutes).

## v1.0.11 — 2026-06-28

- **AI answers now actually appear (Ask was returning nothing).** The model
  connected, but several failure modes were swallowed silently, leaving an empty
  box. Fixes:
  - **Errors are surfaced** — an HTTP error or unreachable model now shows a clear
    reason *and* the underlying data, instead of nothing.
  - **Reasoning models handled** — a model that emits only `<think>…</think>` (so
    the client stripped everything) now falls back to the data answer.
  - **Non-streaming fallback** — if streaming yields nothing, the request is retried
    non-streamed (some Ollama models/servers don't stream cleanly).
  - **Longer timeout** (default 120s) and bigger token budget (800) for slow local
    LLMs and reasoning models.
  - **Smarter prompt** — facts mentioned by ticker in your question (e.g. "how is
    AAPL") are now included; facts are de-duplicated before prompting.
- Verified end-to-end against streaming-OK, reasoning-only, HTTP-500, and
  stream-empty providers — every case now returns a useful answer.

## v1.0.10 — 2026-06-28

- **Base currency & AI config now apply in-process — no restart needed.** Root
  cause: systemd starts the service with `.env` loaded as an `EnvironmentFile`, so
  each `LEDGERFRAME_*` is an OS env var that pydantic ranks **above** the `.env`
  file — so rewriting the file alone did nothing until a restart. A new `apply_env`
  helper updates `os.environ` too, so `reload_settings()` actually takes effect.
  This fixes both the base-currency save and the AI provider switch.
- **Remote Ollama / OpenAI-compatible AI now works.** Because of the bug above,
  saving a new AI provider rebuilt the *old* one and the connection test reported
  the wrong thing. Now the new provider is built and **really probed** — Settings
  shows *reachable* / *unreachable* / *model-not-found* (with the server's model
  list). Point it at `http://<host>:11434/v1` with a pulled model and Ask uses it.
- **Instrument names shown, not just tickers.** Holdings, movers, Markets, Global
  and the instrument page now show the company/fund **name** with the ticker as a
  secondary label (names are resolved from the provider and cached). Falls back to
  the ticker when no name is known.
- **Aligned figures.** Compact quote lists (Home Markets/Watchlist/FX, Global,
  movers) now use a shared CSS grid so price and change columns line up across
  rows instead of drifting with each row's width.

## v1.0.9 — 2026-06-28

- **Actually fixes the "table accounts already exists" migration error.** v1.0.8's
  detection only checked whether the `alembic_version` *table* existed — but a
  previously-failed `alembic upgrade` leaves that table **present but empty**, so
  the baseline was never stamped and the upgrade still ran from scratch. The
  migration runner now checks for a real version **row**, stamps the baseline when
  missing, and force-stamps `head` as a final safety net so the update never dumps
  a traceback. Verified against the empty-`alembic_version` state.

## v1.0.8 — 2026-06-28

- **Fixed the noisy "table accounts already exists" error during update.** The app
  bootstraps fresh databases with `create_all()`, so an existing DB has the current
  schema but no Alembic stamp — and `alembic upgrade head` then tried to re-create
  existing tables. A new `scripts/db_migrate.py` adopts the schema (stamps the
  baseline) when needed, then upgrades; the initial-taxes migration is now
  idempotent. Handles all cases: fresh DB, create_all DB, and already-stamped DB.
  (The error was harmless — the app worked regardless — but it's gone now.)

## v1.0.7 — 2026-06-27

- **Base currency now applies instantly, everywhere.** Changing it in Settings
  previously wrote a DB row the valuation engine never read (it reads the env), so
  pages kept showing the old currency. It's now persisted to `.env`, reloaded
  in-process, the FX cache is cleared, the worker is restarted, and the page
  reloads — so Home and every other page re-report in the chosen currency.
- **AI "Save & test" actually tests the connection.** The OpenAI-compatible
  provider (OpenAI / OpenRouter / Anthropic / **remote Ollama**) now really probes
  the endpoint and reports *unreachable*, *auth rejected*, or *model not found*
  (listing the models the server has) instead of always claiming "Connected". For
  remote Ollama use `http://<host>:11434/v1` and a model you've pulled.
- **"Restart services" works.** Restarting the API from inside its own request
  always looked "failed" (it killed the request). Restart now runs detached in its
  own cgroup and returns immediately; a new safe `restart-worker` is used after
  config changes (data source / base currency) so the worker reloads without
  dropping the API response.

## v1.0.6 — 2026-06-27

- **FX cross rates fixed (the real currency bug).** Foreign holdings showed the
  right symbol (₹/£/¥) but the **converted base value was ~13% off** because the
  provider's *direct* exotic crosses (e.g. Alpha Vantage INR→SGD) are unreliable.
  All conversions are now **triangulated through USD** (USD→INR × USD→SGD), the
  legs providers quote accurately — so base-currency totals are correct.
- **One-click update made reliable and observable.** It now runs detached in its
  own cgroup (survives the API restart), drops to the owning user via a **login
  shell** so `npm`/`uv` are actually found, sets `safe.directory`, and **writes a
  live log + status** to `<data>/logs/update.{log,status}`. The UI polls this and
  shows progress, **surfaces errors instead of silently doing nothing**, and
  reloads when the new version is live. New endpoint: `GET /system/update-status`.
- **Global activity feedback + double-click guard.** Every system action now shows
  a spinner toast while running and a success/error toast when done, with a header
  "Working…" pip. Re-triggering an action that's still running flashes
  "already running — please wait…" instead of firing a duplicate request.
- Refreshed documentation screenshots (now showing multi-currency holdings).

## v1.0.5 — 2026-06-27

- **Multi-currency, done by market parlance.** A foreign holding is now valued and
  displayed in its **native trading currency** (e.g. `HDFC.BSE` shows ₹, not US$),
  then converted to your base currency via FX for portfolio totals. The trading
  currency is inferred from the exchange suffix (`.BSE`/`.NSE`→INR, `.L`→GBP,
  `.T`→JPY, `.HK`→HKD, `.TO`→CAD, `.AX`→AUD, `.SI`→SGD, `.DE`/`.PA`/…→EUR, etc.)
  across instrument creation, live quotes, valuation, and the markets/instrument
  pages — so existing holdings are corrected too, no re-entry needed. The
  transaction form auto-fills the currency when you type a suffixed symbol.
- **Charts no longer vanish on hover.** With animation disabled, ECharts'
  hover-emphasis was re-clipping the area/line to nothing until the mouse left;
  emphasis is now disabled on the line/area series so the chart stays put while
  you read the tooltip values.

## v1.0.4 — 2026-06-27

- **Fixed one-click "Update now"** (previously failed with "Update could not run").
  The update now launches **detached in its own systemd transient unit**, so it
  survives the API/worker restart it performs (a child process was being killed
  mid-update). `update.sh` is now privilege-aware: when the root helper runs it,
  code/build/git steps drop to the owning user (correct file ownership, no git
  "dubious ownership"), while the service restart runs as root. The UI now **polls
  the version endpoint until the new build is live**, then reloads — no longer
  bound by the request timeout, and works through the brief restart.

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
