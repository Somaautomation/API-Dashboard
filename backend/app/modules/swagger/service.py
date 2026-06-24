"""Swagger Pydantic schemas + service."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlparse, urlsplit, urlunsplit, parse_qsl, urlencode

import httpx
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError, ValidationError
from app.modules.swagger.models import ApiEndpoint, SwaggerSpec
from app.modules.swagger.parser import parse_and_validate


# ---------- schemas ----------
class EndpointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    method: str
    path: str
    operation_id: str | None
    summary: str
    tags: list[str]
    parameters: list[dict[str, Any]] = []
    request_schema: dict[str, Any] | None = None
    responses: dict[str, Any] = {}


class SpecSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    version: str
    openapi_version: str
    endpoint_count: int
    created_at: datetime


class SpecDetail(SpecSummary):
    description: str
    servers: list[str] = []
    endpoints: list[EndpointOut]


# ---------- service ----------
class SwaggerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload_from_url(
        self, url: str, uploaded_by: uuid.UUID | None, name: str | None = None
    ) -> SwaggerSpec:
        parsed_url = urlparse(url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValidationError("URL must be an absolute http(s) URL")

        candidates = [url]
        # drf-yasg / ReDoc convention: same path with ?format=openapi returns the JSON spec.
        parts = urlsplit(url)
        query = dict(parse_qsl(parts.query))
        if query.get("format") != "openapi":
            query["format"] = "openapi"
            candidates.append(
                urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
            )

        last_err: Exception | None = None
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for candidate in candidates:
                try:
                    resp = await client.get(candidate, headers={"Accept": "application/json, application/yaml, */*"})
                    resp.raise_for_status()
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    continue
                ctype = (resp.headers.get("content-type") or "").lower()
                body = resp.content
                if "html" in ctype:
                    last_err = ValidationError(f"URL returned HTML, not a spec: {candidate}")
                    continue
                filename = name or parsed_url.path.rsplit("/", 1)[-1] or "spec.json"
                if "yaml" in ctype and not filename.endswith((".yml", ".yaml")):
                    filename += ".yaml"
                elif "json" in ctype and not filename.endswith(".json"):
                    filename += ".json"
                return await self.upload(filename, body, uploaded_by)
        raise ValidationError(f"Could not fetch OpenAPI spec from URL: {last_err}")

    async def upload(self, filename: str, content: bytes, uploaded_by: uuid.UUID | None) -> SwaggerSpec:
        parsed = parse_and_validate(content, filename)
        spec = SwaggerSpec(
            name=parsed.title,
            version=parsed.version,
            openapi_version=parsed.openapi_version,
            description=parsed.description,
            raw_spec=parsed.raw,
            endpoint_count=len(parsed.endpoints),
            uploaded_by=uploaded_by,
        )
        spec.endpoints = [
            ApiEndpoint(
                method=e.method,
                path=e.path,
                operation_id=e.operation_id,
                summary=e.summary,
                tags=e.tags,
                parameters=e.parameters,
                request_schema=e.request_schema,
                responses=e.responses,
            )
            for e in parsed.endpoints
        ]
        self.db.add(spec)
        await self.db.commit()
        await self.db.refresh(spec)
        return spec

    async def list(self) -> list[SwaggerSpec]:
        result = await self.db.execute(select(SwaggerSpec).order_by(SwaggerSpec.created_at.desc()))
        return list(result.scalars().all())

    async def get(self, spec_id: uuid.UUID) -> SwaggerSpec:
        result = await self.db.execute(
            select(SwaggerSpec).where(SwaggerSpec.id == spec_id).options(selectinload(SwaggerSpec.endpoints))
        )
        spec = result.scalar_one_or_none()
        if not spec:
            raise NotFoundError("Spec not found")
        return spec

    async def delete(self, spec_id: uuid.UUID) -> None:
        spec = await self.get(spec_id)
        await self.db.delete(spec)
        await self.db.commit()
