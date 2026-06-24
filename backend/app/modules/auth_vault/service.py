"""Token vault service: encrypted storage + OAuth2 client-credentials refresh."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.security import decrypt_secret, encrypt_secret, mask_secret
from app.modules.auth_vault.models import AuthKind, TokenProfile


# ---------- schemas ----------
class TokenProfileIn(BaseModel):
    name: str
    kind: AuthKind
    environment_id: uuid.UUID | None = None
    config: dict[str, Any] = {}
    secrets: dict[str, str] = {}


class TokenProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    kind: AuthKind
    environment_id: uuid.UUID | None
    config: dict[str, Any]
    masked_secrets: dict[str, str]
    has_access_token: bool
    access_token_expires_at: datetime | None
    created_at: datetime


# ---------- service ----------
class TokenVaultService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---- CRUD ----
    async def list(self) -> list[TokenProfile]:
        result = await self.db.execute(select(TokenProfile).order_by(TokenProfile.created_at.desc()))
        return list(result.scalars().all())

    async def get(self, tid: uuid.UUID) -> TokenProfile:
        prof = await self.db.get(TokenProfile, tid)
        if not prof:
            raise NotFoundError("Token profile not found")
        return prof

    async def create(self, payload: TokenProfileIn) -> TokenProfile:
        prof = TokenProfile(
            name=payload.name,
            kind=payload.kind,
            environment_id=payload.environment_id,
            config=payload.config,
            encrypted_secrets=encrypt_secret(json.dumps(payload.secrets)),
        )
        self.db.add(prof)
        await self.db.commit()
        await self.db.refresh(prof)
        return prof

    async def delete(self, tid: uuid.UUID) -> None:
        prof = await self.get(tid)
        await self.db.delete(prof)
        await self.db.commit()

    # ---- helpers ----
    def to_out(self, prof: TokenProfile) -> TokenProfileOut:
        secrets = self._secrets(prof)
        return TokenProfileOut(
            id=prof.id,
            name=prof.name,
            kind=prof.kind,
            environment_id=prof.environment_id,
            config=prof.config,
            masked_secrets={k: mask_secret(v) for k, v in secrets.items()},
            has_access_token=bool(prof.encrypted_access_token),
            access_token_expires_at=prof.access_token_expires_at,
            created_at=prof.created_at,
        )

    def _secrets(self, prof: TokenProfile) -> dict[str, str]:
        if not prof.encrypted_secrets:
            return {}
        return json.loads(decrypt_secret(prof.encrypted_secrets))

    # ---- token resolution ----
    async def get_access_token(self, prof: TokenProfile, force_refresh: bool = False) -> str:
        """Return a usable access token, refreshing if needed."""
        if (
            not force_refresh
            and prof.encrypted_access_token
            and prof.access_token_expires_at
            and prof.access_token_expires_at - timedelta(seconds=30) > datetime.now(timezone.utc)
        ):
            return decrypt_secret(prof.encrypted_access_token)

        if prof.kind == AuthKind.bearer:
            tok = self._secrets(prof).get("token")
            if not tok:
                raise ValidationError("Bearer profile missing 'token' secret")
            return tok

        if prof.kind == AuthKind.oauth2_client_credentials:
            return await self._refresh_client_credentials(prof)

        raise ValidationError(f"Token refresh not implemented for kind={prof.kind.value}")

    async def _refresh_client_credentials(self, prof: TokenProfile) -> str:
        secrets = self._secrets(prof)
        token_url = prof.config.get("token_url")
        if not token_url:
            raise ValidationError("OAuth2 profile missing 'token_url'")
        data = {
            "grant_type": "client_credentials",
            "client_id": secrets.get("client_id") or prof.config.get("client_id"),
            "client_secret": secrets.get("client_secret"),
            "scope": prof.config.get("scope", ""),
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(token_url, data=data)
            resp.raise_for_status()
            payload = resp.json()
        token = payload["access_token"]
        expires_in = int(payload.get("expires_in", 3600))
        prof.encrypted_access_token = encrypt_secret(token)
        prof.access_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        await self.db.commit()
        return token

    async def build_request_auth(self, prof: TokenProfile) -> tuple[dict[str, str], httpx.Auth | None]:
        """Return (headers, auth) suitable to attach to an outgoing httpx request."""
        if prof.kind == AuthKind.basic:
            s = self._secrets(prof)
            return {}, httpx.BasicAuth(s.get("username", ""), s.get("password", ""))
        if prof.kind == AuthKind.api_key:
            key_name = prof.config.get("header_name", "X-API-Key")
            return {key_name: self._secrets(prof).get("api_key", "")}, None
        token = await self.get_access_token(prof)
        return {"Authorization": f"Bearer {token}"}, None
