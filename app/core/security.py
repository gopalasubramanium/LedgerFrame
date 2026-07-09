# SPDX-License-Identifier: AGPL-3.0-or-later
"""Local authentication: Argon2 PIN hashing and signed session tokens.

There are no remote accounts. A single local PIN guards mutation endpoints and
the auto-lock screen. Tokens are signed with the app secret and time-limited.
"""

from __future__ import annotations

import hashlib
import secrets
import time
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.config import get_settings

_hasher = PasswordHasher()  # sensible defaults; tuned for Pi 5 by argon2-cffi


def hash_pin(pin: str) -> str:
    if not pin or len(pin) < 4:
        raise ValueError("PIN must be at least 4 digits")
    return _hasher.hash(pin)


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        _hasher.verify(pin_hash, pin)
        return True
    except (VerifyMismatchError, InvalidHashError, Exception):
        return False


def needs_rehash(pin_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(pin_hash)
    except InvalidHashError:
        return True


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().secret_key, salt="ledgerframe-session")


def issue_token(subject: str = "local") -> str:
    # jti (§1.7) makes a token individually revocable; iat backs the revoke-all cutoff.
    return _serializer().dumps({"sub": subject, "iat": time.time(), "jti": uuid.uuid4().hex})


def decode_token(token: str, max_age_seconds: int | None = None) -> dict | None:
    """Return the token payload if the signature is valid and it hasn't expired, else None.
    Does NOT check revocation — callers with a DB session use ``services.sessions``."""
    if max_age_seconds is None:
        max_age_seconds = max(get_settings().autolock_minutes, 1) * 60
    try:
        payload = _serializer().loads(token, max_age=max_age_seconds)
        return payload if isinstance(payload, dict) else None
    except (BadSignature, SignatureExpired):
        return None


# --- Scoped read-only API tokens (§2.4) ------------------------------------ #
API_TOKEN_PREFIX = "lft_"


def hash_api_token(raw: str) -> str:
    """SHA-256 hex of a raw API token. The token is high-entropy random, so a fast hash is
    safe and allows an indexed O(1) lookup (unlike the low-entropy PIN, which uses Argon2)."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_api_token() -> tuple[str, str, str]:
    """Return (raw, token_hash, prefix). The raw is shown once; only the hash is stored."""
    raw = API_TOKEN_PREFIX + secrets.token_urlsafe(32)
    return raw, hash_api_token(raw), raw[:12]
