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
    fileConfig(config.config_file_name)

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
