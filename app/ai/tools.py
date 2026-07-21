# SPDX-License-Identifier: AGPL-3.0-or-later
"""Backend "tools" that gather verified structured facts for the AI layer.

These are the ONLY source of numbers the assistant may reference. Each returns a
list of GroundingFact with provenance and timestamps. The AI never calls market
providers directly and never computes values itself.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.money import format_fact_by_kind, format_fact_display, format_pct_display
from app.models import Watchlist
from app.schemas.ai import GroundingFact
from app.services.figure_registry import canonical_label, figure_for_label
from app.services.market import get_cached_quote
from app.services.portfolio import top_movers, value_portfolio

# ⊕ R-54 F-3 — `_fmt` IS GONE. It was `f"{value:,.2f} {ccy}"`, a second home for rendering logic,
# and it rendered a sub-cent token as `0.00 USD` — precisely what D-105 exists to prevent
# (`money.py:19-20`, verbatim). All rendering now lives in `money.py`; the pack's ratified
# conventions are the named variant `format_fact_display`. See its docstring for what did and did
# not change.


# --- FIGURE IDENTITY (AI-surfaces §14-3 / Finding 5, owner-ruled 2026-07-20) -------------------- #
#
# The pack is merged from sources that OVERLAP, and `_dedupe` used to deduplicate by LABEL — so
# two labels for one figure were, to it, two facts. The 0a walk found the result on screen:
#
#     Total unrealised P/L   79,326.30 SGD
#     Unrealised P/L         79326.3 SGD
#
# One figure, twice, one copy raw — on the one list in the product whose job is to let a reader
# check the answer against its basis.
#
# ⚠ IDENTITY IS DECLARED, NEVER INFERRED FROM THE VALUE. The cheap version of this fix — "drop a
# fact whose rendered number already appears" — is a DATA-LOSS BUG waiting for the first user with
# no liabilities: **Net worth** and **Total assets** are then equal, and they are two different
# figures that merely coincide. Collapsing them would delete a fact the reader asked for. A
# coincidence of values is not an identity, so identity is written down here where it can be read
# and argued with.
#
# ⚠ THE CANONICAL LABEL AND THE CANONICAL VALUE CAME FROM DIFFERENT SIDES, which is why this is a
# map and not a choice of winning source. GLOSSARY.md:157/161 make **Unrealised P/L** and
# **Total return** the canonical SPELLINGS — the `performance_facts` side — while the canonical
# VALUES come from `value_portfolio`, the canonical reader, via `portfolio_facts`. Neither source
# was wholly right. So the survivor keeps the winner's value and is RELABELLED to the canonical
# spelling.
#
# ⊕ R-54 Phase 0-2a — ABSORBED. This table WAS `FIGURE_IDENTITY`, a 9-entry map living beside an
# unrelated `term_id` map in `analytics.py`, with no endpoint on either. §9-B ruled ONE registry:
# figure identity → canonical GLOSSARY label → canonical endpoint. It now lives in
# `app/services/figure_registry.py` (services, not ai — `analytics.py` derives from it at 0-2b and
# a portfolio surface must not import the AI package to learn its own figures' names).
#
# The two functions below keep their exact contracts so `_dedupe` is untouched by the move.
def figure_identity(label: str) -> str | None:
    """The figure a fact label names, or None if the label has no declared identity.

    None means "nothing to collide with" — most labels are per-instrument or per-bucket and are
    already unique by label. Only figures a second source can also produce need declaring.
    """
    fig = figure_for_label(label)
    return fig.figure_id if fig else None


def _canonical_label(label: str) -> str:
    return canonical_label(label)


async def portfolio_facts(session: AsyncSession) -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    now = datetime.now(UTC)
    facts = [
        GroundingFact(label="Net worth", value=format_fact_display(val.total_value, base), timestamp=now),
        GroundingFact(label="Total unrealised P/L", value=format_fact_display(val.unrealised_pl, base), timestamp=now),
        GroundingFact(label="Today's change", value=format_fact_display(val.day_change, base), timestamp=now,
                      is_stale=val.has_stale),
    ]
    if val.total_return_pct is not None:
        # ⊕ R-54 F-5. This is the WINNING render for `total_return`: gather_facts prepends
        # portfolio_facts on any portfolio intent, so `_dedupe` (first-wins) keeps THIS fact and
        # drops performance_facts' copy. It rendered `f"{val.total_return_pct}%"` inline — the
        # F-3 "the formatter exists but is bypassed" lesson recurring at the dedupe layer. Routed
        # through money.py's pct variant so the winning site formats like everything else.
        # (Byte-identical below 1000%: total_return_pct is a pre-quantized 2dp Decimal.)
        facts.append(GroundingFact(label="Total return %", value=format_pct_display(val.total_return_pct), timestamp=now))
    return facts


async def movers_facts(session: AsyncSession) -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val, n=3)
    now = datetime.now(UTC)
    facts: list[GroundingFact] = []
    for g in gainers:
        facts.append(GroundingFact(label=f"Gainer {g.label}", value=format_fact_display(g.day_change_base, base),
                                   timestamp=now, is_stale=g.is_stale))
    for loser in losers:
        facts.append(GroundingFact(label=f"Detractor {loser.label}", value=format_fact_display(loser.day_change_base, base),
                                   timestamp=now, is_stale=loser.is_stale))
    return facts


async def allocation_facts(session: AsyncSession, key: str = "asset_class") -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    alloc = val.allocation(key)
    # Use gross (positive) assets as the denominator so weights are a clean share of
    # the asset base — a liability (negative) can't push a class above 100%.
    gross = sum((v for v in alloc.values() if v > 0), Decimal(0)) or Decimal(1)
    now = datetime.now(UTC)
    return [
        GroundingFact(label=f"Allocation ({key}) — {k}",
                      value=f"{format_fact_display(v, base)} ({v / gross * 100:.1f}%)", timestamp=now)
        for k, v in sorted(alloc.items(), key=lambda kv: kv[1], reverse=True)
        if v > 0
    ]


async def watchlist_quote_facts(session: AsyncSession) -> list[GroundingFact]:
    from sqlalchemy.orm import selectinload

    wl = (
        await session.execute(
            select(Watchlist).options(selectinload(Watchlist.items)).limit(1)
        )
    ).scalars().first()
    facts: list[GroundingFact] = []
    if not wl:
        return facts
    # ⊕ R-54 F-4. This read `wl.items[:8]` — and `Watchlist.items` declares no `order_by`
    # (`models/__init__.py:492`), so it arrives in ID order. The fact list therefore followed
    # INSERTION order and could slice away the rows the user had deliberately put at the top.
    # `watchlists.py:34` already sorts explicitly for the page, so the PAGE was right and only the
    # AI's view of it was wrong — grounding that does not mirror what the user sees is a fidelity
    # defect, not a cosmetic one. Sorted here rather than on the relationship: the API already
    # sorts, so a model-level change would alter a shipped surface to fix a bug it does not have.
    for item in sorted(wl.items, key=lambda i: i.sort_order)[:8]:
        from app.models import Instrument

        instr = await session.get(Instrument, item.instrument_id)
        if not instr:
            continue
        q = await get_cached_quote(session, instr.symbol, instr.exchange)
        if q.price is None:
            facts.append(GroundingFact(label=instr.symbol, value="unavailable",
                                       source=q.source, entitlement="unavailable"))
        else:
            facts.append(GroundingFact(
                label=instr.symbol, value=format_fact_display(q.price, q.currency), source=q.source,
                timestamp=q.received_at, entitlement=q.entitlement.value, is_stale=q.is_stale))
    return facts


async def market_facts(session: AsyncSession, limit: int = 14) -> list[GroundingFact]:
    """World indices + cross-asset benchmarks (the Global/Markets data) with % change."""
    from app.api.v1.routes.markets import _GLOBAL_MARKETS, _global_symbol
    from app.services.market import display_quote

    facts: list[GroundingFact] = []
    for items in _GLOBAL_MARKETS.values():
        for proxy, idx, label in items:
            sym = _global_symbol(proxy, idx)
            q = await display_quote(session, sym)
            if q.price is None:
                continue
            chg = f" ({q.change_pct:+.2f}%)" if q.change_pct is not None else ""
            facts.append(GroundingFact(
                label=label, value=f"{format_fact_display(q.price, q.currency)}{chg}", source=q.source,
                timestamp=q.received_at, entitlement=q.entitlement.value, is_stale=q.is_stale))
            if len(facts) >= limit:
                return facts
    return facts


async def news_facts(session: AsyncSession, limit: int = 6) -> list[GroundingFact]:
    """Recent free-RSS headlines (so 'what's in the news' uses the News page data)."""
    import asyncio

    from app.ai.safety import sanitize_untrusted
    from app.services.feeds import fetch_feeds

    try:
        items = await asyncio.wait_for(fetch_feeds(session, limit=limit), timeout=8)
    except (TimeoutError, Exception):  # noqa: BLE001
        items = []
    # Headlines are UNTRUSTED input — neutralise any embedded instructions (B11).
    return [
        GroundingFact(label=f"Headline · {it.source}", value=sanitize_untrusted(it.headline),
                      source=it.source or "news", timestamp=it.published_at)
        for it in items[:limit]
    ]


# The grounding projection for help entries — WIDENED, SCOPED (owner ruling, 2026-07-20;
# AI-surfaces Phase 0.9). It carried `body` alone, so *"a single structured source of truth used
# by BOTH the Help page and the AI"* (`help.py:4-6`) was true of the SOURCE and not of the VIEW:
# the page rendered the whole entry, the model got its opening paragraph. Asked *"why do I have to
# accept terms"* the AI was handed the Legal document's six-article STRUCTURE while the ruled
# answer — declining is a real answer, a changed document re-asks, a reset clears acceptance — sat
# one field away in `interpret`, unread.
#
# TWO TIERS, and the split is the whole design. `body` and `interpret` are the entry's MEANING —
# what the thing is, and what it means for you. `outputs` and `inputs` are structural extras.
#
# ⚠ FOUND WRITING THIS: a single priority list under one budget DROPPED `interpret` from
# `page-legal` — the largest one, and the exact entry whose missing interpretation caused the
# ruling. A budget that discards the most important field first is worse than no budget: it
# succeeds quietly. So the core tier is unconditional and the budget governs only the tail.
#
# ⊕ R-54 Phase 0-3 — THE TIERS ARE PER-CATEGORY, because the corpus has two schemas and the
# original tiers were named from only one of them. §0-C's census: all 29 `category: "Glossary"`
# entries carry `what`/`why`/`improves`/`example` and NONE carries `interpret`/`outputs`/`inputs`,
# so every glossary term projected `body` ALONE — the very failure this widening was ruled to fix,
# landing on the one category tier-1(a) ("what is XIRR") is built from. The ruling was right and
# its census was incomplete; the owner amended it (dated note on the ruling's own record in
# `docs/plans/CURRENT.md`) rather than re-opening the decision.
#
# The SPLIT IS THE SAME IN BOTH: core = the entry's MEANING, unconditional; extra = structural
# detail, budgeted. Only the field NAMES differ, because the two categories are written to
# different schemas.
_HELP_FACT_TIERS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "Glossary": (("body", "what", "why"), ("improves", "example")),
}
_HELP_FACT_DEFAULT = (("body", "interpret"), ("outputs", "inputs"))

