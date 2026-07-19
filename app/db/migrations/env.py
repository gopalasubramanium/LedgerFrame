# SPDX-License-Identifier: AGPL-3.0-or-later
"""Alembic environment — uses the app's sync DB URL and model metadata."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.models  # noqa: F401 — register all models on Base.metadata
from app.core.config import get_settings
from app.db.base import Base

config = context.config
if config.config_file_name is not None:
    # F-8c: `disable_existing_loggers` defaults to True, which SILENCES every logger that
    # already exists and is not named in alembic.ini — including the app's own "ledgerframe"
    # logger. The app runs migrations IN-PROCESS at startup (app/db/migrate.py), so the default
    # killed all application logging for the rest of the process: the log file stopped dead at
    # "[db] applying migrations" on every boot, and honest per-instrument acquisition warnings
    # (the F-8a CoinGecko refusals) reached neither the file nor stdout. A migration runner must
    # never be able to turn off the application's voice.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.sync_db_url)
target_metadata = Base.metadata


def render_item(type_, obj, autogen_context):
    """Ensure our custom DecimalText column type is rendered with its import."""
    from app.db.base import DecimalText

    if type_ == "type" and isinstance(obj, DecimalText):
        autogen_context.imports.add("import app.db.base")
        return "app.db.base.DecimalText()"
    return False


def run_migrations_offline() -> None:
    context.configure(
        url=settings.sync_db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,  # SQLite-friendly ALTERs
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, render_as_batch=True,
            render_item=render_item,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
