#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Set the local PIN from the installer (release-readiness Gate B9).

Reads the PIN on **stdin** — never from argv, which would put it in `ps` output and the shell history
of anyone watching. Uses the app's **own Argon2 hasher** (`app.core.security.hash_pin`), because a
second place that stores PINs is a second place that can store them badly.

Why it exists: `install.sh` never offered to set a PIN, so the default install had none (gap 7). On a
loopback-only box that is a defensible convenience — but nobody was ever *asked*. Now they are.

    echo 123456 | python scripts/set_pin.py
"""

from __future__ import annotations

import asyncio
import sys

MIN_DIGITS = 6  # D-002's floor. The installer must not be the one place it can be undercut.


async def _set(pin: str) -> None:
    from sqlalchemy import select

    from app.core.security import hash_pin
    from app.db.base import get_sessionmaker
    from app.db.migrate import run_migrations
    from app.models import User

    # The app migrates on boot, but the installer runs before the first boot — so bring the schema up
    # ourselves rather than write into a database that does not exist yet.
    run_migrations()

    async with get_sessionmaker()() as session:
        user = (await session.execute(select(User).limit(1))).scalars().first()
        if user is None:
            user = User()
            session.add(user)
        user.pin_hash = hash_pin(pin)
        await session.commit()


def main() -> int:
    pin = sys.stdin.read().strip()

    if not pin.isdigit() or len(pin) < MIN_DIGITS:
        print(f"error: the PIN must be at least {MIN_DIGITS} digits.", file=sys.stderr)
        return 2

    try:
        asyncio.run(_set(pin))
    except Exception as exc:  # noqa: BLE001 — the installer needs a reason, not a traceback
        print(f"error: could not set the PIN: {exc}", file=sys.stderr)
        return 1

    print("PIN set.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
