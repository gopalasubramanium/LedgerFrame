# SPDX-License-Identifier: AGPL-3.0-or-later
"""Local PIN authentication: set PIN, unlock, lock."""

from __future__ import annotations

import math

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SESSION_COOKIE, get_db, pin_is_set
from app.core import ratelimit
from app.core.config import get_settings
from app.core.security import hash_pin, issue_token, verify_pin
from app.models import AuditEvent, User
from app.services.audit import record_security_event
from app.services.sessions import revoke_all, revoke_token, token_is_valid

router = APIRouter()


class PinPayload(BaseModel):
    # Minimum 6 digits — the SECURITY-BASELINE §3 / D-002 policy, enforced at the API
    # boundary (not only in the frontend). page-first-run-checklist §F-8.
    pin: str = Field(min_length=6, max_length=32)


_LOOPBACK = frozenset({"127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"})


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "local"


def _is_loopback(request: Request) -> bool:
    return bool(request.client and request.client.host in _LOOPBACK)


async def _enforce_rate_limit(request: Request) -> None:
    """Raise 429 (with Retry-After) when this client is in backoff/lockout (§1.2)."""
    wait = ratelimit.retry_after(_client_key(request))
    if wait > 0:
        await record_security_event("rate_limited", _client_key(request))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many attempts — please wait and try again.",
            headers={"Retry-After": str(int(math.ceil(wait)))},
        )


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, httponly=True, samesite="strict",
        secure=False, max_age=get_settings().autolock_minutes * 60, path="/",
    )


@router.post("/auth/set-pin")
async def set_pin(
    payload: PinPayload,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """Set the local PIN.

    The FIRST PIN can always be set locally (initial setup) — this must not be
    blocked by the "LAN needs a PIN" rule, or you could never set one. CHANGING an
    existing PIN requires an unlocked session (valid token).
    """
    await _enforce_rate_limit(request)
    user = (await session.execute(select(User).limit(1))).scalars().first()
    # §1.3 — first-PIN takeover window: when the app is reachable beyond loopback, the
    # FIRST PIN may only be set from the device itself, so a stranger on the network can't
    # claim an unclaimed instance. Changing an existing PIN (below) already needs a token.
    if not (user and user.pin_hash) and get_settings().lan_exposed and not _is_loopback(request):
        await record_security_event("first_pin_remote_blocked", _client_key(request))
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "The first PIN must be set from the device itself (loopback), not over the network.",
        )
    if user and user.pin_hash:
        token = lf_session
        if not token and authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:]
        if not token or not await token_is_valid(token, session):
            ratelimit.record_failure(_client_key(request))
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unlock first to change the PIN")
    ratelimit.record_success(_client_key(request))
    if user is None:
        user = User(name="Owner")
        session.add(user)
    user.pin_hash = hash_pin(payload.pin)
    await revoke_all(session)  # §1.7 — setting/changing the PIN revokes every existing session
    session.add(AuditEvent(category="auth", action="set_pin"))
    await session.flush()
    token = issue_token()
    _set_cookie(response, token)
    return {"ok": True, "token": token}


@router.post("/auth/unlock")
async def unlock(
    payload: PinPayload, request: Request, response: Response,
    session: AsyncSession = Depends(get_db),
) -> dict:
    await _enforce_rate_limit(request)
    user = (await session.execute(select(User).limit(1))).scalars().first()
    if not user or not user.pin_hash:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No PIN is set")
    if not verify_pin(payload.pin, user.pin_hash):
        ratelimit.record_failure(_client_key(request))
        await record_security_event("unlock_failed", _client_key(request))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect PIN")
    ratelimit.record_success(_client_key(request))
    session.add(AuditEvent(category="auth", action="unlock"))
    token = issue_token()
    _set_cookie(response, token)
    return {"ok": True, "token": token}


@router.post("/auth/lock")
async def lock(
    response: Response,
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    # §1.7 — revoke the presented token server-side so a replayed copy can't be reused.
    token = lf_session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    await revoke_token(token, session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/state")
async def auth_state(session: AsyncSession = Depends(get_db)) -> dict:
    return {"pin_set": await pin_is_set(session)}
