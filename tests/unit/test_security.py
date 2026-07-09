# SPDX-License-Identifier: AGPL-3.0-or-later
"""Argon2 PIN hashing.

Token round-trip/expiry/tamper tests were removed with `verify_token` (D-080):
that helper is deleted, so the tests that exercised it are gone too. Signed-token
behaviour is covered via the DB-backed auth flow in the integration suite.
"""

from __future__ import annotations

import pytest

from app.core.security import hash_pin, verify_pin


def test_pin_hash_and_verify():
    h = hash_pin("1234")
    assert h != "1234"
    assert verify_pin("1234", h)
    assert not verify_pin("9999", h)


def test_short_pin_rejected():
    with pytest.raises(ValueError):
        hash_pin("12")
