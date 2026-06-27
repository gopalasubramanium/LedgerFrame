"""Read/write helpers for the local ``.env`` file.

The app runs as the owner of the repo, so it may update its own ``.env`` (e.g. to
switch market-data provider or store a provider API key entered in Settings).
Writes are key-scoped, comment-safe, and never echo secret values back.
"""

from __future__ import annotations

from pathlib import Path

# Repo root = two levels up from this file (app/core/envfile.py -> repo/).
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def read_env() -> dict[str, str]:
    out: dict[str, str] = {}
    if not ENV_PATH.exists():
        return out
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip()
    return out


def update_env(updates: dict[str, str]) -> None:
    """Set/replace keys in .env, preserving comments and other lines."""
    ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = ENV_PATH.read_text().splitlines() if ENV_PATH.exists() else []
    remaining = dict(updates)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in remaining:
            lines[i] = f"{key}={remaining.pop(key)}"
    for key, value in remaining.items():
        lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(lines) + "\n")
    try:
        ENV_PATH.chmod(0o600)
    except OSError:
        pass


def apply_env(updates: dict[str, str]) -> None:
    """Persist to .env AND set os.environ so an in-process reload actually takes effect.

    Critical on systemd: the service is started with the .env file loaded as an
    ``EnvironmentFile``, so each ``LEDGERFRAME_*`` key is an OS environment variable.
    pydantic-settings ranks env vars ABOVE the .env file, so rewriting the file
    alone is invisible until a restart. Updating ``os.environ`` here lets
    ``reload_settings()`` pick the change up immediately — no restart needed.
    """
    import os

    update_env(updates)
    os.environ.update({k: str(v) for k, v in updates.items()})
