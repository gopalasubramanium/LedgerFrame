# SPDX-License-Identifier: AGPL-3.0-or-later
"""Claim a ``settings.key`` row under a concurrent-insert race.

F10 / R-58. The check-then-insert shape ``SELECT key -> if absent, session.add(Setting(...)) ->
flush()`` races: two concurrent callers both read the key as absent, both insert, and the loser dies
on ``UNIQUE constraint failed: settings.key`` — a 500 on a request that did nothing wrong.

F10 fixed this at four sites inside ``get_history_cached`` with a local ``_claim_marker`` helper; the
ruling required the same shape be swept out of the rest of ``app/``. R-58 promotes the primitive here
so its five callers — the F10 marker site plus the four filed sites (``briefing._set``,
``feeds.set_feed_urls``, the ``settings`` PUT loop, the ``system`` reset) — share ONE shape and cannot
drift apart. It lives in ``app/db/`` beside ``upsert.py`` (the established home for cross-service
persistence primitives) and imports only ``app.models``, so it is a leaf: no service or route that
calls it can create an import cycle.
"""

from __future__ import annotations

import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


async def claim_setting(session: AsyncSession, key: str, value: str) -> bool:
    """Insert ``Setting(key, value)``, tolerating a concurrent claimer. ``True`` if WE inserted it.

    The insert goes inside a SAVEPOINT (``begin_nested``) so the loser's ``IntegrityError`` rolls back
    to that savepoint instead of poisoning the caller's transaction — the request continues and does
    its work. Absorbing the error is correct rather than merely convenient: the row exists afterwards
    either way, so the fix changes who WINS the race, never what a winner writes — the winner's value
    stands untouched, and the loser learns it lost via the return.

    This is the ABSENT-branch primitive. Callers that upsert (update a present row) keep their own
    ``SELECT`` and update-if-present branch — the genuine already-present case is not a race — and
    delegate only the absent INSERT here.
    """
    from app.models import Setting

    try:
        async with session.begin_nested():
            session.add(Setting(key=key, value=value))
        return True
    except IntegrityError:
        log.debug("settings.key %r was claimed by a concurrent request", key)
        return False
