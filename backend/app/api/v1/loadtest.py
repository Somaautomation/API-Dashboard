import asyncio
import os
import shutil
import tempfile
import time
import uuid

from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession
from app.modules.collections.service import CollectionService
from app.modules.environments.models import Environment
from app.modules.loadtest.service import LoadProfile, jmeter_script, k6_script

router = APIRouter()


class LoadTestRunRequest(BaseModel):
    environment_id: uuid.UUID | None = None
    vus: int = Field(50, ge=1, le=1000)
    ramp_up_seconds: int = Field(30, ge=0, le=3600)
    duration_seconds: int = Field(120, ge=1, le=86400)
    p95_ms: int = Field(500, ge=1)
    error_rate_threshold: float = Field(0.01, ge=0.0, le=1.0)


class LoadTestRunResponse(BaseModel):
    status: str
    exit_code: int | None = None
    elapsed_ms: int
    stdout: str
    stderr: str
    script: str


async def _resolve_vars(db: DbSession, environment_id: uuid.UUID | None) -> dict[str, str]:
    merged: dict[str, str] = {}
    if environment_id:
        env = await db.get(Environment, environment_id)
        if env:
            if env.base_url:
                merged["baseUrl"] = env.base_url
            merged.update({str(k): str(v) for k, v in (env.variables or {}).items()})
    return merged


@router.get("/{collection_id}/script")
async def script(
    collection_id: uuid.UUID,
    db: DbSession,
    _: CurrentUser,
    tool: str = Query("k6", description="k6 | jmeter"),
    environment_id: uuid.UUID | None = None,
    vus: int = 50,
    duration_seconds: int = 120,
    p95_ms: int = 500,
) -> Response:
    col = await CollectionService(db).get(collection_id)
    profile = LoadProfile(vus=vus, duration_seconds=duration_seconds, p95_threshold_ms=p95_ms)
    variables = await _resolve_vars(db, environment_id)
    if tool == "jmeter":
        return Response(jmeter_script(col, profile), media_type="application/xml")
    return Response(k6_script(col, profile, variables=variables), media_type="application/javascript")


@router.post("/{collection_id}/run", response_model=LoadTestRunResponse)
async def run_k6(
    collection_id: uuid.UUID,
    payload: LoadTestRunRequest,
    db: DbSession,
    _: CurrentUser,
) -> LoadTestRunResponse:
    col = await CollectionService(db).get(collection_id)
    variables = await _resolve_vars(db, payload.environment_id)
    profile = LoadProfile(
        vus=payload.vus,
        ramp_up_seconds=payload.ramp_up_seconds,
        duration_seconds=payload.duration_seconds,
        p95_threshold_ms=payload.p95_ms,
        error_rate_threshold=payload.error_rate_threshold,
    )
    script = k6_script(col, profile, variables=variables)
    k6_bin = shutil.which("k6")
    if not k6_bin:
        return LoadTestRunResponse(
            status="error",
            exit_code=None,
            elapsed_ms=0,
            stdout="",
            stderr="k6 binary not found in container",
            script=script,
        )

    started = time.perf_counter()
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as fp:
        fp.write(script)
        script_path = fp.name

    timeout = profile.ramp_up_seconds + profile.duration_seconds + 180
    try:
        proc = await asyncio.create_subprocess_exec(
            k6_bin,
            "run",
            script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            stdout_b, stderr_b = await proc.communicate()
            return LoadTestRunResponse(
                status="timeout",
                exit_code=proc.returncode,
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                stdout=stdout_b.decode("utf-8", errors="replace"),
                stderr=(stderr_b.decode("utf-8", errors="replace") + "\nTimed out waiting for k6 to finish").strip(),
                script=script,
            )
        return LoadTestRunResponse(
            status="passed" if proc.returncode == 0 else "failed",
            exit_code=proc.returncode,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            script=script,
        )
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass
