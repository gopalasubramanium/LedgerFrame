# Data Sources

LedgerFrame is vendor-neutral. The UI depends only on the `MarketDataProvider`
contract; providers are swappable via `LEDGERFRAME_MARKET_PROVIDER`.

## Entitlement labelling

Every quote carries an explicit entitlement, shown in the UI and surfaced to the
AI as a fact. We never claim real-time unless a provider confirms that entitlement.

| Label | Meaning |
|-------|---------|
| `real-time` | Provider confirms real-time entitlement (none of the bundled providers do) |
| `delayed` | Delayed feed (typical free tiers, the demo provider) |
| `end-of-day` | Last close (CSV provider) |
| `cached` | Served from local cache, older than the stale threshold |
| `unavailable` | No data; **no value is fabricated** |

`LEDGERFRAME_STALE_AFTER_SECONDS` (default 900) controls when cached data is flagged
stale in the UI.

## Bundled providers

### `mock` (default — DEMO)
Synthetic, deterministic data. No key, no network. Everything labelled DEMO and
`delayed`. Ideal for evaluation and offline kiosks.

### `yahoo` — Yahoo Finance (free, no key)
Uses Yahoo's public chart/search JSON endpoints. **Best free live option.**
- **Covers:** real **index levels** (`^GSPC`, `^NDX`, `^DJI`, `^FTSE`, `^GDAXI`,
  `^STOXX50E`, `^N225`, `^HSI`, `^NSEI`, `^STI`), global equities
  (`RELIANCE.NSE`→`RELIANCE.NS`, `HDFC.BSE`→`HDFC.BO`, `VOD.L`, `7203.T`), FX
  (`EURUSD=X`) and crypto (`BTC`→`BTC-USD`) — each in the listing's own currency.
- **Capability flag** `supports_indices=True`: the **Global** page shows real index
  levels (local currency) instead of ETF proxies.
- **Rate limiting:** the public endpoint throttles bursts (HTTP 429), so the provider
  **serializes** calls with a ~1.5s minimum interval + 429 backoff, and runs with
  `fetch_on_demand=False` so page loads serve the **cache** while the worker refreshes
  symbols one at a time. Throttled symbols show `unavailable` ("—"), never a fabricated
  price; FX/search fall back to `mock` so valuation keeps working. Best for a modest
  symbol set; a keyed provider is steadier for heavy always-on use.

### `csv`
Reads `<data-dir>/imports/<SYMBOL>.csv` with header
`date,open,high,low,close,volume`. Latest row → quote (`end-of-day`). Symbols
without a CSV fall back to `mock` so the dashboard stays populated. 10 MB/file cap.

### `external` — Alpha Vantage (opt-in)
- **Enable from the UI:** Settings → *Data source* → choose `alphavantage`, paste
  your key, Save (applies immediately, no restart). Or set
  `LEDGERFRAME_MARKET_PROVIDER=alphavantage` + `LEDGERFRAME_MARKET_API_KEY` in `.env`.
- **Honest failures:** if a symbol can't be served (rate limit, unsupported), the
  quote is `unavailable` (shows "—"). We **never** substitute a fabricated/demo
  price for a live provider. **Settings → Refresh live prices** lists exactly which
  symbols updated and which returned no data (and why).
- **History is cached** in the DB (`price_history`) and re-fetched at most ~once/12h
  per symbol, so page loads don't spend your quota. **Settings → Fetch & cache
  history** backfills history for newly-added holdings only (skips ones already cached).
- **What Alpha Vantage does / doesn't cover** (important):
  - ✅ **US equities & ETFs** via `GLOBAL_QUOTE` / `TIME_SERIES_DAILY`.
  - ✅ **Crypto** (BTC, ETH, …) — handled via AV's currency endpoint.
  - ✅ **FX** via `CURRENCY_EXCHANGE_RATE`.
  - ✅ **Indices — premium only** via the **Index Data API** (`function=INDEX_DATA`).
    With a premium key the **Global** page shows real US index levels (`SPX`, `NDX`,
    `DJI`, mapped from `^GSPC`/`^NDX`/`^DJI`). The response is parsed defensively and,
    if the endpoint isn't available (free key / unsupported symbol), the page **falls
    back per-entry to the ETF proxy** (`SPY`, `QQQ`, …) — no error, no fabricated
    value. Non-US indices use proxies on AV (Yahoo serves all ^ indices).
  - ❌ **Most non-US tickers** unless using AV's region suffix (e.g. `TSCO.LON`).
    For unsupported holdings, add them as **manual-priced** holdings instead.
- Quotes are labelled `delayed`; we make no real-time claim. Free tier ≈ 25
  req/day (premium raises this). Get a key: <https://www.alphavantage.co/support/#api-key>.

> Adding another vendor = implement `MarketDataProvider` in
> `app/providers/market/`, register it in `get_provider`. No business-logic changes.
> Keys come only from env/secrets; **no financial website is ever scraped.**

## News

Two free, no-key sources feed the News page, merged and shown with source + time:

1. **RSS/Atom feeds (free, no key).** A configurable list of feed URLs (Settings →
   *News feeds*) is fetched and parsed locally. Ships with a small set of broadly
   available finance feeds as defaults; replace them with your own at any time, or
   clear the list to disable RSS. Unreachable/malformed feeds are skipped, never
   fatal. This is the recommended way to get real headlines for free.
2. **Provider news.** The demo/CSV providers return synthetic or empty headlines;
   an external provider that implements `get_news` adds vendor headlines.

The AI briefing summarises only retrieved articles + computed market/portfolio
facts — it never invents a headline.

## AI providers (configurable in Settings)

Settings → *AI assistant* configures the AI without editing files:
- **Hailo / Ollama (local, on-device)** — set the service URL (e.g. your Ollama
  box `http://192.168.0.x:11434` or the Hailo `hailo-ollama` at `:8000`) + model.
- **OpenAI-compatible** — any endpoint exposing `/v1/chat/completions`: **OpenAI,
  OpenRouter, Anthropic, or a remote Ollama** (presets prefill base URL + model).
  ⚠ This sends prompts (incl. your portfolio facts) off-device; local keeps them on-device.
- **Disabled** — deterministic, fact-only answers.

Saving applies in-process and tests connectivity. Regardless of provider, the AI
only ever explains verified facts and never computes financial numbers.

## AI models (Hailo)

- The local `hailo-ollama` service (default `http://127.0.0.1:8000`) exposes
  available models via `/hailo/v1/list`. LedgerFrame discovers them at runtime — **no
  version is hard-coded** — and auto-selects the smallest instruct model (1–2B) unless
  `LEDGERFRAME_AI_MODEL` is set.
- Expected base install (run yourself; not automated):
  ```bash
  sudo apt update && sudo apt full-upgrade -y
  sudo rpi-eeprom-update -a
  sudo apt install -y dkms hailo-h10-all
  ```
  Then install `hailo-ollama` and pull/sideload a GenAI model. If a local Debian
  package or model file is required, point your install at it explicitly (the path
  is your local choice; LedgerFrame does not download models).

## Services requiring keys or paid entitlements

| Capability | Needs |
|------------|-------|
| Demo dashboards / portfolio / FIFO / net worth | **Nothing** — works offline |
| Delayed live quotes | An external market provider + API key (e.g. Alpha Vantage free) |
| Real-time quotes | A paid market-data entitlement (not bundled) |
| Live news | A news-capable provider (not bundled) |
| Local AI explanations | Hailo HAT + `hailo-ollama` + a local model (no cloud key) |
| Off-device AI (optional) | `LEDGERFRAME_OPENAI_*` — sends data off-device; off by default |
