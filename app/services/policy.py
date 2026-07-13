# SPDX-License-Identifier: AGPL-3.0-or-later
"""Investment Policy (Phase 1): stored target allocation + tolerance bands, and the
LIVE-computed drift / band status / concentration report.

Only the targets are stored. Drift, band status and concentration are recomputed from
the current valuation on every read, so they can never go stale or disagree with the
portfolio. Everything here is deterministic (``Decimal``) and is **reporting, never
advice** — it states distance from a target, never "buy/sell" and never names a trade.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings

# D-083: region is the six-bucket model (India · Singapore · US · Europe · APAC · Other), derived
# server-side from listing_country. The canonical derivation lives in app.core.regions and is
# re-exported here so the policy region dimension and the served HoldingView.region use the SAME
# function (page-heatmap §10-9 — reconciled from the legacy 3-bucket + "Global").
from app.core.regions import region_of  # re-exported for policy._bucket_of + importers
from app.models import InvestmentPolicy, PolicyTarget
from app.services.portfolio import value_portfolio

DIMENSIONS = ("asset_class", "currency", "region")


def _q(v: Decimal, dp: int = 2) -> float:
    return float(round(v, dp))


async def get_or_create_policy(session: AsyncSession) -> InvestmentPolicy:
    policy = (await session.execute(
        select(InvestmentPolicy).options(selectinload(InvestmentPolicy.targets))
        .where(InvestmentPolicy.is_active).limit(1)
    )).scalars().first()
    if policy is None:
        policy = InvestmentPolicy()
        session.add(policy)
        await session.flush()
        await session.refresh(policy, ["targets"])
    return policy


def policy_payload(policy: InvestmentPolicy) -> dict:
    return {
        "name": policy.name,
        "base_currency": policy.base_currency,
        "default_band_pct": _q(policy.default_band_pct, 2),
        "max_position_pct": _q(policy.max_position_pct, 2) if policy.max_position_pct is not None else None,
        "notes": policy.notes,
        "targets": [
            {
                "dimension": t.dimension, "bucket": t.bucket,
                "target_pct": _q(t.target_pct, 2),
                "min_pct": _q(t.min_pct, 2) if t.min_pct is not None else None,
                "max_pct": _q(t.max_pct, 2) if t.max_pct is not None else None,
            }
            for t in sorted(policy.targets, key=lambda t: (t.dimension, t.bucket))
        ],
    }


def _bucket_of(h, dim: str) -> str:
    if dim == "asset_class":
        return h.asset_class
    if dim == "currency":
        return h.native_currency
    return region_of(h.country)


async def compute_drift(session: AsyncSession, entity_id: int | None = None) -> dict:
    """Actual-vs-target drift + band status per dimension, plus concentration flags."""
    policy = await get_or_create_policy(session)
    base = policy.base_currency or get_settings().base_currency
    val = await value_portfolio(session, base, entity_id=entity_id)  # §4.1
    gross = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), Decimal(0)) or Decimal(1)
    band = policy.default_band_pct

    targets_by_dim: dict[str, list[PolicyTarget]] = defaultdict(list)
    for t in policy.targets:
        targets_by_dim[t.dimension].append(t)

    dimensions = []
    for dim in DIMENSIONS:
        ts = targets_by_dim.get(dim, [])
        if not ts:
            continue
        actual_val: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
        for h in val.holdings:
            if h.market_value_base > 0:
                actual_val[_bucket_of(h, dim)] += h.market_value_base

        rows = []
        covered = Decimal(0)
        seen = set()
        for t in sorted(ts, key=lambda t: t.bucket):
            av = actual_val.get(t.bucket, Decimal(0))
            actual_pct = av / gross * 100
            lower = t.min_pct if t.min_pct is not None else t.target_pct - band
            upper = t.max_pct if t.max_pct is not None else t.target_pct + band
            lower = max(Decimal(0), lower)
            upper = min(Decimal(100), upper)
            status = "under" if actual_pct < lower else "over" if actual_pct > upper else "in_band"
            gap_base = av - (t.target_pct / 100 * gross)   # +ve = over target (factual, not advice)
            rows.append({
                "bucket": t.bucket,
                "target_pct": _q(t.target_pct, 1),
                "actual_pct": _q(actual_pct, 1),
                "drift_pct": _q(actual_pct - t.target_pct, 1),
                "lower_pct": _q(lower, 1), "upper_pct": _q(upper, 1),
                "status": status,
                "gap_base": _q(gap_base, 0),
                "actual_value": _q(av, 0),
            })
            covered += t.target_pct
            seen.add(t.bucket)

        untargeted = [
            {"bucket": k, "actual_pct": _q(v / gross * 100, 1), "actual_value": _q(v, 0)}
            for k, v in sorted(actual_val.items(), key=lambda kv: kv[1], reverse=True)
            if k not in seen
        ]
        dimensions.append({
            "dimension": dim,
            "coverage_pct": _q(covered, 1),
            "rows": rows,
            "untargeted": untargeted,
        })

    concentration = []
    if policy.max_position_pct is not None:
        limit = policy.max_position_pct
        for h in val.holdings:
            if h.market_value_base <= 0:
                continue
            w = h.market_value_base / gross * 100
            if w > limit:
                concentration.append({
                    "label": h.name or h.label,
                    "weight_pct": _q(w, 1),
                    "limit_pct": _q(limit, 1),
                    "value": _q(h.market_value_base, 0),
                })
        # weight_pct is always _q(...) -> float; the dict is str|float so mypy widens it to object.
        concentration.sort(key=lambda c: cast(float, c["weight_pct"]), reverse=True)

    return {
        "base_currency": base,
        "total_value": _q(val.total_value, 0),
        "has_targets": any(policy.targets),
        "max_position_pct": _q(policy.max_position_pct, 1) if policy.max_position_pct is not None else None,
        "dimensions": dimensions,
        "concentration": concentration,
        "disclaimer": "Reporting only — distance from your own targets. Not financial advice.",
    }


async def replace_targets(session: AsyncSession, targets: list[dict]) -> InvestmentPolicy:
    """Atomically replace all targets (bulk, validated). Invalid rows raise ValueError."""
    policy = await get_or_create_policy(session)
    cleaned: list[PolicyTarget] = []
    seen = set()
    for row in targets:
        dim = str(row.get("dimension", "")).strip().lower()
        bucket = str(row.get("bucket", "")).strip()
        if dim not in DIMENSIONS:
            raise ValueError(f"unknown dimension '{dim}'")
        if not bucket:
            raise ValueError("bucket is required")
        key = (dim, bucket.lower())
        if key in seen:
            raise ValueError(f"duplicate target {dim}/{bucket}")
        seen.add(key)
        tgt = _dec(row.get("target_pct"), "target_pct", required=True)
        assert tgt is not None  # required=True raised above if it were missing
        lo = _dec(row.get("min_pct"), "min_pct")
        hi = _dec(row.get("max_pct"), "max_pct")
        if not (Decimal(0) <= tgt <= Decimal(100)):
            raise ValueError("target_pct must be 0–100")
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min_pct cannot exceed max_pct")
        cleaned.append(PolicyTarget(policy_id=policy.id, dimension=dim, bucket=bucket[:40],
                                    target_pct=tgt, min_pct=lo, max_pct=hi))

    policy.targets.clear()
    await session.flush()
    for t in cleaned:
        session.add(t)
    await session.flush()
    await session.refresh(policy, ["targets"])
    return policy


def _dec(v, field: str, required: bool = False) -> Decimal | None:
    if v is None or v == "":
        if required:
            raise ValueError(f"{field} is required")
        return None
    try:
        return Decimal(str(v))
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"{field} must be a number") from exc
