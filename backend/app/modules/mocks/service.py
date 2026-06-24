"""Mock CRUD + runtime engine (delays, dynamic payloads, stateful counters)."""
from __future__ import annotations

import asyncio
import random
import uuid
from typing import Any

from faker import Faker
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.modules.mocks.models import MockEndpoint

_fake = Faker()


# ---------- schemas ----------
class MockIn(BaseModel):
    name: str
    method: str
    path: str
    status_code: int = 200
    delay_ms: int = 0
    headers: dict[str, str] = {}
    response_body: dict | None = None
    response_schema: dict | None = None
    enabled: bool = True


class MockOut(MockIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


# ---------- dynamic payload generator from JSON schema ----------
def fake_from_schema(schema: dict) -> Any:
    t = schema.get("type", "object")
    if "enum" in schema:
        return random.choice(schema["enum"])
    if t == "object":
        props = schema.get("properties", {})
        return {k: fake_from_schema(v) for k, v in props.items()}
    if t == "array":
        items = schema.get("items", {"type": "string"})
        return [fake_from_schema(items) for _ in range(random.randint(1, 3))]
    if t == "integer":
        return random.randint(schema.get("minimum", 0), schema.get("maximum", 1000))
    if t == "number":
        return round(random.uniform(0, 100), 2)
    if t == "boolean":
        return random.choice([True, False])
    fmt = schema.get("format", "")
    if fmt == "email":
        return _fake.email()
    if fmt == "uuid":
        return str(uuid.uuid4())
    if fmt == "date-time":
        return _fake.iso8601()
    return _fake.word()


# ---------- service ----------
class MockService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self) -> list[MockEndpoint]:
        result = await self.db.execute(select(MockEndpoint).order_by(MockEndpoint.created_at.desc()))
        return list(result.scalars().all())

    async def get(self, mid: uuid.UUID) -> MockEndpoint:
        m = await self.db.get(MockEndpoint, mid)
        if not m:
            raise NotFoundError("Mock not found")
        return m

    async def create(self, payload: MockIn) -> MockEndpoint:
        m = MockEndpoint(**payload.model_dump())
        self.db.add(m)
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def delete(self, mid: uuid.UUID) -> None:
        m = await self.get(mid)
        await self.db.delete(m)
        await self.db.commit()

    async def resolve(self, method: str, path: str) -> MockEndpoint | None:
        result = await self.db.execute(
            select(MockEndpoint).where(
                MockEndpoint.method == method.upper(),
                MockEndpoint.path == path,
                MockEndpoint.enabled.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def execute(self, mock: MockEndpoint) -> tuple[int, dict, Any]:
        if mock.delay_ms:
            await asyncio.sleep(mock.delay_ms / 1000)
        body: Any
        if mock.response_schema:
            body = fake_from_schema(mock.response_schema)
        else:
            body = mock.response_body
        return mock.status_code, dict(mock.headers or {}), body
