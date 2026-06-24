"""Uploaded OpenAPI specs and their parsed endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SwaggerSpec(Base):
    __tablename__ = "swagger_specs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    openapi_version: Mapped[str] = mapped_column(String(20), nullable=False, default="3.0.0")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    raw_spec: Mapped[dict] = mapped_column(JSONB, nullable=False)
    endpoint_count: Mapped[int] = mapped_column(default=0)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    endpoints: Mapped[list["ApiEndpoint"]] = relationship(
        back_populates="spec", cascade="all, delete-orphan"
    )


class ApiEndpoint(Base):
    __tablename__ = "api_endpoints"
    __table_args__ = (Index("ix_api_endpoint_spec_method_path", "spec_id", "method", "path"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spec_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("swagger_specs.id", ondelete="CASCADE"), nullable=False
    )
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    operation_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    parameters: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    request_schema: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    responses: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    spec: Mapped[SwaggerSpec] = relationship(back_populates="endpoints")
