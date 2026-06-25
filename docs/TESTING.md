# Testing

## Backend (pytest)

```bash
source .venv/bin/activate
python -m pytest              # all
python -m pytest tests/unit   # fast unit tests
python -m pytest --cov=app    # with coverage
```

Tests run against a throwaway temp data dir (see `tests/conftest.py`) with AI
disabled — which is exactly the "no Hailo" path, so the suite doubles as offline
coverage.

| Area | File |
|------|------|
| FIFO cost basis (buys, partial/cross-lot sells, splits, dividends, order-independence) | `tests/unit/test_fifo.py` |
| Money quantization, FX conversion, CSV formula-injection guard | `tests/unit/test_money_and_fx.py` |
| Argon2 PIN + signed token expiry/tamper | `tests/unit/test_security.py` |
| Valuation, manual assets/liabilities netting, staleness labelling, no fabricated price, CSV import + size cap | `tests/integration/test_portfolio_engine.py` |
| AI grounding: facts with timestamps, no fabrication, refusal on no data, disclaimer | `tests/integration/test_ai_grounding.py` |
| API: demo boot, seeded holdings, watchlist create, AI without Hailo, **PIN lock blocks mutations**, wrong PIN | `tests/integration/test_api_auth.py` |

## Frontend (Vitest)

```bash
cd frontend
npm test            # unit tests (format helpers, etc.)
npm run lint        # tsc --noEmit type check
```

## End-to-end (Playwright)

Maps 1:1 to the acceptance criteria in the build brief. Start the backend serving
the **built** SPA, then run the specs:

```bash
# 1) build frontend and start API on fresh demo data
(cd frontend && npm run build)
LEDGERFRAME_DATA_DIR="$PWD/data" LEDGERFRAME_AI_ENABLED=false \
  uvicorn app.main:app --port 8321 &

# 2) run e2e
cd frontend && npx playwright test
```

| Criterion | Covered by |
|-----------|-----------|
| 1. Dashboard opens in demo mode | `1. dashboard opens in demo mode` |
| 2. Portfolio shows seeded holdings | `2. portfolio page shows seeded holdings` |
| 3. Watchlist can be created/seen | `3. a watchlist can be created` |
| 4. Dashboard rotation works | `4. dashboard rotation toggles` |
| 5–7. AI shows source timestamps & doesn't invent values | `5 & 6 & 7. AI answer …` |
| 8. PIN lock blocks protected actions | `8. PIN lock blocks protected actions` (runs last; mutates state) |
| 9. Works without Hailo | `9 & 10. app works without Hailo …` (AI disabled) |
| 10. Works without external provider | `9 & 10. …` (demo mode) |

> The PIN test sets a PIN, so reset demo data between full e2e runs:
> `./scripts/reset-demo-data.sh` (or `rm -rf data` before relaunching).

## Latest results (dev machine, x86_64, demo mode)

- Backend: **35 passed**.
- Frontend unit: **4 passed**.
- E2E: **7 passed** (all 10 acceptance criteria).
- Benchmark: `/health` ~2 ms, `/dashboard/home` ~38 ms (2.2 KB), app RSS ~79 MB.