# Retained as the default-category names so existing readers/tests keep their meaning.
_HELP_FACT_CORE = _HELP_FACT_DEFAULT[0]
_HELP_FACT_EXTRA = _HELP_FACT_DEFAULT[1]


def _tiers_for(entry: dict) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """(core, extra) field names for an entry's category — the one place tiering is decided."""
    return _HELP_FACT_TIERS.get(entry.get("category", ""), _HELP_FACT_DEFAULT)

# Budget for the OPTIONAL tail only. Whole fields — a field is included entire or not at all, and
# NEVER truncated mid-text. Cutting help prose at a character count would eventually cut a caveat
# in half, and a caveat that stops mid-sentence is worse than one never sent: it reads as complete.
# Measured against the corpus (largest body 763, largest interpret 2,192, largest full entry
# 3,276, mean 717), so the core tier admits every entry whole and this bounds only what follows.
_HELP_FACT_BUDGET = 3600


def _render_help_fact(entry: dict) -> str:
    """One help entry as grounded text: labelled sections, markup stripped, whole fields only.

    STRIPPED for the same reason the page projection strips (`help.py:1352-1357`): the AI reads
    strings, never styling, so `**` markers would land in answers the user reads.
    """
    from app.services.help import strip_markup

    def rendered(field: str) -> str:
        raw = entry.get(field)
        if not raw:
            return ""
        text = strip_markup(raw if isinstance(raw, str) else "\n".join(f"- {x}" for x in raw)).strip()
        if not text:
            return ""
        return text if field == "body" else f"{field.capitalize()}: {text}"

    core, extra = _tiers_for(entry)
    parts = [c for c in (rendered(f) for f in core) if c]
    used = sum(len(c) for c in parts)
    for field in extra:
        chunk = rendered(field)
        if chunk and used + len(chunk) <= _HELP_FACT_BUDGET:
            parts.append(chunk)
            used += len(chunk)
    return "\n\n".join(parts)


