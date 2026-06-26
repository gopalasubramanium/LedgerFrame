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

### `csv`
Reads `<data-dir>/imports/<SYMBOL>.csv` with header
`date,open,high,low,close,volume`. Latest row → quote (`end-of-day`). Symbols
without a CSV fall back to `mock` so the dashboard stays populated. 10 MB/file cap.

### `external` — Alpha Vantage (opt-in reference adapter)
Included as a worked example of integrating a real vendor.

- **Enable:** `LEDGERFRAME_MARKET_PROVIDER=alphavantage` and
  `LEDGERFRAME_MARKET_API_KEY=<your key>`.
- **Before relying on it**, review Alpha Vantage's current API docs, **rate limits**
  (free tier is very limited), and **licensing / permitted use**. Quotes are labelled
  `delayed`; we make no real-time claim.
- The adapter rate-limits itself (serialised requests) and **falls back to mock**
  (labelled `unavailable`) on any error, so the dashboard never breaks.
- Get a key: <https://www.alphavantage.co/support/#api-key>.

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
