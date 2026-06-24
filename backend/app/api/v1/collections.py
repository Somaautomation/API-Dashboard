import uuid

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.modules.collections.exporters import EXPORTERS
from app.modules.collections.service import (
    CollectionIn,
    CollectionItemIn,
    CollectionItemOut,
    CollectionOut,
    CollectionService,
)

router = APIRouter()


class PrependLoginRequest(BaseModel):
    email: str
    password: str
    login_path: str = "/user/auth"
    base_url: str = "{{baseUrl}}"
    strip_bearer: bool = True


@router.get("", response_model=list[CollectionOut])
async def list_collections(db: DbSession, _: CurrentUser) -> list[CollectionOut]:
    cols = await CollectionService(db).list()
    return [CollectionOut.model_validate(c) for c in cols]


@router.post("", response_model=CollectionOut, status_code=201)
async def create_collection(payload: CollectionIn, db: DbSession, _: CurrentUser) -> CollectionOut:
    col = await CollectionService(db).create(payload)
    return CollectionOut.model_validate(col)


@router.post("/from-spec/{spec_id}", response_model=CollectionOut, status_code=201)
async def generate_from_spec(
    spec_id: uuid.UUID,
    db: DbSession,
    _: CurrentUser,
    base_url: str = Query("{{baseUrl}}"),
) -> CollectionOut:
    col = await CollectionService(db).generate_from_spec(spec_id, base_url)
    return CollectionOut.model_validate(col)


@router.post("/import/postman", response_model=CollectionOut, status_code=201)
async def import_postman(
    db: DbSession,
    _: CurrentUser,
    file: UploadFile = File(..., description="Postman Collection v2.x JSON"),
) -> CollectionOut:
    import json as _json

    raw = await file.read()
    try:
        doc = _json.loads(raw)
    except _json.JSONDecodeError as exc:
        raise HTTPException(400, f"Invalid JSON: {exc}") from exc
    if not isinstance(doc, dict) or "item" not in doc:
        raise HTTPException(400, "Not a Postman Collection (missing 'item' array)")
    col = await CollectionService(db).import_postman(doc)
    return CollectionOut.model_validate(col)


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(collection_id: uuid.UUID, db: DbSession, _: CurrentUser) -> CollectionOut:
    col = await CollectionService(db).get(collection_id)
    return CollectionOut.model_validate(col)


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(collection_id: uuid.UUID, db: DbSession, _: CurrentUser) -> None:
    await CollectionService(db).delete(collection_id)


@router.post("/{collection_id}/items", response_model=CollectionItemOut, status_code=201)
async def add_item(
    collection_id: uuid.UUID,
    payload: CollectionItemIn,
    db: DbSession,
    _: CurrentUser,
) -> CollectionItemOut:
    item = await CollectionService(db).add_item(collection_id, payload)
    return CollectionItemOut.model_validate(item)


@router.delete("/{collection_id}/items/{item_id}", status_code=204)
async def delete_item(
    collection_id: uuid.UUID,
    item_id: uuid.UUID,
    db: DbSession,
    _: CurrentUser,
) -> None:
    await CollectionService(db).delete_item(collection_id, item_id)


@router.put("/{collection_id}/items/{item_id}", response_model=CollectionItemOut)
async def update_item(
    collection_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: CollectionItemIn,
    db: DbSession,
    _: CurrentUser,
) -> CollectionItemOut:
    item = await CollectionService(db).update_item(collection_id, item_id, payload)
    return CollectionItemOut.model_validate(item)


@router.post("/{collection_id}/session/clear")
async def clear_session(collection_id: uuid.UUID, _: CurrentUser) -> dict:
    from app.modules.validation.service import clear_cookies

    removed = clear_cookies(collection_id)
    return {"cleared": removed}


@router.post("/{collection_id}/prepend-login", response_model=CollectionOut)
async def prepend_login(
    collection_id: uuid.UUID,
    payload: PrependLoginRequest,
    db: DbSession,
    _: CurrentUser,
) -> CollectionOut:
    col = await CollectionService(db).prepend_login(
        collection_id,
        email=payload.email,
        password=payload.password,
        login_path=payload.login_path,
        base_url=payload.base_url,
        strip_bearer=payload.strip_bearer,
    )
    return CollectionOut.model_validate(col)


@router.get("/{collection_id}/export")
async def export_collection(
    collection_id: uuid.UUID,
    db: DbSession,
    _: CurrentUser,
    fmt: str = Query("postman", description="postman | curl | robot | playwright | k6"),
) -> Response:
    if fmt not in EXPORTERS:
        raise HTTPException(400, f"Unsupported format '{fmt}'. Choices: {list(EXPORTERS)}")
    col = await CollectionService(db).get(collection_id)
    media, render = EXPORTERS[fmt]
    return Response(content=render(col), media_type=media)