def help_facts(question: str) -> list[GroundingFact]:
    """Relevant in-app help entries as grounding facts, so the AI can answer 'how do I…' /
    'what is…' questions from the real product help (no fabrication).

    Ranks through `search_help` — the page's ranker, deliberately, so the AI and the page agree on
    WHICH entries are relevant — then reads the FULL entry from the corpus for the projection
    above. `search_help`'s own return shape is untouched: it is the Help page's search-result
    contract (`test_help.py` pins its four keys), and widening the AI's view is not a reason to
    change what the page's type-ahead receives.
    """
    from app.services.help import HELP, search_help

    by_id = {e["id"]: e for e in HELP}
    facts = []
    for hit in search_help(question, limit=3):
        full = by_id.get(hit["id"], hit)
        value = _render_help_fact(full)
        if value:
            facts.append(GroundingFact(label=f"Help · {hit['title']}", value=value,
                                       source="help", fact_type="help",
                                       link_id=f"help:{hit['id']}"))
    return facts


async def data_quality_facts(session: AsyncSession) -> list[GroundingFact]:
    """Honest data-quality signals (B4): stale/unpriced holdings, unmapped funds/crypto,
    and missing provider credentials. Lets the AI say what is missing or needs action."""
    from sqlalchemy import and_, exists, func

    from app.models import AssetClass, Instrument, InstrumentIdentifier

    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    now = datetime.now(UTC)
    stale = sum(1 for h in val.holdings if h.is_stale)
    unavailable = sum(1 for h in val.holdings if h.symbol and not h.is_priced)
    manual = sum(1 for h in val.holdings if getattr(h, "valuation_method", "") == "manual_valuation")

    async def _unmapped(ac: AssetClass, id_type: str) -> int:
        mapped = exists().where(and_(
            InstrumentIdentifier.instrument_id == Instrument.id,
            InstrumentIdentifier.id_type == id_type,
        ))
        return (await session.execute(
            select(func.count()).select_from(Instrument).where(Instrument.asset_class == ac, ~mapped)
        )).scalar() or 0

    unmapped_mf = await _unmapped(AssetClass.MUTUAL_FUND, "amfi_code")
    unmapped_crypto = await _unmapped(AssetClass.CRYPTO, "coingecko_id")

    facts: list[GroundingFact] = []

    def add(label, value, explanation=None):
        facts.append(GroundingFact(label=label, value=str(value), fact_type="data_quality",
                                   timestamp=now, explanation=explanation))

    if stale:
        add("Stale-priced holdings", stale, "priced from a quote older than the stale threshold")
    if unavailable:
        add("Unpriced/unavailable holdings", unavailable, "no source could price these")
    if manual:
        add("Manually-valued holdings", manual, "user-maintained values (cash, property, FD, …)")
    if unmapped_mf:
        add("Unmapped mutual funds", unmapped_mf, "map to an AMFI scheme code to value at official NAV")
    if unmapped_crypto:
        add("Unmapped crypto", unmapped_crypto, "map to a canonical CoinGecko id for precise pricing")
    prov = get_settings().market_provider
    if prov in ("alphavantage", "eodhd", "kite") and not (get_settings().market_api_key or getattr(get_settings(), "kite_api_key", "")):
        add("Provider credentials missing", prov, "set an API key in Settings to enable live prices")
    if not facts:
        add("Data quality", "no issues detected", "all holdings priced or manually valued")
    return facts


