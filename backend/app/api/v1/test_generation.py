"""REST endpoints for the AI-powered test generation module."""
from __future__ import annotations

import io
import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.core.errors import NotFoundError
from app.modules.collections.models import Collection, CollectionItem
from app.modules.test_generation.cache import TTLCache, cache_key as _cache_key  # noqa: F401
from app.modules.test_generation.dtos import (
    FailureExplanation,
    FailureInput,
    GenerateOptions,
    GeneratedTestCase,
    JobOut,
    TestSuite,
)
from app.modules.test_generation.failure_analyzer import explain_failure
from app.modules.test_generation.jobs import job_manager
from app.modules.test_generation.service import TestGenerationService

router = APIRouter()


# ---- request DTOs ---------------------------------------------------------
class GenerateRequest(BaseModel):
    options: GenerateOptions = GenerateOptions()


class GenerateRawRequest(BaseModel):
    method: str
    path: str
    summary: str = ""
    operation_id: str | None = None
    parameters: list[dict[str, Any]] = []
    request_schema: dict[str, Any] | None = None
    responses: dict[str, Any] = {}
    options: GenerateOptions = GenerateOptions()


class SaveAsCollectionRequest(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = ["ai-generated"]
    spec_id: uuid.UUID | None = None
    environment_id: uuid.UUID | None = None
    suites: list[TestSuite]


# ---- generation routes ----------------------------------------------------
@router.post("/endpoint/{endpoint_id}", response_model=TestSuite)
async def generate_for_endpoint(
    endpoint_id: uuid.UUID,
    payload: GenerateRequest,
    db: DbSession,
    _: CurrentUser,
) -> TestSuite:
    try:
        return await TestGenerationService(db).generate_for_endpoint_id(
            endpoint_id, payload.options
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/raw", response_model=TestSuite)
async def generate_for_raw_endpoint(
    payload: GenerateRawRequest, _: CurrentUser
) -> TestSuite:
    """Generate without persisting — useful for ad-hoc schemas pasted into the UI."""
    return await TestGenerationService().generate_for_raw(
        method=payload.method,
        path=payload.path,
        summary=payload.summary,
        operation_id=payload.operation_id,
        parameters=payload.parameters,
        request_schema=payload.request_schema,
        responses=payload.responses,
        options=payload.options,
    )


@router.post("/spec/{spec_id}", response_model=JobOut, status_code=202)
async def generate_for_spec(
    spec_id: uuid.UUID,
    payload: GenerateRequest,
    db: DbSession,
    _: CurrentUser,
) -> JobOut:
    """Kick off an asynchronous, parallelised generation across every endpoint."""
    try:
        return await TestGenerationService(db).generate_for_spec(spec_id, payload.options)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---- job routes -----------------------------------------------------------
@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    job_id: str,
    _: CurrentUser,
    include_suites: bool = Query(True, description="Whether to inline generated suites"),
) -> JobOut:
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dto(include_suites=include_suites)


@router.delete("/jobs/{job_id}", status_code=204, response_class=Response)
async def cancel_job(job_id: str, _: CurrentUser) -> Response:
    if not job_manager.cancel(job_id):
        raise HTTPException(status_code=404, detail="Job not found or already finished")
    return Response(status_code=204)


# ---- failure analysis -----------------------------------------------------
@router.post("/explain-failure", response_model=FailureExplanation)
async def post_explain_failure(payload: FailureInput, _: CurrentUser) -> FailureExplanation:
    return await explain_failure(payload)


# ---- export / persist -----------------------------------------------------
@router.post("/suites/export")
async def export_suites_json(
    payload: SaveAsCollectionRequest, _: CurrentUser
) -> StreamingResponse:
    """Stream the suite(s) back as a downloadable JSON file."""
    data = payload.model_dump(mode="json")
    body = json.dumps(data, indent=2).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(body),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(payload.name)}.json"'
        },
    )


@router.post("/suites/save", response_model=dict, status_code=201)
async def save_suites_as_collection(
    payload: SaveAsCollectionRequest, db: DbSession, _: CurrentUser
) -> dict:
    """Persist generated suites as a runnable Collection.

    Each generated test case becomes one CollectionItem so the existing
    runner (incl. shared cookie jar) can execute them unchanged.
    """
    col = Collection(
        name=payload.name,
        description=payload.description
        or "Auto-generated AI test suite — produced by the Test Generator module.",
        tags=list(set([*(payload.tags or []), "ai-generated"])),
        spec_id=payload.spec_id,
        environment_id=payload.environment_id,
    )

    items: list[CollectionItem] = []
    position = 0
    for suite in payload.suites:
        for case in suite.all_cases():
            items.append(_case_to_item(case, position))
            position += 1
    col.items = items
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return {
        "collection_id": str(col.id),
        "item_count": len(items),
        "name": col.name,
    }


def _case_to_item(case: GeneratedTestCase, position: int) -> CollectionItem:
    return CollectionItem(
        position=position,
        name=f"[{case.category}] {case.name}",
        method=case.method,
        url=case.url,
        headers=case.headers or {},
        query=case.query or {},
        body=case.body if isinstance(case.body, dict) else (case.body or None),
        assertions=[
            a.model_dump(by_alias=True, exclude_none=True) for a in case.assertions
        ],
    )


def _safe_filename(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in name)[:80]
    return cleaned or "ai-test-suite"
