import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.modules.validation.models import RunStatus, TestAssertion, TestRun
from app.modules.validation.service import ExecutionService

router = APIRouter()


class RunRequest(BaseModel):
    collection_id: uuid.UUID
    environment_id: uuid.UUID | None = None
    variables: dict[str, str] = {}


class RunItemRequest(BaseModel):
    collection_id: uuid.UUID
    item_id: uuid.UUID
    environment_id: uuid.UUID | None = None
    variables: dict[str, str] = {}


class AssertionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    item_name: str
    assertion_type: str
    passed: bool
    message: str


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    collection_id: uuid.UUID | None = None
    status: RunStatus
    total: int
    passed: int
    failed: int
    duration_ms: int
    created_at: datetime


class RunDetail(RunOut):
    assertions: list[AssertionOut]
    summary: dict = {}


@router.post("", response_model=RunDetail)
async def execute(payload: RunRequest, db: DbSession, user: CurrentUser) -> RunDetail:
    run = await ExecutionService(db).run_collection(
        payload.collection_id,
        variables=payload.variables,
        triggered_by=user.id,
        environment_id=payload.environment_id,
    )
    res = await db.execute(
        select(TestRun).where(TestRun.id == run.id).options(selectinload(TestRun.assertions))
    )
    return RunDetail.model_validate(res.scalar_one())


@router.post("/item", response_model=RunDetail)
async def execute_item(payload: RunItemRequest, db: DbSession, user: CurrentUser) -> RunDetail:
    run = await ExecutionService(db).run_item(
        payload.collection_id,
        payload.item_id,
        variables=payload.variables,
        triggered_by=user.id,
        environment_id=payload.environment_id,
    )
    res = await db.execute(
        select(TestRun).where(TestRun.id == run.id).options(selectinload(TestRun.assertions))
    )
    return RunDetail.model_validate(res.scalar_one())


@router.get("", response_model=list[RunOut])
async def list_runs(db: DbSession, _: CurrentUser, limit: int = 50) -> list[RunOut]:
    res = await db.execute(select(TestRun).order_by(TestRun.created_at.desc()).limit(limit))
    return [RunOut.model_validate(r) for r in res.scalars().all()]


@router.get("/{run_id}", response_model=RunDetail)
async def get_run(run_id: uuid.UUID, db: DbSession, _: CurrentUser) -> RunDetail:
    res = await db.execute(
        select(TestRun).where(TestRun.id == run_id).options(selectinload(TestRun.assertions))
    )
    return RunDetail.model_validate(res.scalar_one())
