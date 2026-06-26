"""ORM models for LedgerFrame. One module, imported as ``app.models``."""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, DecimalText, utcnow


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
    TRANSFER = "transfer"


# --------------------------------------------------------------------------- #
# Identity & settings
# --------------------------------------------------------------------------- #
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="Owner")
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ProviderConfig(Base):
    __tablename__ = "provider_configs"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(40))  # market | ai | voice
    name: Mapped[str] = mapped_column(String(80))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config_json: Mapped[str] = mapped_column(Text, default="{}")  # never holds raw secrets
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# --------------------------------------------------------------------------- #
# Accounts, instruments, market data
# --------------------------------------------------------------------------- #
class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(40), default="brokerage")
    currency: Mapped[str] = mapped_column(String(3), default="SGD")
    institution: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    holdings: Mapped[list[Holding]] = relationship(back_populates="account")


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
    __table_args__ = (UniqueConstraint("symbol", "exchange", name="uq_instr_symbol_exch"),)


class Quote(Base):
    """Latest known quote per instrument, with provenance & entitlement."""

    __tablename__ = "quotes"
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), primary_key=True)
    price: Mapped[Decimal] = mapped_column(DecimalText)
    previous_close: Mapped[Decimal | None] = mapped_column(DecimalText, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    source: Mapped[str] = mapped_column(String(40), default="mock")
    entitlement: Mapped[str] = mapped_column(String(20), default="delayed")  # see EntitlementStatus
    market_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PriceHistory(Base):
    __tablename__ = "price_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    interval: Mapped[str] = mapped_column(String(10), default="1d")
    ts: Mapped[datetime] = mapped_column(DateTime)
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
    account: Mapped[Account] = relationship(back_populates="holdings")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True, index=True
    )
    type: Mapped[TxnType] = mapped_column(String(16))
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
    quantity: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    price: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    fees: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # commissions/charges
    taxes: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # stamp duty / withholding
    amount: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))  # cash impact, signed
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    import_batch: Mapped[str | None] = mapped_column(String(40), nullable=True)


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
    base_currency: Mapped[str] = mapped_column(String(3))
    total_value: Mapped[Decimal] = mapped_column(DecimalText)
    cost_basis: Mapped[Decimal] = mapped_column(DecimalText)
    unrealised_pl: Mapped[Decimal] = mapped_column(DecimalText)
    day_change: Mapped[Decimal] = mapped_column(DecimalText, default=Decimal("0"))
    detail_json: Mapped[str] = mapped_column(Text, default="{}")  # allocations etc.


class NetWorthSnapshot(Base):
    __tablename__ = "net_worth_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
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
    published_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    symbols_csv: Mapped[str] = mapped_column(String(255), default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True, index=True
    )
    body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# --------------------------------------------------------------------------- #
# Dashboards
# --------------------------------------------------------------------------- #
class DashboardConfig(Base):
    __tablename__ = "dashboard_configs"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="default")
    rotation_seconds: Mapped[int] = mapped_column(Integer, default=30)
    focus_page: Mapped[str | None] = mapped_column(String(40), nullable=True)
    items: Mapped[list[DashboardRotationItem]] = relationship(
        back_populates="config", cascade="all, delete-orphan"
    )


class DashboardRotationItem(Base):
    __tablename__ = "dashboard_rotation_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    config_id: Mapped[int] = mapped_column(
        ForeignKey("dashboard_configs.id", ondelete="CASCADE"), index=True
    )
    page: Mapped[str] = mapped_column(String(40))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[DashboardConfig] = relationship(back_populates="items")


# --------------------------------------------------------------------------- #
# AI conversations
# --------------------------------------------------------------------------- #
class AIConversation(Base):
    __tablename__ = "ai_conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160), default="Conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    messages: Mapped[list[AIMessage]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class AIMessage(Base):
    __tablename__ = "ai_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant | system
    content: Mapped[str] = mapped_column(Text)
    facts_json: Mapped[str] = mapped_column(Text, default="{}")  # grounding facts shown to user
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    conversation: Mapped[AIConversation] = relationship(back_populates="messages")


# --------------------------------------------------------------------------- #
# Audit & backups
# --------------------------------------------------------------------------- #
class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    category: Mapped[str] = mapped_column(String(40))  # auth | mutation | security | system
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text, default="")  # never holds secrets


class BackupRecord(Base):
    __tablename__ = "backup_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    filename: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