async def networth_facts(session: AsyncSession) -> list[GroundingFact]:
    """Assets, liabilities and net worth in base currency."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    now = datetime.now(UTC)
    assets = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), Decimal(0))
    liabilities = -sum((h.market_value_base for h in val.holdings if h.market_value_base < 0), Decimal(0))
    return [
        GroundingFact(label="Net worth", value=format_fact_display(val.total_value, base), timestamp=now),
        GroundingFact(label="Total assets", value=format_fact_display(assets, base), timestamp=now),
        GroundingFact(label="Total liabilities", value=format_fact_display(liabilities, base), timestamp=now),
    ]


async def performance_facts(session: AsyncSession) -> list[GroundingFact]:
    """Return, risk and concentration metrics from the analytics engine."""
    from app.services.analytics import key_stats

    base = get_settings().base_currency
    try:
        ks = await key_stats(session, base)
    except Exception:  # noqa: BLE001
        return await portfolio_facts(session)
    # ⊕ R-54 §9-C (ruling 2026-07-21, item 1: NARROW-BY-DEMAND). XIRR and TWR were absent from
    # this set, so the pack could not produce them — while `term-xirr-twr` reaches BOTH through the
    # registry's reverse index, and *"what is XIRR"* is the ROADMAP's own worked example of
    # tier-1(a). The two demanded rows are added; nothing else is, because the scope is what tier-1
    # can resolve to, not everything the engine computes.
    want = {
        "Total return", "1Y return", "1Y volatility", "Max drawdown (1Y)",
        "Return / volatility", "Top 5 concentration", "Largest position",
        "Income (div/int)", "Income yield", "Realised P/L", "Unrealised P/L",
        "Money-weighted return (XIRR)", "Time-weighted return (TWR)",
    }
    facts: list[GroundingFact] = []
    for m in ks.get("metrics", []):
        if m["label"] not in want or m["value"] is None:
            continue
        # ⊕ R-54 F-5. Rendering dispatches on the DECLARED value_kind (money/pct/ratio) — never
        # inferred from the value. The kind is read from the figure registry (the declaration home);
        # analytics' own `kind` is the authority the registry cites and is parity-guarded equal, so
        # this is a declared dispatch either way. money.py owns every variant — the pack used to
        # render pct/ratio/count INLINE here (`f"{round(float(v), 2)}%"` and siblings), the residue
        # F-3 left when it scoped "no rendering logic outside money.py" to `_fmt`. That is completed
        # now, for value_kind-dispatched renders (per-item annotations ride F-7).
        #
        # ⚠ `_fmt`/the inline formatters were never broken; they were BYPASSED, which is why the
        # capability probe is on the SERVED PACK (`tests/integration/test_fact_pack_kinds.py`),
        # where a caller that renders the wrong way is visible.
        fig = figure_for_label(m["label"])
        kind = fig.value_kind if fig else m.get("kind")
        value = format_fact_by_kind(m["value"], kind, base)
        if m.get("note"):
            value += f" ({m['note']})"
        facts.append(GroundingFact(label=m["label"], value=value))
    return facts


async def holdings_facts(session: AsyncSession, n: int = 8) -> list[GroundingFact]:
    """Largest positions by market value (what the user actually owns)."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    priced = sorted(val.holdings, key=lambda h: h.market_value_base, reverse=True)[:n]
    gross = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), Decimal(0)) or Decimal(1)
    return [
        GroundingFact(
            label=(h.name or h.label),
            value=f"{format_fact_display(h.market_value_base, base)} ({h.market_value_base / gross * 100:.1f}%)",
            is_stale=h.is_stale)
        for h in priced if h.market_value_base > 0
    ]


