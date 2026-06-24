import uuid

from fastapi import APIRouter, Request, Response

from app.api.deps import CurrentUser, DbSession
from app.modules.mocks.service import MockIn, MockOut, MockService

router = APIRouter()


@router.get("", response_model=list[MockOut])
async def list_mocks(db: DbSession, _: CurrentUser) -> list[MockOut]:
    return [MockOut.model_validate(m) for m in await MockService(db).list()]


@router.post("", response_model=MockOut, status_code=201)
async def create_mock(payload: MockIn, db: DbSession, _: CurrentUser) -> MockOut:
    return MockOut.model_validate(await MockService(db).create(payload))


@router.delete("/{mock_id}", status_code=204)
async def delete_mock(mock_id: uuid.UUID, db: DbSession, _: CurrentUser) -> None:
    await MockService(db).delete(mock_id)


# ---------- public mock runtime (no auth, served under /api/v1/mocks/run/...) ----------
@router.api_route(
    "/run/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def run_mock(path: str, request: Request, db: DbSession) -> Response:
    svc = MockService(db)
    mock = await svc.resolve(request.method, "/" + path)
    if not mock:
        return Response(status_code=404, content='{"error":"mock not found"}', media_type="application/json")
    status, headers, body = await svc.execute(mock)
    import json as _json
    payload = _json.dumps(body) if body is not None else ""
    return Response(status_code=status, content=payload, headers=headers, media_type="application/json")
