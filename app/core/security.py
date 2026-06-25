"""Local authentication: Argon2 PIN hashing and signed session tokens.

There are no remote accounts. A single local PIN guards mutation endpoints and
the auto-lock screen. Tokens are signed with the app secret and time-limited.
"""

from __future__ import annotations

import time

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
    return _serializer().dumps({"sub": subject, "iat": int(time.time())})


def verify_token(token: str, max_age_seconds: int | None = None) -> bool:
    if max_age_seconds is None:
        max_age_seconds = max(get_settings().autolock_minutes, 1) * 60
    try:
        _serializer().loads(token, max_age=max_age_seconds)
        return True
    except (BadSignature, SignatureExpired):
        return False
