"""Encrypted token profiles for OAuth2 / Bearer / API Key / Basic Auth."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AuthKind(str, enum.Enum):
    oauth2_client_credentials = "oauth2_client_credentials"
    oauth2_authorization_code = "oauth2_authorization_code"
    bearer = "bearer"
    api_key = "api_key"
    basic = "basic"


class TokenProfile(Base):
    __tablename__ = "token_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    kind: Mapped[AuthKind] = mapped_column(Enum(AuthKind, name="auth_kind"), nullable=False)
    environment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id", ondelete="SET NULL"), nullable=True
    )
    # JSON of non-secret config (token_url, client_id, scopes, header name, etc.)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Encrypted blob holding client_secret / token / refresh_token / password etc.
    encrypted_secrets: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Cached current access token (encrypted) + expiry
    encrypted_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
