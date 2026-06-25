"""Argon2 PIN hashing and signed session tokens."""

from __future__ import annotations

import time

import pytest

from app.core.security import hash_pin, issue_token, verify_pin, verify_token


def test_pin_hash_and_verify():
    h = hash_pin("1234")
    assert h != "1234"
    assert verify_pin("1234", h)
    assert not verify_pin("9999", h)


def test_short_pin_rejected():
    with pytest.raises(ValueError):
        hash_pin("12")


def test_token_roundtrip():
    t = issue_token()
    assert verify_token(t)


def test_token_expiry():
    t = issue_token()
    # Zero max-age → already expired.
    time.sleep(1)
    assert not verify_token(t, max_age_seconds=0)


def test_tampered_token_rejected():
    t = issue_token()
    assert not verify_token(t + "x")
