"""Shared API dependencies: authentication for mutating endpoints.

Auth model: a single local PIN. When no PIN is set (fresh demo install) the app
is unlocked and mutations are allowed locally — but if LAN access is enabled a
PIN is mandatory. The session token is a signed, time-limited cookie/bearer.
"""

from __future__ import annotations

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import verify_token
from app.db.base import get_session
from app.models import User

SESSION_COOKIE = "lf_session"


async def get_db() -> AsyncSession:  # pragma: no cover - thin wrapper
    async for s in get_session():
        yield s


async def pin_is_set(session: AsyncSession) -> bool:
    user = (await session.execute(select(User).limit(1))).scalars().first()
    return bool(user and user.pin_hash)


async def require_auth(
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Guard mutating endpoints. Raises 401 when a PIN is set and no valid token."""
    settings = get_settings()
    token = lf_session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]

    has_pin = await pin_is_set(session)

    # If LAN access is on, a PIN must exist and a valid token is always required.
    if settings.allow_lan and not has_pin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A local PIN must be set before enabling LAN access.",
        )

    if not has_pin:
        return  # local-only, unlocked demo install

    if not token or not verify_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Locked. Unlock with your PIN.",
            headers={"WWW-Authenticate": "Bearer"},
        )
