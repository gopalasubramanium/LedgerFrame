# SPDX-License-Identifier: AGPL-3.0-or-later
"""Reference data (D-005): the single endpoint serving every fixed vocabulary.

Retires the per-master `*/meta` endpoints and all frontend inline lists — the
frontend carries zero vocabulary copies (MASTER-DATA §1). Values are sourced from
the canonical code enums/constants where they exist; the authored vocabularies
(asset_subclass DEF-2, and the sets with no single code home) are defined here
against MASTER-DATA, which is their backend home.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.models import AssetClass, TxnType
from app.schemas.common import EntitlementStatus, ValuationMethod
from app.services.accounts import ACCOUNT_KINDS
from app.services.estate import (
    CONTACT_ROLES,
    DOC_CATEGORIES,
    DOC_STATUSES,
    WILL_STATUSES,
)
from app.services.insurance import FREQUENCIES as PREMIUM_FREQUENCIES
from app.services.insurance import POLICY_TYPES
from app.services.planning import GOAL_BASES, OBLIGATION_KINDS, RECURRENCES

router = APIRouter()


def _values(enum_cls) -> list[str]:
    return [m.value for m in enum_cls]


# Item 3b (2026-07-10) — /refdata serves DISPLAY LABELS alongside values so the UI
# never hardcodes a mapping (D-005). Most labels titleize the snake_case value;
# acronyms/brands that titleize wrong are overridden here (the single source).
_LABEL_OVERRIDES = {
    "etf": "ETF", "reit": "REIT", "amfi_nav": "AMFI", "coingecko": "CoinGecko",
    "alphavantage": "AlphaVantage", "ecb_fx": "ECB FX", "eodhd": "EODHD", "csv": "CSV",
    "isin": "ISIN", "cusip": "CUSIP", "figi": "FIGI", "sedol": "SEDOL",
    "amfi_code": "AMFI code", "kite_token": "Kite token", "coingecko_id": "CoinGecko ID",
    "provider_symbol": "Provider symbol", "us": "US", "us-europe": "US / Europe",
}


def _label(value: str) -> str:
    ov = _LABEL_OVERRIDES.get(value.lower())
    if ov:
        return ov
    # Titleize snake_case / all-lower enums (mutual_fund -> "Mutual fund"); leave
    # already display-ready values (India, Singapore, APAC, SGD) untouched.
    if "_" in value or value.islower():
        s = value.replace("_", " ")
        return s[:1].upper() + s[1:]
    return value


def _labeled(values: list[str]) -> list[dict[str, str]]:
    return [{"value": v, "label": _label(v)} for v in values]


# Authored / no-single-code-home vocabularies (MASTER-DATA §2/§4).
_ASSET_SUBCLASS = ["crypto", "derivative", "equity", "etf", "mutual_fund", "reit"]  # DEF-2 §2 †
_LIQUIDITY_PROFILE = ["listed", "redeemable", "locked", "illiquid", "manual"]  # §2
_ENTITY_KIND = ["self", "spouse", "trust", "company", "other"]  # §2
_CONTRIBUTION_FREQUENCY = ["monthly", "quarterly", "annual", "once"]  # §2
_CONTRIBUTION_KIND = ["invest", "withdraw", "prepay"]  # §2
_COST_BASIS_METHOD = ["fifo", "average"]  # §2 (v2 lanes; `spec` is ROADMAP R-6)
_POLICY_DIMENSION = ["asset_class", "currency", "region"]  # §2
_REGION = ["India", "Singapore", "US", "Europe", "APAC", "Other"]  # §4 (D-083)
_ID_TYPE = ["isin", "cusip", "figi", "sedol", "amfi_code", "kite_token",
            "coingecko_id", "provider_symbol"]  # §2


def _source_override_values() -> list[str]:
    """ND-3 — per-instrument source-override routing options. `auto` clears the
    override; the rest are the market-router providers (sourced from CAPABILITIES so
    the vocab can never drift from the router)."""
    from app.providers.market.router import CAPABILITIES
    return ["auto", *sorted(CAPABILITIES.keys())]

# D-090 (ratified 2026-07-10) — AssetClass → the TxnTypes the Add-flow Type
# dropdown OFFERS for that class. MASTER-DATA §10 is the canonical statement; this
# is its backend home so the frontend carries no copy (D-005). Form-level filtering
# ONLY — the engine (`compute_fifo`) is unchanged and processes every type, and CSV
# imports of odd-but-real historical events are NOT filtered by this matrix
# (importer validates and commits regardless). Ratification amendment: ETF Bonus is
# ON (ETF unit splits/consolidations occur). Crypto corporate actions OFF (enable on
# request); retirement/liability interest ON; MF split+bonus ON; FD/bond/cash
# interest ON (the Manual-branch transaction path this implies is approved).
_TXN_APPLICABILITY: dict[str, list[str]] = {
    "equity":        ["buy", "sell", "dividend", "fee", "split", "bonus", "merger", "transfer"],
    "etf":           ["buy", "sell", "dividend", "fee", "split", "bonus", "merger", "transfer"],
    "mutual_fund":   ["buy", "sell", "dividend", "fee", "split", "bonus", "merger", "transfer"],
    "bond":          ["buy", "sell", "interest", "fee", "transfer"],
    "cash":          ["interest", "deposit", "withdrawal", "fee", "transfer"],
    "fixed_deposit": ["interest", "deposit", "withdrawal", "fee", "transfer"],
    "commodity":     ["buy", "sell", "fee", "transfer"],
    "crypto":        ["buy", "sell", "fee", "transfer"],
    "property":      ["buy", "sell", "fee", "transfer"],
    "private":       ["buy", "sell", "fee", "transfer"],
    "retirement":    ["interest", "deposit", "withdrawal", "fee", "transfer"],
    "liability":     ["interest", "deposit", "withdrawal", "fee", "transfer"],
    "other":         ["buy", "sell", "dividend", "interest", "deposit", "withdrawal",
                      "fee", "split", "bonus", "merger", "transfer"],
}


@router.get("/refdata")
async def refdata() -> dict[str, list[dict[str, str]]]:
    """Every fixed vocabulary, keyed by id, each as `{value, label}` pairs so the UI
    renders served DISPLAY LABELS and never hardcodes a mapping (D-005; item 3b).
    Extensible masters (currency, institution, sector, tag) are served by their own
    endpoints, not here."""
    raw = {
        "txn_type": _values(TxnType),
        "asset_class": _values(AssetClass),
        "asset_subclass": _ASSET_SUBCLASS,
        "liquidity_profile": _LIQUIDITY_PROFILE,
        "entity_kind": _ENTITY_KIND,
        "goal_basis": list(GOAL_BASES),
        "obligation_recurrence": list(RECURRENCES),
        "obligation_kind": list(OBLIGATION_KINDS),
        "contribution_frequency": _CONTRIBUTION_FREQUENCY,
        "contribution_kind": _CONTRIBUTION_KIND,
        "will_status": list(WILL_STATUSES),
        "estate_doc_status": list(DOC_STATUSES),
        "estate_doc_category": list(DOC_CATEGORIES),
        "contact_role": list(CONTACT_ROLES),
        "valuation_method": _values(ValuationMethod),
        "entitlement": _values(EntitlementStatus),
        "policy_dimension": _POLICY_DIMENSION,
        "region": _REGION,
        "cost_basis_method": _COST_BASIS_METHOD,
        "account_kind": list(ACCOUNT_KINDS),
        "policy_type": list(POLICY_TYPES),
        "premium_frequency": list(PREMIUM_FREQUENCIES),
        "id_type": _ID_TYPE,
        "source_override": _source_override_values(),
    }
    return {vocab: _labeled(values) for vocab, values in raw.items()}


@router.get("/refdata/txn-applicability")
async def txn_applicability() -> dict[str, list[str]]:
    """D-090 — per-AssetClass TxnType applicability for the Add-flow Type dropdown.
    Keyed by asset_class value → the offered txn_type values (MASTER-DATA §10).
    Form-level filtering only; the engine and the CSV importer ignore it."""
    return _TXN_APPLICABILITY
