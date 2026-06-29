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
    try:
        run_migrations()
    except OSError as exc:
        # The data dir may be unwritable / not mounted (e.g. running update.sh on a
        # dev laptop where LEDGERFRAME_DATA_DIR points elsewhere, or before the USB
        # is mounted). The app/worker create the schema via create_all() at startup,
        # so this is non-fatal — report clearly and exit 0 (no scary traceback).
        print(f"[db] skipping migrations — data dir not accessible: {exc}")
        print("[db] the running service ensures the schema on startup (create_all).")
    except Exception as exc:  # noqa: BLE001
        print(f"[db] migrations could not run: {exc}")
        print("[db] the running service ensures the schema on startup (create_all).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
