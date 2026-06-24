"""Environment (Dev/QA/Stage/Prod) profiles & variables."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class EnvironmentKind(str, enum.Enum):
    dev = "dev"
    qa = "qa"
    stage = "stage"
    prod = "prod"
    custom = "custom"


class Environment(Base):
    __tablename__ = "environments"
    __table_args__ = (UniqueConstraint("name", name="uq_environment_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    kind: Mapped[EnvironmentKind] = mapped_column(Enum(EnvironmentKind, name="env_kind"), default=EnvironmentKind.dev)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
