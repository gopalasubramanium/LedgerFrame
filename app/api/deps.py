# SPDX-License-Identifier: AGPL-3.0-or-later
"""Shared API dependencies: authentication for mutating endpoints.

Auth model: a single local PIN. When no PIN is set (fresh demo install) the app
is unlocked and mutations are allowed locally — but if LAN access is enabled a
PIN is mandatory. The session token is a signed, time-limited cookie/bearer.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.base import get_session
from app.models import User
from app.services.sessions import token_is_valid

SESSION_COOKIE = "lf_session"


def _bearer(lf_session: str | None, authorization: str | None) -> str | None:
    if lf_session:
        return lf_session
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]
    return None


def _token_scheme(authorization: str | None) -> str | None:
    """Raw API token from `Authorization: Token <raw>` — distinct from a `Bearer` session."""
    if authorization and authorization.lower().startswith("token "):
        return authorization[6:].strip() or None
    return None


async def _api_token_or_none(request: Request, session: AsyncSession, authorization: str | None):
    """Validate an `Authorization: Token` header and enforce read-only (§2.4).

    Returns the ApiToken for a valid GET/HEAD; raises 403 on any mutating method; raises 401
    if the token is invalid/revoked; returns None when no Token header is present."""
    raw = _token_scheme(authorization)
    if raw is None:
        return None
    from app.services.api_tokens import validate_token

    tok = await validate_token(session, raw)
    if tok is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or revoked API token.")
    if request.method not in ("GET", "HEAD"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This API token is read-only.")
    return tok


def _read_stays_open(path: str) -> bool:
    """Endpoints that must remain reachable even when locked, so the lock screen can
    check state and unlock. All auth endpoints; everything else under /api/v1 is gated.

    `/api/v1/legal` JOINED THIS LIST 2026-07-20 (page-legal §11-E2), and the reason is a defect
    found by driving a browser rather than by reading the code. The acceptance gate exempts the
    legal endpoints from the CONSENT check — but they were still behind the PIN check, which runs
    immediately after. On a PIN-protected install with no acceptance, the shell therefore could not
    read the consent state or fetch the gate's copy, and rendered THE PIN PROMPT INSTEAD OF THE
    CONSENT PANEL: the server refusing data for want of consent while the UI asked for a PIN, and
    `/legal` unreadable before accepting on exactly the installs most likely to have a real user
    behind them. Every test in the gate's own module runs on a PIN-less install, so nothing caught
    it.

    WHAT THIS OPENS, stated exactly rather than waved at, because widening a lock deserves it:
      * `/legal`            — the document. It ships in the source tree; the PIN was never what
                              kept it private, and a gate that hides the text it demands consent
                              to is the failure the exemption exists to prevent.
      * `/legal/gate-copy`  — the gate's own strings. Same category.
      * `/legal/acceptance` — a three-valued status string, a content hash, and a timestamp.
    NO holding, NO figure, NO personal record, and nothing an attacker on the loopback interface
    could not already read out of the repository. The PIN still guards every byte of user data.
    """
    return path.startswith("/api/v1/auth/") or path.startswith("/api/v1/legal")


# --- The acceptance gate's exempt set (page-legal §11-5, owner 2026-07-20) --------------------- #
#
# THE GATE IS SERVER-SIDE, AND THE CHOICE WAS NOT CLOSE. A frontend-only lock is theatre: the
# React app would refuse to render while `curl http://127.0.0.1:PORT/api/v1/portfolio` returned
# the whole portfolio to anyone who skipped the UI. That is not a weaker version of a gate, it is
# the absence of one — so the check lives here, beside `require_read_auth`, on the router-wide
# dependency that every /api/v1 read already passes through.
#
# THE EXEMPT SET IS EXACTLY WHAT RENDERING THE GATE REQUIRES, AND NOTHING ELSE. Each entry earns
# its place:
#   * `/legal`            — the document itself. A gate that demanded acceptance of a text it
#                           refused to show would be asking for consent that cannot be informed.
#                           This is the one exemption that is a MATTER OF PRINCIPLE, not plumbing.
#   * `/legal/acceptance` — read, so the gate can ask whether it should be showing itself;
#                           write, so an answer can be recorded.
#   * `/legal/gate-copy`  — the gate's own served strings.
#   * `/auth/*`           — already open via `_read_stays_open`; the PIN flow is untouched by this
#                           and composes with it (SECURITY-BASELINE §20-P unchanged).
#   * `/system/status`    — the shell reads it before it can render anything at all, including the
#                           gate. ⚠ THE ONE ENTRY THAT IS NOT SELF-EVIDENT, so it is named as a
#                           deliberate widening rather than buried: it serves version, demo flag,
#                           base currency and whether a PIN is set. It exposes NO holding, NO
#                           figure and NO personal record — but it is not nothing, and if the gate
#                           is ever asked to be strict, this is the entry to revisit first.
#
# WHAT THE GATE IS NOT. It is a CONSENT boundary, not an authentication one. It composes with the
# PIN flow and replaces no part of it: an install with no PIN is exactly as protected after this
# milestone as before it, and nothing here should ever be read as a security control.
_ACCEPTANCE_EXEMPT_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/legal",          # covers /legal, /legal/acceptance, /legal/gate-copy
    "/api/v1/system/status",
)


def _acceptance_not_required(path: str) -> bool:
    return any(path.startswith(p) for p in _ACCEPTANCE_EXEMPT_PREFIXES)


_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"})


async def get_db() -> AsyncIterator[AsyncSession]:  # pragma: no cover - thin wrapper
    async for s in get_session():
        yield s


async def pin_is_set(session: AsyncSession) -> bool:
    user = (await session.execute(select(User).limit(1))).scalars().first()
    return bool(user and user.pin_hash)


class PinConfirm(BaseModel):
    """Body for a D-103 irreversible action — the freshly-entered PIN (§14dr-20)."""

    pin: str = Field(min_length=6, max_length=32)


async def verify_fresh_pin(session: AsyncSession, pin: str | None) -> None:
    """D-103 (SECURITY-BASELINE §3): an irreversible purge ALWAYS demands a freshly-entered
    PIN. An unlocked/ambient session NEVER satisfies it — the submitted PIN is verified
    against the stored hash, and the session token is deliberately not accepted in its place,
    so the point of no return requires deliberate re-entry rather than ambient authority.

    Pair this with ``require_pin`` on the endpoint: the guard keeps the action off API tokens
    and unprotected installs; this checks the fresh PIN that the session can never stand in for.
    """
    from app.core.security import verify_pin

    user = (await session.execute(select(User).limit(1))).scalars().first()
    if not user or not user.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Set a PIN before permanently deleting data.",
        )
    if not pin or not verify_pin(pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Enter your PIN to permanently delete — an unlocked session is not enough.",
        )


async def require_auth(
    request: Request,
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Guard mutating endpoints. Raises 401 when a PIN is set and no valid session token.

    A read-only API token can never mutate: if a Token header is present it is rejected here
    with 403 (§2.4)."""
    await _api_token_or_none(request, session, authorization)  # 403 on a mutation with a token
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

    if not token or not await token_is_valid(token, session):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Locked. Unlock with your PIN.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_read_auth(
    request: Request,
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Gate data-bearing endpoints when a PIN is set (§1.1).

    Applied router-wide to /api/v1. When **no PIN** is set the current open behaviour is
    preserved. Auth endpoints (and CORS preflight) stay open so the lock screen can check
    state and unlock. Mutating endpoints additionally carry ``require_auth``."""
    if request.method == "OPTIONS" or _read_stays_open(request.url.path):
        return

    # THE ACCEPTANCE GATE, BEFORE THE PIN CHECK (page-legal §11-5). Order matters and it is the
    # entry sequence the owner ruled: terms first, then unlock. Placing it after the PIN check
    # would leave an unaccepted, PIN-less install wide open — which is every fresh install.
    #
    # It runs for API TOKENS TOO. A read-only token is a LAN widget reading a summary out of this
    # database; the terms have not been accepted for this install, and a token is not a second
    # party who can be exempt from them.
    if not _acceptance_not_required(request.url.path):
        from app.services.legal import is_accepted

        if not await is_accepted(session):
            raise HTTPException(
                status_code=status.HTTP_451_UNAVAILABLE_FOR_LEGAL_REASONS,
                detail="The Legal terms have not been accepted on this install.",
            )

    # §2.4 — a valid read-only API token authenticates GET/HEAD (and is rejected on any
    # mutation with 403). This applies regardless of whether a PIN is set.
    if await _api_token_or_none(request, session, authorization) is not None:
        return
    if not await pin_is_set(session):
        return  # no PIN → open, exactly as before
    token = _bearer(lf_session, authorization)
    if not token or not await token_is_valid(token, session):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Locked. Unlock with your PIN.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_metrics_access(
    request: Request,
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """/metrics gate (§2.3): allowed from loopback, or with a valid session — never
    unauthenticated over the network, consistent with the Phase-1 auth pattern."""
    if request.client and request.client.host in _LOOPBACK_HOSTS:
        return
    token = _bearer(lf_session, authorization)
    if not token or not await token_is_valid(token, session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Metrics are restricted to loopback or an authenticated session.",
        )


async def require_session(
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Require a human session; reject API tokens outright (§2.4).

    Used for token management so a read-only API token can neither list, mint, nor revoke
    tokens. Open on a no-PIN local install, consistent with the rest of the auth model."""
    if _token_scheme(authorization) is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API tokens cannot manage tokens — use your session/PIN.",
        )
    if not await pin_is_set(session):
        return  # local unlocked
    token = _bearer(lf_session, authorization)
    if not token or not await token_is_valid(token, session):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticate with your PIN.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_pin(
    session: AsyncSession = Depends(get_db),
    lf_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Guard PERMANENT, irreversible actions (§3.5 hard delete / empty trash).

    Strictly stronger than ``require_auth``/``require_session``: a valid human session is
    ALWAYS required, and — because destroying data must be impossible on an unprotected
    install — it **refuses outright when no PIN has been set** (403), rather than falling
    open the way the other guards do locally. API tokens can never authorise it."""
    if _token_scheme(authorization) is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API tokens cannot permanently delete — use your session/PIN.",
        )
    if not await pin_is_set(session):
        # No PIN → no way to authorise an irreversible delete. Set a PIN first.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Set a PIN before permanently deleting data.",
        )
    token = _bearer(lf_session, authorization)
    if not token or not await token_is_valid(token, session):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticate with your PIN to permanently delete.",
            headers={"WWW-Authenticate": "Bearer"},
        )
