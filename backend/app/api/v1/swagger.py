import time
import uuid
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel, HttpUrl

from app.api.deps import CurrentUser, DbSession
from app.modules.swagger.service import SpecDetail, SpecSummary, SwaggerService

router = APIRouter()


class ImportUrlRequest(BaseModel):
    url: HttpUrl
    name: str | None = None


class TryRequest(BaseModel):
    method: str
    url: str
    headers: dict[str, str] | None = None
    query: dict[str, str] | None = None
    body: Any | None = None
    body_kind: str = "json"  # "json" | "text" | "form" | "none"
    timeout: float = 30.0


class TryResponse(BaseModel):
    status: int
    elapsed_ms: int
    headers: dict[str, str]
    cookies: dict[str, str] = {}
    body: str
    content_type: str
    error: str | None = None


@router.post("/upload", response_model=SpecSummary, status_code=201)
async def upload_spec(
    db: DbSession, user: CurrentUser, file: UploadFile = File(...)
) -> SpecSummary:
    content = await file.read()
    spec = await SwaggerService(db).upload(file.filename or "spec.json", content, user.id)
    return SpecSummary.model_validate(spec)


@router.post("/import-url", response_model=SpecSummary, status_code=201)
async def import_spec_from_url(
    body: ImportUrlRequest, db: DbSession, user: CurrentUser
) -> SpecSummary:
    spec = await SwaggerService(db).upload_from_url(str(body.url), user.id, body.name)
    return SpecSummary.model_validate(spec)


@router.get("", response_model=list[SpecSummary])
async def list_specs(db: DbSession, _: CurrentUser) -> list[SpecSummary]:
    specs = await SwaggerService(db).list()
    return [SpecSummary.model_validate(s) for s in specs]


@router.get("/{spec_id}", response_model=SpecDetail)
async def get_spec(spec_id: uuid.UUID, db: DbSession, _: CurrentUser) -> SpecDetail:
    spec = await SwaggerService(db).get(spec_id)
    raw = spec.raw_spec or {}
    servers: list[str] = []
    for srv in raw.get("servers") or []:
        if isinstance(srv, dict) and srv.get("url"):
            servers.append(str(srv["url"]))
    if not servers:
        host = raw.get("host")
        if host:
            schemes = raw.get("schemes") or ["https"]
            base_path = raw.get("basePath") or ""
            for scheme in schemes:
                servers.append(f"{scheme}://{host}{base_path}")
    detail = SpecDetail.model_validate(spec)
    detail.servers = servers
    return detail


@router.delete("/{spec_id}", status_code=204)
async def delete_spec(spec_id: uuid.UUID, db: DbSession, _: CurrentUser) -> None:
    await SwaggerService(db).delete(spec_id)


@router.post("/try", response_model=TryResponse)
async def try_endpoint(req: TryRequest, _: CurrentUser) -> TryResponse:
    """Server-side proxy that executes an HTTP request and returns the response.

    Avoids browser CORS issues when targeting third-party APIs and lets us
    surface raw status/headers/body just like Swagger UI's Try-it-out feature.
    """
    method = req.method.upper().strip() or "GET"
    target = req.url
    if req.query:
        sep = "&" if "?" in target else "?"
        target = f"{target}{sep}{urlencode(req.query)}"

    headers = {k: v for k, v in (req.headers or {}).items() if k and v}

    request_kwargs: dict[str, Any] = {"headers": headers}
    if method not in {"GET", "HEAD"} and req.body is not None:
        kind = (req.body_kind or "json").lower()
        if kind == "json":
            request_kwargs["json"] = req.body
        elif kind == "form" and isinstance(req.body, dict):
            request_kwargs["data"] = req.body
        elif kind == "text":
            request_kwargs["content"] = str(req.body).encode("utf-8")
            headers.setdefault("Content-Type", "text/plain")

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=req.timeout, follow_redirects=True) as client:
            resp = await client.request(method, target, **request_kwargs)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return TryResponse(
            status=resp.status_code,
            elapsed_ms=elapsed_ms,
            headers={k: v for k, v in resp.headers.items()},
            cookies={k: v for k, v in resp.cookies.items()},
            body=resp.text,
            content_type=resp.headers.get("content-type", ""),
        )
    except httpx.RequestError as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return TryResponse(
            status=0,
            elapsed_ms=elapsed_ms,
            headers={},
            body="",
            content_type="",
            error=f"{type(exc).__name__}: {exc}",
        )
