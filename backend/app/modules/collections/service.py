"""Collection schemas + service (incl. auto-generate from a spec)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.modules.collections.models import Collection, CollectionItem
from app.modules.swagger.models import SwaggerSpec


class CollectionItemIn(BaseModel):
    name: str
    method: str
    url: str
    headers: dict[str, str] = {}
    query: dict[str, Any] = {}
    body: dict | None = None
    assertions: list[dict] = []


class CollectionItemOut(CollectionItemIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    position: int


class CollectionIn(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = []
    spec_id: uuid.UUID | None = None
    environment_id: uuid.UUID | None = None
    items: list[CollectionItemIn] = []


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str
    tags: list[str]
    created_at: datetime
    items: list[CollectionItemOut]


class CollectionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self) -> list[Collection]:
        result = await self.db.execute(
            select(Collection).options(selectinload(Collection.items)).order_by(Collection.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, cid: uuid.UUID) -> Collection:
        result = await self.db.execute(
            select(Collection).where(Collection.id == cid).options(selectinload(Collection.items))
        )
        col = result.scalar_one_or_none()
        if not col:
            raise NotFoundError("Collection not found")
        return col

    async def create(self, payload: CollectionIn) -> Collection:
        col = Collection(
            name=payload.name,
            description=payload.description,
            tags=payload.tags,
            spec_id=payload.spec_id,
            environment_id=payload.environment_id,
        )
        col.items = [
            CollectionItem(position=idx, **item.model_dump()) for idx, item in enumerate(payload.items)
        ]
        self.db.add(col)
        await self.db.commit()
        await self.db.refresh(col)
        return await self.get(col.id)

    async def generate_from_spec(self, spec_id: uuid.UUID, base_url: str = "{{baseUrl}}") -> Collection:
        spec = await self.db.get(SwaggerSpec, spec_id)
        if not spec:
            raise NotFoundError("Spec not found")
        result = await self.db.execute(
            select(Collection.__table__).where(False)  # noqa: just for type
        )
        # build items from endpoints
        from app.modules.swagger.models import ApiEndpoint
        eps = (
            await self.db.execute(
                select(ApiEndpoint).where(ApiEndpoint.spec_id == spec.id).order_by(ApiEndpoint.path)
            )
        ).scalars().all()

        col = Collection(name=f"Auto: {spec.name}", description=f"Generated from {spec.name} {spec.version}",
                         tags=["auto-generated"], spec_id=spec.id)
        col.items = [
            CollectionItem(
                position=i,
                name=ep.operation_id or f"{ep.method} {ep.path}",
                method=ep.method,
                url=f"{base_url}{ep.path}",
                headers={"Authorization": "Bearer {{token}}"},
                query={},
                body=None,
                assertions=[{"type": "status_code", "expected": 200}],
            )
            for i, ep in enumerate(eps)
        ]
        self.db.add(col)
        await self.db.commit()
        return await self.get(col.id)

    async def delete(self, cid: uuid.UUID) -> None:
        col = await self.get(cid)
        await self.db.delete(col)
        await self.db.commit()

    async def prepend_login(
        self,
        cid: uuid.UUID,
        *,
        login_path: str = "/user/auth",
        email: str,
        password: str,
        base_url: str = "{{baseUrl}}",
        strip_bearer: bool = True,
    ) -> Collection:
        """Insert a login `POST {base_url}{login_path}` item at position 0 so the
        downstream items inherit its session cookies via the shared cookie jar.

        Also removes the auto-generated ``Authorization: Bearer {{token}}`` header
        from every other item (ZPE Cloud uses cookie-session auth, not Bearer).
        Any existing item whose name starts with ``"Login"`` is replaced first.
        """
        col = await self.get(cid)

        # Drop any previous login item we may have added so re-runs stay idempotent.
        for existing in list(col.items):
            if existing.name.lower().startswith("login (auto)"):
                await self.db.delete(existing)
        await self.db.flush()

        # Shift existing items down by 1.
        for it in col.items:
            if it.name.lower().startswith("login (auto)"):
                continue
            it.position = it.position + 1
            if strip_bearer and (it.headers or {}).get("Authorization") == "Bearer {{token}}":
                new_headers = {k: v for k, v in (it.headers or {}).items() if k != "Authorization"}
                it.headers = new_headers

        login = CollectionItem(
            collection_id=col.id,
            position=0,
            name="Login (auto)",
            method="POST",
            url=f"{base_url}{login_path}",
            headers={"Content-Type": "application/json"},
            query={},
            body={"email": email, "password": password},
            assertions=[{"type": "status_code", "expected": 200}],
        )
        self.db.add(login)
        await self.db.commit()
        return await self.get(col.id)

    async def add_item(self, cid: uuid.UUID, payload: CollectionItemIn) -> CollectionItem:
        col = await self.get(cid)
        position = (max((i.position for i in col.items), default=-1)) + 1
        item = CollectionItem(collection_id=col.id, position=position, **payload.model_dump())
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete_item(self, cid: uuid.UUID, item_id: uuid.UUID) -> None:
        col = await self.get(cid)
        match = next((i for i in col.items if i.id == item_id), None)
        if not match:
            raise NotFoundError("Item not found")
        await self.db.delete(match)
        await self.db.commit()

    async def update_item(
        self, cid: uuid.UUID, item_id: uuid.UUID, payload: CollectionItemIn
    ) -> CollectionItem:
        col = await self.get(cid)
        item = next((i for i in col.items if i.id == item_id), None)
        if not item:
            raise NotFoundError("Item not found")
        data = payload.model_dump()
        for k, v in data.items():
            setattr(item, k, v)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def import_postman(self, doc: dict) -> Collection:
        """Import a Postman Collection v2.x JSON document."""
        info = doc.get("info") or {}
        name = info.get("name") or "Imported Postman Collection"
        description = info.get("description") or ""
        if isinstance(description, dict):
            description = description.get("content", "")

        raw_items = doc.get("item") or []
        flat: list[dict] = []
        _flatten_postman_items(raw_items, flat, prefix="")

        payload_items: list[CollectionItemIn] = []
        for it in flat:
            req = it.get("request") or {}
            method = (req.get("method") or "GET").upper()

            url_obj = req.get("url")
            if isinstance(url_obj, str):
                url = url_obj
                query: dict[str, Any] = {}
            elif isinstance(url_obj, dict):
                url = url_obj.get("raw") or ""
                if not url:
                    proto = url_obj.get("protocol") or "https"
                    host = ".".join(url_obj.get("host") or [])
                    path = "/".join(url_obj.get("path") or [])
                    url = f"{proto}://{host}/{path}".rstrip("/")
                query = {
                    q.get("key"): q.get("value", "")
                    for q in (url_obj.get("query") or [])
                    if q.get("key") and not q.get("disabled")
                }
            else:
                url = ""
                query = {}

            headers = {
                h.get("key"): h.get("value", "")
                for h in (req.get("header") or [])
                if h.get("key") and not h.get("disabled")
            }

            body: Any = None
            raw_body = req.get("body") or {}
            mode = raw_body.get("mode")
            if mode == "raw":
                raw = raw_body.get("raw") or ""
                try:
                    import json as _json
                    body = _json.loads(raw) if raw.strip() else None
                except Exception:
                    body = {"raw": raw}
            elif mode == "urlencoded":
                body = {
                    f.get("key"): f.get("value", "")
                    for f in (raw_body.get("urlencoded") or [])
                    if f.get("key") and not f.get("disabled")
                }
            elif mode == "formdata":
                body = {
                    f.get("key"): f.get("value", "")
                    for f in (raw_body.get("formdata") or [])
                    if f.get("key") and not f.get("disabled") and f.get("type") != "file"
                }

            payload_items.append(
                CollectionItemIn(
                    name=it.get("name") or f"{method} {url}",
                    method=method,
                    url=url,
                    headers=headers,
                    query=query,
                    body=body if isinstance(body, dict) else None,
                    assertions=[{"type": "status_code", "expected": 200}],
                )
            )

        return await self.create(
            CollectionIn(
                name=name,
                description=description if isinstance(description, str) else "",
                tags=["postman", "imported"],
                items=payload_items,
            )
        )


def _flatten_postman_items(items: list[dict], out: list[dict], prefix: str) -> None:
    for it in items:
        name = it.get("name") or ""
        full_name = f"{prefix} / {name}" if prefix else name
        if "item" in it and isinstance(it["item"], list):
            _flatten_postman_items(it["item"], out, full_name)
        elif "request" in it:
            out.append({"name": full_name, "request": it["request"]})
