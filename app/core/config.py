"""Central application configuration.

All settings are read from environment variables (prefix ``LEDGERFRAME_``) or a
local ``.env`` file. Nothing here ever points outside the device by default.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Currencies the engine knows how to convert and display.
SUPPORTED_CURRENCIES = ["SGD", "USD", "INR", "EUR", "GBP", "JPY", "AUD", "CNY", "HKD"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LEDGERFRAME_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Core ---
    env: str = "production"
    data_dir: Path = Path("/mnt/ledgerframe-data")
    api_host: str = "127.0.0.1"
    api_port: int = 8321
    log_level: str = "INFO"

    # --- Security ---
    secret_key: str = "change-me-to-a-long-random-string"
    allow_lan: bool = False
    autolock_minutes: int = 15

    # --- Display / currency ---
    base_currency: str = "SGD"
    timezone: str = "Asia/Singapore"

    # --- Market data ---
    market_provider: str = "mock"
    stale_after_seconds: int = 900
    market_api_key: str = ""

    # --- AI ---
    ai_enabled: bool = True
    ai_provider: str = "hailo"
    hailo_base_url: str = "http://127.0.0.1:8000"
    ai_model: str = ""
    ai_timeout_seconds: int = 120  # local LLMs on CPU can be slow to first token
    ai_max_requests_per_minute: int = 20
    openai_base_url: str = ""
    openai_api_key: str = ""

    # --- Voice ---
    voice_enabled: bool = False
    stt_provider: str = "whispercpp"
    tts_provider: str = "piper"
    wakeword_enabled: bool = False

    # --- Backups ---
    backup_enabled: bool = True
    backup_keep: int = 14
    backup_age_recipient: str = ""

    # --- Kiosk ---
    kiosk_url: str = "http://127.0.0.1:8321"
    rotation_default_seconds: int = 30

    @field_validator("base_currency")
    @classmethod
    def _validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"base_currency must be one of {SUPPORTED_CURRENCIES}")
        return v

    # --- Derived paths (all under data_dir on the USB NVMe) ---
    @property
    def db_path(self) -> Path:
        return self.data_dir / "db" / "ledgerframe.db"

    @property
    def db_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path}"

    @property
    def sync_db_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def imports_dir(self) -> Path:
        return self.data_dir / "imports"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def audio_dir(self) -> Path:
        return self.data_dir / "generated-audio"

    @property
    def is_demo(self) -> bool:
        return self.market_provider == "mock"

    def ensure_dirs(self) -> None:
        """Create runtime directories under data_dir. Never touches the NVMe filesystem itself."""
        for d in (
            self.db_path.parent,
            self.cache_dir,
            self.imports_dir,
            self.logs_dir,
            self.backups_dir,
            self.audio_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)
            try:
                os.chmod(d, 0o700)
            except PermissionError:
                pass


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    """Re-read .env into a fresh Settings (after the app edits .env at runtime) and
    reset dependent caches so changes (e.g. market provider) take effect in-process
    without a full service restart."""
    get_settings.cache_clear()
    settings = get_settings()
    # Reset provider/registry caches that captured the old settings.
    try:
        from app.providers.ai import reset_ai_provider
        from app.providers.market import reset_provider
        from app.services import fx

        reset_provider()
        reset_ai_provider()
        fx.clear_cache()
    except Exception:  # noqa: BLE001 — best-effort; full restart always works too
        pass
    return settings
