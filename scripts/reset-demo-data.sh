#!/usr/bin/env bash
# Wipe the database and re-seed DEMO data. Asks for confirmation.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
DATA_DIR="${LEDGERFRAME_DATA_DIR:-$REPO_DIR/data}"
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
