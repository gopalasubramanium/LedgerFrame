"""Backup create/restore endpoints (auth-gated)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.models import AuditEvent, BackupRecord
from app.services import backup as backup_svc

router = APIRouter()


@router.post("/backup/create", dependencies=[Depends(require_auth)])
async def create_backup(session: AsyncSession = Depends(get_db)) -> dict:
    info = backup_svc.create_backup()
    session.add(BackupRecord(
        filename=info["filename"], size_bytes=info["size_bytes"],
        encrypted=info["encrypted"], sha256=info["sha256"],
    ))
    session.add(AuditEvent(category="system", action="backup_create", detail=info["filename"]))
    await session.flush()
    return info


class RestoreIn(BaseModel):
    filename: str
    force: bool = False
    identity_file: str | None = None


@router.post("/backup/restore", dependencies=[Depends(require_auth)])
async def restore_backup(payload: RestoreIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        result = backup_svc.restore_backup(payload.filename, payload.force, payload.identity_file)
    except (FileNotFoundError, FileExistsError, RuntimeError) as exc:
        raise HTTPException(400, str(exc)) from exc
    session.add(AuditEvent(category="system", action="backup_restore", detail=payload.filename))
    return result
