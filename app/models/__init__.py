# SPDX-License-Identifier: AGPL-3.0-or-later
"""ORM models for LedgerFrame. One module, imported as ``app.models``."""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, DecimalText, UTCDateTime, utcnow


class AssetClass(str, enum.Enum):
    EQUITY = "equity"
    ETF = "etf"
    MUTUAL_FUND = "mutual_fund"
    BOND = "bond"
    CASH = "cash"
    FIXED_DEPOSIT = "fixed_deposit"
    COMMODITY = "commodity"
    CRYPTO = "crypto"
    PROPERTY = "property"
    PRIVATE = "private"
    RETIREMENT = "retirement"
    LIABILITY = "liability"
    OTHER = "other"


class TxnType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"
    DIVIDEND = "dividend"
    INTEREST = "interest"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    FEE = "fee"
    SPLIT = "split"
    BONUS = "bonus"
    MERGER = "merger"   # §4.3 Unit 2a: instrument A absorbed into B (target = related_instrument_id,
                        # ratio in the price field). Handling lands in Unit 2b — until then both FIFO
                        # engines RAISE on it rather than silently dropping the corporate action.
    TRANSFER = "transfer"


# --------------------------------------------------------------------------- #
# Identity & settings
# --------------------------------------------------------------------------- #
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="Owner")
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # Session revocation (§1.7): any token whose float epoch ``iat`` is < this value is
    # invalid. Bumped on PIN change to revoke every existing session at once. Float so
    # tokens issued in the same wall-clock second as the change are still distinguishable.
    tokens_valid_after: Mapped[float] = mapped_column(Float, default=0.0)


class RevokedToken(Base):
    """A single revoked session token id (jti) — used by /auth/lock (§1.7)."""

    __tablename__ = "revoked_token"
    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    revoked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ApiToken(Base):
    """A scoped, read-only API token (§2.4).

    Stored HASHED at rest: only the SHA-256 of the raw token is kept (never the token). The
    raw token is high-entropy (256-bit random), so a fast hash is safe AND lets us look a
    token up by its hash in O(1) — unlike the low-entropy PIN, which needs Argon2. The raw
    value is shown once at creation and can never be retrieved. ``revoked_at`` non-null =
    revoked; usable only on GET requests.
    """

    __tablename__ = "api_token"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="API token")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    prefix: Mapped[str] = mapped_column(String(16))  # leading chars, for identification only
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


# --------------------------------------------------------------------------- #
# Accounts, instruments, market data
# --------------------------------------------------------------------------- #
class Entity(Base):
    """An ownership entity (Self / Spouse / Trust / Company…). Every account belongs to
    one; consolidated views span all of them (Phase 4.1). Schema only in Unit A — no
    reader filters or groups by it yet, and the migration assigns every existing account
    to a single default entity, so consolidated == the pre-migration portfolio."""
    __tablename__ = "entities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="Household")
    kind: Mapped[str] = mapped_column(String(40), default="self")  # self | spouse | trust | company | other
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    accounts: Mapped[list[Account]] = relationship(back_populates="entity")


class Institution(Base):
    """User-extensible institution master (D-008; MASTER-DATA §6/§7) — the first
    extensible master-with-CRUD in the codebase. One master, FK'd from
    ``accounts.institution_id`` and ``insurance_policy.institution_id`` (the FK columns
    land in Phase-0 commit 3). Starts empty; user-populated.

    **Uniqueness (Amendment F, page-accounts §9-1).** Unique by a NORMALIZED name — trimmed,
    internal-whitespace-collapsed, case-insensitive (``name_key``) — while the display ``name``
    keeps the FIRST-SEEN casing (the Tag case+whitespace collapse rule, D-104's exact-collapse
    half). Fuzzy variants ("DBS" vs "DBS Bank") are USER-DRIVEN merge only (§9-2), never
    auto-detected."""
    __tablename__ = "institutions"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))               # display, first-seen casing
    name_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)  # normalized key
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(40), default="brokerage")
    currency: Mapped[str] = mapped_column(String(3), default="SGD")
    institution: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # Phase 4.1: ownership entity (nullable FK). Schema only in Unit A — nothing reads it
    # yet; a default entity owns every account post-migration, so figures are unchanged.
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True, index=True)
    # Phase 4.4 Unit A (schema only). Cost-basis method for realised gains: "fifo" (default,
    # current behaviour) or "average" (Unit B adds the engine branch; "spec" later). Nothing
    # reads it yet — every account is "fifo", so all figures are byte-identical.
    cost_basis_method: Mapped[str] = mapped_column(String(16), default="fifo")
    holdings: Mapped[list[Holding]] = relationship(back_populates="account")
    entity: Mapped[Entity | None] = relationship(back_populates="accounts")