# Common company / asset names → ticker, so "how is Tesla moving?" resolves even
# when the word isn't a ticker and the instrument isn't held. The provider's search
# is the fallback for anything not listed here.
_ALIASES = {
    "tesla": "TSLA", "apple": "AAPL", "microsoft": "MSFT", "amazon": "AMZN",
    "alphabet": "GOOGL", "google": "GOOGL", "nvidia": "NVDA", "meta": "META",
    "facebook": "META", "netflix": "NFLX", "broadcom": "AVGO", "intel": "INTC",
    "advanced micro": "AMD", "palantir": "PLTR", "berkshire": "BRK.B",
    "jpmorgan": "JPM", "visa": "V", "mastercard": "MA", "walmart": "WMT",
    "coca cola": "KO", "coca-cola": "KO", "disney": "DIS", "boeing": "BA",
    "exxon": "XOM", "ford": "F", "starbucks": "SBUX", "uber": "UBER",
    "bitcoin": "BTC", "ethereum": "ETH", "ether": "ETH", "solana": "SOL",
    "reliance": "RELIANCE.NSE", "hdfc": "HDFCBANK.BSE", "vodafone": "VOD.L",
    "toyota": "7203.T",
}


# Uppercase words that look like tickers but aren't (so we don't quote "ETF"/"USD").
_TICKER_STOP = {
    "ETF", "USD", "SGD", "INR", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "AI", "PL",
    "FX", "OK", "US", "UK", "EU", "CEO", "CFO", "IPO", "GDP", "FAQ", "ROI", "P/E",
    "YTD", "EOD", "RSI", "MA", "ATH", "ESG", "API", "I", "A", "VS", "TV", "PM", "AM",
    # Product terms/metrics that read like tickers but aren't — so "what is XIRR?" is a
    # help question, not a lookup of instrument "XIRR".
    "XIRR", "TWR", "NAV", "REIT", "FD", "SIP", "CPF", "IPS", "FIFO", "CAGR", "DD",
}


