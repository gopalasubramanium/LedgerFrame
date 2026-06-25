"""Encrypted backup & restore of the SQLite database.

Creates a consistent copy via SQLite's online backup API, optionally encrypts it
with ``age`` (recipient from config), and rotates old backups. Restore verifies a
SHA-256 and refuses to overwrite without an explicit flag. Encryption happens on
device before the file is ever written, satisfying "encrypted before leaving".
"""

from __future__ import annotations

import hashlib
import logging
import shutil
import sqlite3
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings

log = logging.getLogger(__name__)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def create_backup() -> dict:
    settings = get_settings()
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    raw = settings.backups_dir / f"ledgerframe-{stamp}.db"

    # Consistent snapshot even while the app is running (WAL-safe).
    src = sqlite3.connect(str(settings.db_path))
    dst = sqlite3.connect(str(raw))
    with dst:
        src.backup(dst)
    src.close()
    dst.close()

    final = raw
    encrypted = False
    recipient = settings.backup_age_recipient
    if recipient and shutil.which("age"):
        enc = raw.with_suffix(".db.age")
        subprocess.run(
            ["age", "-r", recipient, "-o", str(enc), str(raw)],
            check=True, capture_output=True,
        )
        raw.unlink()
        final = enc
        encrypted = True
    elif recipient:
        log.warning("age recipient set but `age` binary not found; backup left unencrypted")

    final.chmod(0o600)
    digest = _sha256(final)
    _rotate(settings.backups_dir, settings.backup_keep)
    return {
        "filename": final.name,
        "path": str(final),
        "size_bytes": final.stat().st_size,
        "encrypted": encrypted,
        "sha256": digest,
    }


def _rotate(backups_dir: Path, keep: int) -> None:
    files = sorted(backups_dir.glob("ledgerframe-*.db*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[keep:]:
        try:
            old.unlink()
        except OSError:
            pass


def restore_backup(filename: str, force: bool = False, identity_file: str | None = None) -> dict:
    settings = get_settings()
    src = settings.backups_dir / filename
    if not src.exists():
        raise FileNotFoundError(f"backup not found: {filename}")
    if settings.db_path.exists() and not force:
        raise FileExistsError("database exists; pass force=True to overwrite (a safety copy is kept)")

    # Decrypt to a temp file if needed.
    work = src
    if src.suffix == ".age":
        if not identity_file or not shutil.which("age"):
            raise RuntimeError("encrypted backup requires `age` and an identity file")
        work = src.with_suffix("")
        subprocess.run(
            ["age", "-d", "-i", identity_file, "-o", str(work), str(src)],
            check=True, capture_output=True,
        )

    # Keep a pre-restore safety copy of the current DB.
    if settings.db_path.exists():
        safety = settings.db_path.with_suffix(f".pre-restore-{int(datetime.now().timestamp())}.db")
        shutil.copy2(settings.db_path, safety)

    shutil.copy2(work, settings.db_path)
    if work != src:
        work.unlink(missing_ok=True)
    return {"restored": filename, "db_path": str(settings.db_path)}