class Instrument(Base):
    __tablename__ = "instruments"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(40), index=True)
    exchange: Mapped[str | None] = mapped_column(String(20), nullable=True)
    name: Mapped[str] = mapped_column(String(160), default="")
    asset_class: Mapped[AssetClass] = mapped_column(String(20), default=AssetClass.EQUITY)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    sector: Mapped[str | None] = mapped_column(String(80), nullable=True)
    country: Mapped[str | None] = mapped_column(String(60), nullable=True)
    market_cap: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    is_manual_price: Mapped[bool] = mapped_column(Boolean, default=False)
    # §4.6: the fund's annual ongoing cost (expense ratio) in basis points — a property of the
    # instrument, not the lot, so it survives holdings rebuild. Nullable; null means 'not set'
    # (NOT zero — zero would be a fabricated fact). Schema only in Unit A; nothing reads it yet.
    annual_cost_bps: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    # --- Phase 2: additive taxonomy / classification (all nullable, backfilled) ---
    asset_subclass: Mapped[str | None] = mapped_column(String(40), nullable=True)   # ETF, REIT, mutual_fund…
    asset_category: Mapped[str | None] = mapped_column(String(40), nullable=True)   # reporting family
    liquidity_profile: Mapped[str | None] = mapped_column(String(20), nullable=True)  # listed|redeemable|locked|illiquid|manual
    valuation_method: Mapped[str | None] = mapped_column(String(30), nullable=True)   # persisted preferred method
    pricing_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    domicile_country: Mapped[str | None] = mapped_column(String(2), nullable=True)    # ISO-3166 alpha-2
    listing_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    exchange_mic: Mapped[str | None] = mapped_column(String(10), nullable=True)       # ISO 10383 MIC
    source_override: Mapped[str | None] = mapped_column(String(40), nullable=True)    # force a provider
    last_verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    __table_args__ = (UniqueConstraint("symbol", "exchange", name="uq_instr_symbol_exch"),)


class InstrumentIdentifier(Base):
    """Normalized identifiers for an instrument (ISIN, FIGI, AMFI scheme code,
    CoinGecko id, provider symbol, …) — a US/IN/SG ticker collision is impossible
    because identity is (id_type, value), not the bare symbol string."""

    __tablename__ = "instrument_identifiers"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    id_type: Mapped[str] = mapped_column(String(24))   # isin|cusip|figi|sedol|amfi_code|kite_token|coingecko_id|provider_symbol
    value: Mapped[str] = mapped_column(String(64))
    provider: Mapped[str | None] = mapped_column(String(40), nullable=True)  # for provider_symbol rows
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    __table_args__ = (
        UniqueConstraint("instrument_id", "id_type", "value", name="uq_ident_instr_type_value"),
        Index("ix_ident_type_value", "id_type", "value"),
        # A high-confidence identifier is globally unique — it cannot point at two
        # different instruments. Provider symbols are excluded (they legitimately
        # repeat across providers) and covered by uq_ident_provider_symbol.
        Index("uq_ident_high_conf", "id_type", "value", unique=True,
              sqlite_where=text("id_type IN ('isin','cusip','figi','sedol','amfi_code','kite_token','coingecko_id')"),
              postgresql_where=text("id_type IN ('isin','cusip','figi','sedol','amfi_code','kite_token','coingecko_id')")),
        Index("uq_ident_provider_symbol", "provider", "value", unique=True,
              sqlite_where=text("id_type = 'provider_symbol'"),
              postgresql_where=text("id_type = 'provider_symbol'")),
    )


# Identifier types that uniquely, unambiguously identify a security worldwide.
HIGH_CONFIDENCE_IDS = frozenset({"isin", "cusip", "figi", "sedol", "amfi_code", "kite_token", "coingecko_id"})


