# SPDX-License-Identifier: AGPL-3.0-or-later
"""Commitment 6's guard: AI questions and answers are never persisted.

`PRODUCT-SPEC.md` §3 Commitment 6 — *"**No stored AI conversations.** AI questions
and answers are never persisted."* — and `app/services/legal.py` serves that sentence
to the user, while `app/services/help.py` tells them each Commitment *has a test
behind it*.

**It did not.** Before this file, the enforcement was **absence, twice over** (AI-surfaces
§0-D): the `ai_conversations` / `ai_messages` tables were dropped by
`f9e1a2b3c4d5_drop_retired_tables.py` (D-016), and nothing writes them. Both are true;
neither was asserted. A grep across `tests/` for ``ai_conversations|ai_messages|never
persisted`` returned only unrelated hits — so the product made a promise on the Legal
page that no test kept, which is the one shape a Commitment must never have.

The guard is deliberately in **three layers**, because each one alone can go blind:

1. **Structural (ORM)** — the app's own metadata declares no such table, so `create_all`
   cannot bring one back.
2. **Structural (migrations)** — a **downgrade → upgrade cycle** leaves none either. This
   is the layer that caught a real defect: the migration's `downgrade()` **re-created
   both tables**, so the schema that forbids storing conversations was one `alembic
   downgrade` away from permitting it again.
3. **Behavioural** — a full `/ai/chat` round trip leaves **every table's row count
   unchanged**. Layers 1–2 assert a table cannot exist; layer 3 is what still means
   something if some future design persisted a conversation *somewhere else*, which is
   exactly the "pinned against going blind" clause in CLAUDE.md.

⚠ **One adjacent write is correct and must not red this file.** `refresh_briefing`
(`app/services/briefing.py`) persists the **derived briefing string** to a settings row.
That is stored **output**, not a stored **conversation** — no question, no answer, no
exchange. Layer 3 exercises `/ai/chat`, which does not go near it; the distinction is
stated here so a future reader does not "fix" the briefing to satisfy a promise it was
never in tension with.
"""

from __future__ import annotations

import os

from alembic import command
from sqlalchemy import create_engine, inspect, text

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.db.base import Base

RETIRED_AI_TABLES = {"ai_conversations", "ai_messages"}

# The revision immediately before the AI tables were dropped. Downgrading to it and
# coming back is the round trip Commitment 6 has to survive.
BEFORE_THE_DROP = "d1e7a4c02f95"


# ─── layer 1: the ORM declares no such table ────────────────────────────────────

def test_the_orm_metadata_declares_no_ai_conversation_tables():
    declared = set(Base.metadata.tables)
    assert not (declared & RETIRED_AI_TABLES), (
        f"The ORM declares {sorted(declared & RETIRED_AI_TABLES)}. Commitment 6 promises AI "
        "questions and answers are NEVER persisted, and a declared model is a place to "
        "persist them — create_all would bring the table straight back (D-016)."
    )
    # Pinned against going blind: an empty metadata would satisfy the line above while
    # asserting nothing at all.
    assert len(declared) > 20, (
        f"Only {len(declared)} tables declared — the ORM metadata did not load, so the "
        "assertion above passed vacuously rather than because the tables are absent."
    )


# ─── layer 2: no migration path re-creates them ─────────────────────────────────

def _alembic_on(tmp_path) -> tuple[object, str]:
    from app.core.config import get_settings, reload_settings
    from app.db.migrate import _alembic_config

    (tmp_path / "db").mkdir(parents=True, exist_ok=True)
    os.environ["LEDGERFRAME_DATA_DIR"] = str(tmp_path)
    reload_settings()
    settings = get_settings()
    url = settings.sync_db_url
    if not settings.is_sqlite:  # Postgres shares one DB → clean schema per test (serial)
        eng = create_engine(url)
        try:
            with eng.begin() as c:
                c.execute(text('DROP SCHEMA IF EXISTS "public" CASCADE'))
                c.execute(text('CREATE SCHEMA "public"'))
        finally:
            eng.dispose()
    return _alembic_config(), url


