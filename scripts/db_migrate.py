#!/usr/bin/env python3
"""CLI wrapper: bring the database schema up to date.

All logic lives in ``app.db.migrate.run_migrations`` (so it's unit-testable
in-process). Safe for create_all-bootstrapped databases — see that module.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make the repo importable when run as a standalone script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.migrate import run_migrations  # noqa: E402


def main() -> int:
    run_migrations()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