class AmfiScheme(Base):
    """Cached Indian mutual-fund scheme master + latest official NAV (from AMFI's
    daily NAVAll.txt). Enables search/mapping and NAV-only instruments. Opt-in."""

    __tablename__ = "amfi_schemes"
    code: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    isin_growth: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    isin_reinvest: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fund_house: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category: Mapped[str | None] = mapped_column(String(160), nullable=True)
    nav: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    nav_date: Mapped[str | None] = mapped_column(String(12), nullable=True)  # ISO date
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class CoingeckoCoin(Base):
    """Cached CoinGecko coin master (canonical id ⇄ symbol/name) for search + mapping.
    A holding is mapped by ``id`` (canonical), never the bare symbol. Opt-in."""

    __tablename__ = "coingecko_coins"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)   # canonical CoinGecko id
    symbol: Mapped[str] = mapped_column(String(30), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    market_cap_usd: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class EcbFxRate(Base):
    """Cached ECB euro reference rate (EUR → currency). Used as a reference-FX
    fallback for portfolio translation only — never a trading quote. Opt-in."""

    __tablename__ = "ecb_fx_rates"
    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    rate: Mapped[Decimal] = mapped_column(DecimalText)   # EUR -> currency
    as_of: Mapped[str | None] = mapped_column(String(12), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class KiteInstrument(Base):
    """Cached Zerodha Kite instrument master (NSE/BSE/NFO/MCX) — enables exact
    exchange+tradingsymbol matching and F&O identity (expiry/strike/lot). Opt-in.
    Market-data metadata only; no orders/holdings are ever synced."""

    __tablename__ = "kite_instruments"
    instrument_token: Mapped[int] = mapped_column(Integer, primary_key=True)
    exchange: Mapped[str] = mapped_column(String(12), index=True)
    tradingsymbol: Mapped[str] = mapped_column(String(60), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    segment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instrument_type: Mapped[str | None] = mapped_column(String(6), nullable=True)  # EQ|FUT|CE|PE
    lot_size: Mapped[int] = mapped_column(Integer, default=1)
    expiry: Mapped[str | None] = mapped_column(String(12), nullable=True)
    strike: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Quote(Base):
    """Latest known quote per instrument, with provenance & entitlement."""

    __tablename__ = "quotes"
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), primary_key=True)
    price: Mapped[Decimal] = mapped_column(DecimalText)
    previous_close: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    source: Mapped[str] = mapped_column(String(40), default="mock")
    entitlement: Mapped[str] = mapped_column(String(20), default="delayed")  # see EntitlementStatus
    market_time: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    received_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class PriceHistory(Base):
    __tablename__ = "price_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    interval: Mapped[str] = mapped_column(String(10), default="1d")
    ts: Mapped[datetime] = mapped_column(UTCDateTime)
    open: Mapped[Decimal] = mapped_column(DecimalText)
    high: Mapped[Decimal] = mapped_column(DecimalText)
    low: Mapped[Decimal] = mapped_column(DecimalText)
    close: Mapped[Decimal] = mapped_column(DecimalText)
    volume: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    __table_args__ = (
        Index("ix_hist_instr_interval_ts", "instrument_id", "interval", "ts", unique=True),
    )


# --------------------------------------------------------------------------- #
# Portfolio
# --------------------------------------------------------------------------- #
class Holding(Base):
    __tablename__ = "holdings"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True, index=True
    )
    label: Mapped[str | None] = mapped_column(String(160), nullable=True)  # for manual assets
    asset_class: Mapped[AssetClass] = mapped_column(String(20), default=AssetClass.EQUITY)
    quantity: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    avg_cost: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # per-unit, native ccy
    manual_value: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    # Optional per-asset metadata (FD rate/maturity, bond coupon, property valuation
    # date, retirement scheme, insurance policy, private ownership…). JSON string; the
    # simple "a value in seconds" manual flow leaves it null.
    meta: Mapped[str | None] = mapped_column(Text, nullable=True)
    # §3.5 soft-delete: a non-null timestamp marks the row deleted. Schema only in Unit A —
    # nothing reads or writes it yet, so it is a no-op on all existing behaviour.
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)
    account: Mapped[Account] = relationship(back_populates="holdings")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True, index=True
    )
    type: Mapped[TxnType] = mapped_column(String(16))
    ts: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    quantity: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    price: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    fees: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # commissions/charges
    taxes: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # stamp duty / withholding
    amount: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # cash impact, signed
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    import_batch: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # §3.5 soft-delete (see Holding.deleted_at). Schema only in Unit A — nothing reads it yet.
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)
    # §4.2 trade-date FX (schema only in Unit A). fx_to_base is the native→base rate captured
    # LIVE at commit (Unit B); fx_base records which base it was captured against, so a later
    # base-currency change is detectable. Both NULL means "trade-date FX unavailable" — the
    # honest state for pre-existing rows (a past trade has no historical rate; never fabricate
    # one). Nothing reads these yet, so they are behaviour-inert.
    fx_to_base: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    fx_base: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # §4.3 Unit 2a (schema only). For a MERGER, the target instrument B that this instrument
    # is absorbed into (the price field carries the merger ratio R). NULL for every other
    # transaction kind. Nothing reads it yet — the lot-transfer logic is Unit 2b.
    related_instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True
    )


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    base_currency: Mapped[str] = mapped_column(String(3))
    total_value: Mapped[Decimal] = mapped_column(DecimalText)
    cost_basis: Mapped[Decimal] = mapped_column(DecimalText)
    unrealised_pl: Mapped[Decimal] = mapped_column(DecimalText)
    day_change: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    detail_json: Mapped[str] = mapped_column(Text, default="{}")  # allocations etc.