def test_a_downgrade_upgrade_cycle_leaves_no_ai_conversation_tables(tmp_path):
    """The schema must forbid stored conversations in EVERY reachable state.

    `f9e1a2b3c4d5`'s `downgrade()` re-created both tables — reversibility applied
    mechanically to a table that was retired **by decision, on the user's behalf**
    (D-016), not by a schema preference. A migration is reversible so an operator can
    back out of a change; it is not licence to restore the one structure the product
    promises not to have. Commitment 6 is a promise about the product, not about a
    particular revision of it.
    """
    from app.core.config import reload_settings

    old_dir = os.environ.get("LEDGERFRAME_DATA_DIR")
    try:
        cfg, url = _alembic_on(tmp_path / "cycle")
        command.upgrade(cfg, "head")
        eng = create_engine(url)

        at_head = set(inspect(eng).get_table_names())
        assert not (at_head & RETIRED_AI_TABLES), (
            f"At head the database has {sorted(at_head & RETIRED_AI_TABLES)} — D-016 dropped them."
        )
        assert len(at_head) > 20, (
            f"Only {len(at_head)} tables at head — the migration chain did not run, so the "
            "assertion above proved nothing."
        )

        command.downgrade(cfg, BEFORE_THE_DROP)
        after_downgrade = set(inspect(eng).get_table_names())
        assert not (after_downgrade & RETIRED_AI_TABLES), (
            f"downgrade() re-created {sorted(after_downgrade & RETIRED_AI_TABLES)}. The product "
            "tells the user on the Legal page that AI questions and answers are NEVER "
            "persisted; a downgrade must not hand the schema a place to persist them. Drop "
            "them from downgrade() with the reason written, as the other retired tables' "
            "reversibility is preserved."
        )

        command.upgrade(cfg, "head")
        after_cycle = set(inspect(eng).get_table_names())
        assert not (after_cycle & RETIRED_AI_TABLES)
        assert after_cycle == at_head, (
            "The downgrade→upgrade cycle did not return the schema to head: "
            f"missing {sorted(at_head - after_cycle)}, unexpected {sorted(after_cycle - at_head)}. "
            "Commitment 6's fix must not cost general reversibility."
        )
        eng.dispose()
    finally:
        if old_dir is not None:
            os.environ["LEDGERFRAME_DATA_DIR"] = old_dir
        else:
            os.environ.pop("LEDGERFRAME_DATA_DIR", None)
        reload_settings()


# ─── layer 3: asking a question writes nothing, anywhere ────────────────────────

async def _row_counts(session) -> dict[str, int]:
    counts = {}
    for name in sorted(Base.metadata.tables):
        counts[name] = (await session.execute(text(f"SELECT COUNT(*) FROM {name}"))).scalar_one()
    return counts


async def test_a_full_ai_chat_roundtrip_persists_nothing(app_client, session):
    """The layer that survives a redesign: no table gains a row when a question is asked.

    Layers 1–2 assert a *specific* table cannot exist. If some future feature persisted a
    conversation under a different name, they would both stay green. This one would not.
    """
    before = await _row_counts(session)

    r = await app_client.post("/api/v1/ai/chat", json={"question": "How is my portfolio doing?"})
    assert r.status_code == 200, r.text
    body = r.text
    assert body.strip(), "the chat stream returned nothing — the round trip did not happen"

    await session.commit()
    after = await _row_counts(session)

    grew = {t: (before[t], after[t]) for t in before if after[t] != before[t]}
    assert grew == {}, (
        f"Asking one AI question changed row counts: {grew}. Commitment 6 promises AI "
        "questions and answers are never persisted. (If a future feature legitimately "
        "writes derived OUTPUT — as refresh_briefing does for the briefing string — it "
        "must be exempted here BY NAME with a written reason, never by relaxing this "
        "comparison.)"
    )
