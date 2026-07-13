#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Wipe the database and re-seed DEMO data. Asks for confirmation.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
# shellcheck source=lib/datadir.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/datadir.sh"   # the ONE data-dir answer (release-readiness Part B/1)
DATA_DIR="$(lf_data_dir)"   # was $REPO_DIR/data — a DESTRUCTIVE script with its own idea of "where"
DB="$DATA_DIR/db/ledgerframe.db"
read -rp "This deletes $DB and re-seeds demo data. Continue? [y/N] " ans
[[ "$ans" =~ ^[Yy]$ ]] || { echo "aborted"; exit 0; }
rm -f "$DB" "$DB-wal" "$DB-shm"
# shellcheck disable=SC1091
[[ -f .venv/bin/activate ]] && source .venv/bin/activate
LEDGERFRAME_MARKET_PROVIDER=mock python3 -c "
import asyncio
from app.db.base import Base, get_engine, get_sessionmaker
from app.seed.demo import seed_demo_data
async def main():
    async with get_engine().begin() as c: await c.run_sync(Base.metadata.create_all)
    async with get_sessionmaker()() as s:
        await seed_demo_data(s); await s.commit()
    print('demo data re-seeded')
asyncio.run(main())
"