class NetWorthSnapshot(Base):
    __tablename__ = "net_worth_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    base_currency: Mapped[str] = mapped_column(String(3))
    assets: Mapped[Decimal] = mapped_column(DecimalText)
    liabilities: Mapped[Decimal] = mapped_column(DecimalText)
    net_worth: Mapped[Decimal] = mapped_column(DecimalText)


# --------------------------------------------------------------------------- #
# Watchlists, news, notes
# --------------------------------------------------------------------------- #
class Watchlist(Base):
    __tablename__ = "watchlists"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    items: Mapped[list[WatchlistItem]] = relationship(
        back_populates="watchlist", cascade="all, delete-orphan"
    )


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    watchlist_id: Mapped[int] = mapped_column(
        ForeignKey("watchlists.id", ondelete="CASCADE"), index=True
    )
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    watchlist: Mapped[Watchlist] = relationship(back_populates="items")


class MarketNews(Base):
    __tablename__ = "market_news"
    id: Mapped[int] = mapped_column(primary_key=True)
    headline: Mapped[str] = mapped_column(String(400))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(String(600), nullable=True)
    source: Mapped[str] = mapped_column(String(120), default="")
    published_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    symbols_csv: Mapped[str] = mapped_column(String(255), default="")
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


# --------------------------------------------------------------------------- #
# Audit & backups
# --------------------------------------------------------------------------- #
class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    category: Mapped[str] = mapped_column(String(40))  # auth | mutation | security | system
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text, default="")  # never holds secrets


class BackupRecord(Base):
    __tablename__ = "backup_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    filename: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)


# --------------------------------------------------------------------------- #
# Investment Policy (Phase 1 — target allocation, tolerance bands, risk limit).
# Stores INTENT only; drift/band status/concentration are computed live from the
# current valuation and never stored, so they can't go stale or disagree.
# --------------------------------------------------------------------------- #
class InvestmentPolicy(Base):
    __tablename__ = "investment_policy"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="Investment Policy")
    base_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)  # null → settings base
    default_band_pct: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("5"))
    max_position_pct: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)  # optional risk band
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    targets: Mapped[list[PolicyTarget]] = relationship(
        back_populates="policy", cascade="all, delete-orphan")


class PolicyTarget(Base):
    __tablename__ = "policy_targets"
    __table_args__ = (
        UniqueConstraint("policy_id", "dimension", "bucket", name="uq_policy_target"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("investment_policy.id"), index=True)
    dimension: Mapped[str] = mapped_column(String(20))  # asset_class | currency | region
    bucket: Mapped[str] = mapped_column(String(40))     # e.g. equity | SGD | India
    target_pct: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    min_pct: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    max_pct: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    policy: Mapped[InvestmentPolicy] = relationship(back_populates="targets")


# --------------------------------------------------------------------------- #
# Planning (Phase 3b) — goals & obligations. Store INTENT only; progress and the
# next-12-months total are computed live and never stored.
# --------------------------------------------------------------------------- #
class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    target_amount: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    target_date: Mapped[str | None] = mapped_column(String(10), nullable=True)   # ISO date
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)        # null → base
    basis: Mapped[str] = mapped_column(String(16), default="net_worth")           # net_worth|liquid|none
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Obligation(Base):
    __tablename__ = "obligations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    amount: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    due_date: Mapped[str] = mapped_column(String(10))                             # ISO date
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)        # null → base
    recurrence: Mapped[str] = mapped_column(String(12), default="once")           # once|monthly|quarterly|annual
    kind: Mapped[str] = mapped_column(String(8), default="expense")               # expense|income
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


