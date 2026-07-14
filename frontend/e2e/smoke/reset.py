#!/usr/bin/env python3
# ⚠ DEV-ONLY reset for the first-run smoke pre-pass (page-first-run-checklist §F-5/§F-9/
# §F-10). DESTRUCTIVE: clears the dev settings table + PIN. NEVER part of npm run check
# or CI. Run with the backend STOPPED, then restart it.
#
# What it does deterministically (fixes F-5/F-9/F-10):
#   • reads the ACTIVE repo .env for LEDGERFRAME_DATA_DIR → the real DB path (F-9),
#   • snapshots the LEDGERFRAME_* lines once (e2e/smoke/.env-snapshot) and RESTORES them
#     every reset, so the overlay's writes (provider/currency/timezone) don't drift the
#     .env across runs (F-5) — provider stays 'mock', never 'yahoo' hammering the network,
#   • resets the DB via the Python sqlite3 module (no sqlite3 CLI needed — F-10).
#
# Usage (from repo root):  python frontend/e2e/smoke/reset.py
import os
import re
import sqlite3
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ENV = REPO / ".env"
SNAPSHOT = REPO / "frontend" / "e2e" / "smoke" / ".env-snapshot"


def env_val(text: str, key: str, default: str) -> str:
    m = re.search(rf"^{key}=(.*)$", text, flags=re.M)
    return m.group(1).strip() if m else default


def main() -> None:
    text = ENV.read_text()

    # Snapshot the LEDGERFRAME_* lines once (the pristine baseline); restore each run.
    lf_lines = [ln for ln in text.splitlines() if ln.startswith("LEDGERFRAME_")]
    if not SNAPSHOT.exists():
        SNAPSHOT.write_text("\n".join(lf_lines) + "\n")
        print(f"[reset] snapshotted {len(lf_lines)} LEDGERFRAME_* lines → {SNAPSHOT.name}")
    else:
        snap = {ln.split("=", 1)[0]: ln.split("=", 1)[1]
                for ln in SNAPSHOT.read_text().splitlines() if "=" in ln}
        for k, v in snap.items():
            text = re.sub(rf"^{re.escape(k)}=.*$", f"{k}={v}", text, flags=re.M)
        ENV.write_text(text)
        print(f"[reset] restored {len(snap)} LEDGERFRAME_* lines from snapshot")

    data_dir = os.environ.get("LEDGERFRAME_DATA_DIR") or env_val(text, "LEDGERFRAME_DATA_DIR", "")
    db = Path(data_dir).expanduser() / "db" / "ledgerframe.db"
    if not db.exists():
        print(f"[reset] no DB yet at {db} — boot the backend once first; nothing to reset.")
        return
    c = sqlite3.connect(str(db))
    c.execute("DELETE FROM settings")
    c.execute("UPDATE users SET pin_hash=NULL")
    c.commit()
    n = c.execute("SELECT count(*) FROM settings").fetchone()[0]
    pins = [bool(r[0]) for r in c.execute("SELECT pin_hash FROM users").fetchall()]
    c.close()
    print(f"[reset] DB reset at {db} — settings rows: {n}; pin set: {pins}")


if __name__ == "__main__":
    main()
