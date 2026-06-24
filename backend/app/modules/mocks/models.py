"""Mock endpoint definitions served by the mock subsystem."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MockEndpoint(Base):
    __tablename__ = "mock_endpoints"
    __table_args__ = (UniqueConstraint("method", "path", name="uq_mock_method_path"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    status_code: Mapped[int] = mapped_column(Integer, default=200)
    delay_ms: Mapped[int] = mapped_column(Integer, default=0)
    headers: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_body: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # If response_schema is set, a fake JSON payload is generated on each request.
    response_schema: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Stateful counters: {"counter": 0, ...}
    state: Mapped[dict] = mapped_column(JSONB, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
