"""Local PIN authentication: set PIN, unlock, lock."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SESSION_COOKIE, get_db, pin_is_set, require_auth
from app.core.config import get_settings
from app.core.security import hash_pin, issue_token, verify_pin
from app.models import AuditEvent, User

router = APIRouter()


class PinPayload(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, httponly=True, samesite="strict",
        secure=False, max_age=get_settings().autolock_minutes * 60, path="/",
    )


@router.post("/auth/set-pin")
async def set_pin(
    payload: PinPayload,
    response: Response,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),  # if a PIN already exists, must be unlocked to change it
) -> dict:
    user = (await session.execute(select(User).limit(1))).scalars().first()
    if user is None:
        user = User(name="Owner")
        session.add(user)
    user.pin_hash = hash_pin(payload.pin)
    session.add(AuditEvent(category="auth", action="set_pin"))
    await session.flush()
    token = issue_token()
    _set_cookie(response, token)
    return {"ok": True, "token": token}


@router.post("/auth/unlock")
async def unlock(
    payload: PinPayload, response: Response, session: AsyncSession = Depends(get_db)
) -> dict:
    user = (await session.execute(select(User).limit(1))).scalars().first()
    if not user or not user.pin_hash:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No PIN is set")
    if not verify_pin(payload.pin, user.pin_hash):
        session.add(AuditEvent(category="security", action="unlock_failed"))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect PIN")
    session.add(AuditEvent(category="auth", action="unlock"))
    token = issue_token()
    _set_cookie(response, token)
    return {"ok": True, "token": token}


@router.post("/auth/lock")
async def lock(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/state")
async def auth_state(session: AsyncSession = Depends(get_db)) -> dict:
    return {"pin_set": await pin_is_set(session)}