async def _resolve_symbols(session: AsyncSession, question: str) -> list[str]:
    """Map a free-text question to up to 3 instrument symbols. Company/asset NAMES
    (any case) resolve via the alias map; explicit TICKERS are recognised only when
    typed in upper-case in the original text (so ordinary words like "an"/"overview"
    are never mistaken for symbols)."""
    import re

    qlow = question.lower()
    resolved: list[str] = []

    def add(sym: str) -> None:
        s = sym.upper()
        if s not in resolved:
            resolved.append(s)

    # 1) Named companies / assets, in any case ("Tesla", "bitcoin").
    for name, sym in _ALIASES.items():
        if re.search(rf"(?<![a-z]){re.escape(name)}(?![a-z])", qlow):
            add(sym)
    # 2) Explicit tickers the user typed UPPER-CASE (AAPL, NVDA, BTC, HDFC.BSE).
    for tok in re.findall(r"\b[A-Z]{2,6}(?:\.[A-Z]{1,4})?\b", question):
        if tok not in _TICKER_STOP:
            add(tok)
    return resolved[:3]


async def _one_instrument_facts(session: AsyncSession, sym: str) -> list[GroundingFact]:
    from datetime import timedelta

    from app.models import Holding, Instrument
    from app.services.feeds import fetch_symbol_news
    from app.services.market import get_history_cached, refresh_quote

    out: list[GroundingFact] = []
    q = await refresh_quote(session, sym)  # live fetch + cache (works for any symbol)
    instr = (await session.execute(select(Instrument).where(Instrument.symbol == sym))).scalars().first()
    name = instr.name if instr and instr.name and instr.name.upper() != sym else None
    label = f"{name} ({sym})" if name else sym

    if q.price is not None:
        chg = f" ({q.change_pct:+.2f}% today)" if q.change_pct is not None else ""
        out.append(GroundingFact(label=f"{label} price", value=f"{format_fact_display(q.price, q.currency)}{chg}",
                                 source=q.source, timestamp=q.received_at,
                                 entitlement=q.entitlement.value, is_stale=q.is_stale))
    else:
        out.append(GroundingFact(label=f"{label} price", value="unavailable",
                                 source=q.source, entitlement="unavailable"))

    # Trend + range from cached/fetched history (best effort, never fatal).
    try:
        end = datetime.now(UTC)
        candles = await get_history_cached(session, sym, "1d", end - timedelta(days=180), end)
        closes = [float(c.close) for c in candles if c.close is not None]
        if len(closes) > 5:
            first, last = closes[0], closes[-1]
            if first:
                out.append(GroundingFact(label=f"{label} ~6-month change",
                                         value=f"{(last - first) / first * 100:+.1f}%", timestamp=end))
            hi = max(float(c.high) for c in candles if c.high is not None)
            lo = min(float(c.low) for c in candles if c.low is not None)
            out.append(GroundingFact(label=f"{label} 6-month range",
                                     value=f"{format_fact_display(Decimal(str(lo)), q.currency)} – {format_fact_display(Decimal(str(hi)), q.currency)}",
                                     timestamp=end))
    except Exception:  # noqa: BLE001
        pass

    if instr:
        holding = (await session.execute(  # §3.5 R12: never cite a soft-deleted holding
            select(Holding).where(Holding.instrument_id == instr.id).where(Holding.deleted_at.is_(None))
        )).scalars().first()
        if holding and holding.quantity:
            out.append(GroundingFact(label=f"{label} — your position", value=f"{holding.quantity} units"))

    # A couple of recent headlines for context (free Yahoo per-symbol feed).
    try:
        import asyncio
        for it in (await asyncio.wait_for(fetch_symbol_news(sym, limit=3), timeout=6))[:2]:
            out.append(GroundingFact(label=f"{label} headline · {it.source}", value=it.headline,
                                     source=it.source or "news", timestamp=it.published_at))
    except Exception:  # noqa: BLE001
        pass
    return out