# --------------------------------------------------------------------------- #
# Review log (W1) — a recorded review over time (discipline). Snapshots the state
# at the moment "Mark reviewed" is pressed; never edited automatically.
# --------------------------------------------------------------------------- #
class ReviewLog(Base):
    __tablename__ = "review_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    reviewed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    net_worth: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    base_currency: Mapped[str] = mapped_column(String(3), default="SGD")
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    drift_flags: Mapped[int] = mapped_column(Integer, default=0)
    attention_count: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_review_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO


# --------------------------------------------------------------------------- #
# Insurance (W3) — a first-class protection register. Reporting only: records &
# renewal reminders, never an adequacy judgement. cash_value is shown here but is
# NOT injected into net worth (isolated register, by design). linked_goal_id is a
# soft link (no FK constraint) so deleting a goal never breaks a policy.
# --------------------------------------------------------------------------- #
class InsurancePolicy(Base):
    __tablename__ = "insurance_policy"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    insurer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    policy_type: Mapped[str] = mapped_column(String(30), default="other")
    policy_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    insured_person: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cover_amount: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="SGD")
    cash_value: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    premium: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    premium_frequency: Mapped[str] = mapped_column(String(12), default="annual")
    start_date: Mapped[str | None] = mapped_column(String(10), nullable=True)     # ISO
    renewal_date: Mapped[str | None] = mapped_column(String(10), nullable=True)   # ISO
    nominee: Mapped[str | None] = mapped_column(String(120), nullable=True)
    linked_goal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)    # soft link
    documents: Mapped[str | None] = mapped_column(Text, nullable=True)            # JSON [{label,have}]
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="active")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


# --------------------------------------------------------------------------- #
# Estate & document readiness (W4) — family governance, NOT legal advice. Records
# what exists and where, and reminders to keep it current. Three isolated tables;
# document links are free-text only (no FK), contact phone/email stay local.
# --------------------------------------------------------------------------- #
class EstateProfile(Base):
    __tablename__ = "estate_profile"
    id: Mapped[int] = mapped_column(primary_key=True)
    will_status: Mapped[str] = mapped_column(String(16), default="none")  # none|draft|executed|needs_update
    will_location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    executor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_reviewed: Mapped[str | None] = mapped_column(String(10), nullable=True)     # ISO
    next_review_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EstateContact(Base):
    __tablename__ = "estate_contact"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    # `relationship` was retired (page-estate §9-5, D-010/D-063): the fixed `roles` vocab is the
    # canonical concept; the old free-text field was folded into `notes` by migration f2b7c1a9e304.
    roles: Mapped[str] = mapped_column(Text, default="[]")   # JSON list of role strings
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class EstateDocument(Base):
    __tablename__ = "estate_document"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(24), default="other")
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="present")  # present|missing|outdated
    review_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO
    related_to: Mapped[str | None] = mapped_column(String(120), nullable=True)  # free-text, no FK
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


# --------------------------------------------------------------------------- #
# Tags + contributions (W8). Tags key on (account_id, holding_key) where
# holding_key is the instrument symbol (market) or the manual label — a stable
# identity that survives the transaction-derived holding rebuild. Contributions
# are recorded plans (never projections).
# --------------------------------------------------------------------------- #
class HoldingTag(Base):
    __tablename__ = "holding_tag"
    __table_args__ = (UniqueConstraint("account_id", "holding_key", name="uq_holding_tag"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(Integer, index=True)
    holding_key: Mapped[str] = mapped_column(String(200))   # instrument symbol or manual label
    tags: Mapped[str] = mapped_column(Text, default="[]")   # JSON list of tag strings


class Contribution(Base):
    __tablename__ = "contribution"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="SGD")
    frequency: Mapped[str] = mapped_column(String(12), default="monthly")  # monthly|quarterly|annual|once
    kind: Mapped[str] = mapped_column(String(12), default="invest")        # invest|withdraw|prepay
    target_goal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # soft link
    start_date: Mapped[str | None] = mapped_column(String(10), nullable=True)   # ISO
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
