# SPDX-License-Identifier: AGPL-3.0-or-later
"""release-readiness Gate A4/A5 (RD-8) — a clean first boot seeds NOTHING.

FAIL-FIRST. Before the fix, the demo seed was triggered by ``settings.is_demo`` — which is defined as
``market_provider == "mock"`` (``app/core/config.py:152-153``) — at ``app/main.py:114-123``. And
``.env.example`` ships ``LEDGERFRAME_MARKET_PROVIDER=mock``.

So **a stranger's default first boot filled their brand-new appliance with synthetic holdings**, and
they never asked for it. The two things had been conflated:

* **mock PRICES** — "I have no market-data key, quote me deterministic numbers"; and
* **seeded PORTFOLIO ROWS** — "invent a person's net worth and put it in my database".

Those are not the same decision, and only the second one is a lie about the user's money. RD-8:
**default first boot is EMPTY; ``--demo-mode`` is the only way to ask for the seed.**

The first test below was RED against that baseline: booting with the shipped defaults seeded rows.
"""

from __future__ import annotations

import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.models import Transaction


async def _boot_and_count_transactions() -> int:
    """Boot the real app through its lifespan (the code path a first boot actually takes)."""
    from app.core.config import reload_settings
    from app.db.base import Base, get_engine, get_sessionmaker
    from app.main import create_app
    from app.providers.market import reset_provider

    reload_settings()
    reset_provider()

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    app = create_app()
    async with app.router.lifespan_context(app), AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ):
        pass

    async with get_sessionmaker()() as s:
        return (await s.execute(select(func.count()).select_from(Transaction))).scalar() or 0


@pytest.fixture
def _clean_env(monkeypatch):
    """The shipped defaults: mock provider, and NOTHING asking for a demo seed."""
    monkeypatch.setitem(os.environ, "LEDGERFRAME_MARKET_PROVIDER", "mock")
    monkeypatch.delenv("LEDGERFRAME_DEMO_SEED", raising=False)


async def test_a_clean_first_boot_seeds_NOTHING_even_with_the_mock_provider(_clean_env) -> None:
    """THE defect. The shipped `.env.example` says `mock`, and that used to mean "invent me a
    portfolio". A new user's database must be **empty** until they ask for otherwise."""
    assert await _boot_and_count_transactions() == 0, (
        "a clean first boot seeded demo rows — the user never asked for a synthetic portfolio"
    )


async def test_the_demo_seed_is_OPT_IN_and_still_works_when_asked_for(monkeypatch) -> None:
    """The seed is not removed — it is made explicit. `--demo-mode` must still fill the demo."""
    monkeypatch.setitem(os.environ, "LEDGERFRAME_MARKET_PROVIDER", "mock")
    monkeypatch.setitem(os.environ, "LEDGERFRAME_DEMO_SEED", "true")

    assert await _boot_and_count_transactions() > 0, (
        "--demo-mode was requested and no demo data appeared"
    )


async def test_mock_PRICES_are_still_mock_prices_without_the_seed(_clean_env) -> None:
    """Decoupled, not conflated: `provider=mock` still means deterministic quotes (and the DemoBadge
    still tells the truth about them). It just no longer means "and also invent a portfolio"."""
    from app.core.config import get_settings, reload_settings

    reload_settings()
    s = get_settings()
    assert s.is_demo is True, "mock prices are still demo prices — that flag is about PRICING"
    assert s.demo_seed is False, "…but nothing asked for seeded rows"


def test_env_example_does_not_imply_a_seeded_portfolio() -> None:
    """A5 — the shipped template must not quietly hand a stranger someone else's net worth."""
    from pathlib import Path

    env = Path(__file__).resolve().parents[2] / ".env.example"
    text = env.read_text()
    assert "LEDGERFRAME_DEMO_SEED" in text, ".env.example must state the seed setting explicitly"
    line = next(ln for ln in text.splitlines() if ln.startswith("LEDGERFRAME_DEMO_SEED="))
    assert line.split("=", 1)[1].strip().lower() in ("false", "0", ""), (
        "the shipped default must NOT seed a demo portfolio"
    )