async def instrument_deep_facts(session: AsyncSession, symbols: list[str], max_symbols: int = 2) -> list[GroundingFact]:
    """Rich facts for specific instruments (held or not): live price + day move,
    ~6-month trend/range, your position if any, and recent headlines."""
    import asyncio

    facts: list[GroundingFact] = []
    for sym in symbols[:max_symbols]:
        try:
            facts += await asyncio.wait_for(_one_instrument_facts(session, sym), timeout=14)
        except Exception:  # noqa: BLE001 — one slow/failed symbol must not break the answer
            continue
    return facts


def _attach_link_ids(facts: list[GroundingFact]) -> list[GroundingFact]:
    """Stamp the SERVED SEMANTIC LINK ID on every fact that has a canonical destination (§9-D).

    Applied at the dedupe chokepoint, deliberately: `_dedupe` is where a fact's identity is finally
    settled and relabelled to its GLOSSARY spelling, so it is the one place a link can be attached
    from the figure the fact actually IS rather than from the label it happened to arrive with.
    Stamping earlier would mean stamping per-producer — a second, third and fourth site deciding
    where a figure lives, which is the shape this milestone has spent its whole length removing.

    A fact with no registry row, or a row with no canonical page, gets NO link. `None` is the honest
    answer; tier-1 declines rather than inventing a destination.
    """
    for f in facts:
        if f.link_id is not None:
            continue  # already carries one (help facts name their own entry)
        fig = figure_for_label(f.label)
        if fig is not None and fig.canonical_page:
            f.link_id = f"page:{fig.canonical_page}"
    return facts


def _dedupe(facts: list[GroundingFact], cap: int = 20) -> list[GroundingFact]:
    """One fact per label AND one fact per FIGURE (§14-3 / Finding 5).

    Label de-duplication was here already and is kept — it catches the same source running twice.
    Figure de-duplication is the new half: it catches two DIFFERENT sources producing one figure
    under two names, which is what shipped to the 0a screenshot.

    FIRST WINS, and that ordering is not arbitrary. `gather_facts` PREPENDS `portfolio_facts` on
    any portfolio intent, so the survivor's value comes from `value_portfolio` — the canonical
    reader — rather than from the analytics engine's copy of the same quantity. The survivor is
    then RELABELLED to the GLOSSARY spelling, because the canonical label and the canonical value
    did not come from the same source (see the figure registry).
    """
    seen_labels: set[str] = set()
    seen_figures: set[str] = set()
    out: list[GroundingFact] = []
    for f in facts:
        fig = figure_identity(f.label)
        if f.label in seen_labels or (fig is not None and fig in seen_figures):
            continue
        seen_labels.add(f.label)
        if fig is not None:
            seen_figures.add(fig)
            canonical = _canonical_label(f.label)
            if canonical != f.label:
                f = f.model_copy(update={"label": canonical})
                seen_labels.add(canonical)
        out.append(f)
    return _attach_link_ids(out[:cap])


