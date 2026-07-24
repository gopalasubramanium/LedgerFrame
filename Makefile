PYTHON ?= .venv/bin/python

.PHONY: help dev test test-fast lint api-contract api-contract-check migrate

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  %-20s %s\n", $$1, $$2}'

dev: ## Run backend + frontend together (dev; creates a local .env on first run)
	@bash scripts/dev.sh

test: ## Run the backend test suite
	$(PYTHON) -m pytest -q

# R-65 Phase 2 — INNER-LOOP ONLY. pytest-xdist runs the suite across N worker processes, each with
# its own DB/LEDGERFRAME_DATA_DIR keyed by PYTEST_XDIST_WORKER (tests/xdist_isolation.py). This is a
# developer speed-up; it NEVER carries a verdict. GATE/CLOSE verdicts STAY SOLO, uncontended, ordered
# (-p no:randomly) AND randomized — see docs/plans/r65-test-runtime.md and memory
# `backend-suite-run-mechanics`. Promoting a parallel run to verdict status needs a paired-run
# equivalence baseline + a separate owner ruling (doubt -> slow path).
#
# `-n 8` (leave CPU headroom), not `-n auto`, is the recommended inner-loop run: measured on a
# 16-core box, `-n 8` (~4m46s, green) is AS FAST as `-n auto`=16 (~4m45s) because the suite is
# DDL/I/O-bound past ~8 workers — so full oversubscription buys no speed and only adds SQLite
# lock contention, which flakes the two genuine-concurrency tests (test_history_cache_race,
# test_pin_ratelimit) on `database is locked`. Those flakes are NOT cross-worker collisions (per-
# worker DB isolation holds — zero shared-DB signatures) and don't matter to any verdict (solo).
test-fast: ## Run the backend suite in parallel (INNER-LOOP ONLY; verdicts stay solo)
	$(PYTHON) -m pytest -n 8 -q

lint: ## Ruff lint
	$(PYTHON) -m ruff check .

api-contract: ## Re-freeze the OpenAPI contract (docs/specs/API-CONTRACT.json)
	$(PYTHON) scripts/check_api_contract.py --write

api-contract-check: ## Fail if the committed OpenAPI contract is stale (drift check)
	$(PYTHON) scripts/check_api_contract.py

migrate: ## Upgrade the database to the latest migration
	$(PYTHON) -m alembic upgrade head
