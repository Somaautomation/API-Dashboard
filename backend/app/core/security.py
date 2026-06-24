"""Security primitives: password hashing, JWT, symmetric encryption (vault)."""
from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from cryptography.fernet import Fernet

from app.core.config import settings


# ---------- passwords ----------
def hash_password(password: str) -> str:
    # bcrypt has a 72-byte limit; truncate defensively.
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------- JWT ----------
def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    payload = {
        "sub": subject,
        "iat": _now(),
        "exp": _now() + timedelta(minutes=settings.jwt_access_ttl_minutes),
        "type": "access",
        **(extra or {}),
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    payload = {
        "sub": subject,
        "iat": _now(),
        "exp": _now() + timedelta(days=settings.jwt_refresh_ttl_days),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.app_secret_key, algorithms=[settings.jwt_algorithm])


# ---------- Fernet vault ----------
def _fernet() -> Fernet:
    key = settings.app_encryption_key
    if not key:
        # Deterministic dev key derived from APP_SECRET_KEY — DO NOT use in prod.
        digest = hashlib.sha256(settings.app_secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()


def mask_secret(value: str, visible: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= visible:
        return "*" * len(value)
    return f"{'*' * (len(value) - visible)}{value[-visible:]}"