# Intent-routed fact gathering. Resolves any instruments named in the question
# (by ticker OR company name, held or not) and gathers the RIGHT data — instrument
# deep-dive, markets, news, net worth, performance/risk, allocation, movers,
# holdings or watchlist — so the model has a rich, relevant, grounded dataset.
async def gather_facts(session: AsyncSession, question: str) -> list[GroundingFact]:
    """Gather the grounded fact pack for a question.

    R-54 §9-A — THIS FUNCTION NO LONGER ROUTES. It used to compute eight booleans from its own
    substring word lists, which made it a SECOND intent router that did not share code with
    `classify_intent` and could disagree with it (r54 §0-A). The flags below are now a PROJECTION
    of the single authority, read from `intent.INTENT_FACT_SOURCES` — the one table. The downstream
    assembly is deliberately unchanged: this delta moves WHERE the routing decision comes from, not
    what is done with it, so a regression here is a routing regression and never an assembly one.
    """
    from app.ai.intent import Intent, classify_intent, fact_sources

    q = question.lower()

    symbols = await _resolve_symbols(session, question)
    instrument_facts = await instrument_deep_facts(session, symbols) if symbols else []

    # THE SINGLE ROUTING DECISION. Everything below reads `sources`; nothing re-inspects `q` to
    # decide WHAT to gather. (Two places still read `q` to parameterise a source or to judge
    # whether a question is about the user's own money — both are marked and neither selects a
    # fact source.)
    intent = classify_intent(question)
    sources = fact_sources(intent)

    is_market = "market" in sources
    is_news = "news" in sources
    is_networth = "networth" in sources
    is_perf = "perf" in sources
    is_alloc = "alloc" in sources
    is_movers = "movers" in sources
    is_holdings = "holdings" in sources
    is_watch = "watch" in sources
    # "Personal" = the question is about the user's own money, not just an instrument
    # in the abstract. Generic verbs like "doing"/"moving" don't count.
    # NOT ROUTING: this decides whether a resolved instrument answer should stay focused on the
    # instrument, not which fact source to use. Already word-boundary matched.
    import re as _re
    personal = bool(_re.search(
        r"\b(my|i|we|our|me|mine|portfolio|holdings?|positions?|net ?worth|allocation|"
        r"diversif\w*|concentrat\w*|exposure|watchlist|own)\b", q))
    portfolio_intent = is_networth or is_perf or is_alloc or is_movers or is_holdings

    # Pure instrument question ("how is Tesla moving?") → keep the answer focused on
    # the instrument(s); don't drown it in portfolio headline numbers.
    if symbols and not personal and not is_watch:
        facts: list[GroundingFact] = list(instrument_facts)
        if is_market:
            facts += await market_facts(session)
        if is_news and not instrument_facts:
            facts += await news_facts(session)
        return _dedupe(facts)

    facts = list(instrument_facts)
    if is_market:
        facts += await market_facts(session)
    if is_news:
        facts += await news_facts(session)
    if is_networth:
        facts += await networth_facts(session)
    if is_perf:
        facts += await performance_facts(session)
    if is_alloc:
        # NOT ROUTING: `is_alloc` already selected this source; this only picks which axis to split
        # on. Word-boundary matched for the same reason the rules are.
        by_currency = bool(_re.search(r"\bcurrenc(?:y|ies)\b", q))
        facts += await allocation_facts(session, "native_currency" if by_currency else "asset_class")
    if is_movers:
        facts += await movers_facts(session)
    if is_holdings:
        facts += await holdings_facts(session)
    if is_watch:
        facts += await watchlist_quote_facts(session)

    # Data-quality / pricing-health intents (B3/B4): add the honest "what's missing"
    # signals so the AI can answer "which prices are stale?" / "what needs mapping?".
    # `intent` was resolved once at the top — the second `classify_intent` call that used to sit
    # here was the visible seam between the two routers (R-54 §0-A).
    if intent in (Intent.DATA_QUALITY_QUESTION, Intent.PRICING_HEALTH_QUESTION):
        facts = await data_quality_facts(session) + facts

    # Help: ground answers in the in-app help knowledge base whenever the question reads
    # like "how do I… / what is… / where do I… / explain…" (regardless of domain intent),
    # so product-usage questions are answered from real help — never invented.
    import re as _re_help
    if (intent in (Intent.SETTINGS_HELP, Intent.EXPLANATION_OF_METRIC, Intent.UNKNOWN_GENERAL_QUESTION)
            or _re_help.search(r"\b(how (do|can|to|does)|what (is|are|does)|where (do|is|can)|explain|what's|help( me)?)\b", q)):
        hf = help_facts(question)
        if hf:
            facts = hf + facts

    external_only = (is_market or is_news) and not (portfolio_intent or symbols)
    if not facts:
        facts = await portfolio_facts(session) + await movers_facts(session)
    elif portfolio_intent or (not external_only and not symbols):
        facts = await portfolio_facts(session) + facts
    return _dedupe(facts)
