"""Execute a collection: send requests, run assertions, persist run + assertions."""
from __future__ import annotations

import time
import uuid
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.modules.collections.service import CollectionService
from app.modules.environments.models import Environment
from app.modules.validation.assertions import run_assertion
from app.modules.validation.models import RunStatus, TestAssertion, TestRun


def _substitute(value: str, variables: dict[str, str]) -> str:
    out = value
    for k, v in variables.items():
        out = out.replace(f"{{{{{k}}}}}", str(v))
    return out


# In-process session/cookie cache keyed by (collection_id, environment_id or "none").
# Lets a follow-up single-item run reuse cookies set by a previous run
# (e.g. login -> /device).
_COOKIE_JARS: dict[tuple[str, str], list[dict[str, str]]] = {}


def _jar_key(collection_id: uuid.UUID, environment_id: uuid.UUID | None) -> tuple[str, str]:
    return (str(collection_id), str(environment_id) if environment_id else "none")


def _load_cookies(collection_id: uuid.UUID, environment_id: uuid.UUID | None) -> httpx.Cookies:
    jar = httpx.Cookies()
    for c in _COOKIE_JARS.get(_jar_key(collection_id, environment_id), []):
        jar.set(c["name"], c["value"], domain=c.get("domain", ""), path=c.get("path", "/"))
    return jar


def _save_cookies(
    collection_id: uuid.UUID, environment_id: uuid.UUID | None, jar: httpx.Cookies
) -> None:
    out: list[dict[str, str]] = []
    for cookie in jar.jar:
        out.append(
            {
                "name": cookie.name,
                "value": cookie.value or "",
                "domain": cookie.domain or "",
                "path": cookie.path or "/",
            }
        )
    _COOKIE_JARS[_jar_key(collection_id, environment_id)] = out


def clear_cookies(collection_id: uuid.UUID, environment_id: uuid.UUID | None = None) -> int:
    """Clear cached cookies for a collection (all envs if env is None)."""
    if environment_id is not None:
        return 1 if _COOKIE_JARS.pop(_jar_key(collection_id, environment_id), None) else 0
    removed = 0
    cid = str(collection_id)
    for key in [k for k in _COOKIE_JARS if k[0] == cid]:
        _COOKIE_JARS.pop(key, None)
        removed += 1
    return removed


class ExecutionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _resolve_vars(
        self, environment_id: uuid.UUID | None, overrides: dict[str, str]
    ) -> dict[str, str]:
        merged: dict[str, str] = {}
        if environment_id:
            env = await self.db.get(Environment, environment_id)
            if env:
                if env.base_url:
                    merged["baseUrl"] = env.base_url
                merged.update({str(k): str(v) for k, v in (env.variables or {}).items()})
        merged.update({str(k): str(v) for k, v in (overrides or {}).items()})
        return merged

    async def run_collection(
        self,
        collection_id: uuid.UUID,
        *,
        variables: dict[str, str] | None = None,
        triggered_by: uuid.UUID | None = None,
        environment_id: uuid.UUID | None = None,
    ) -> TestRun:
        variables = await self._resolve_vars(environment_id, variables or {})
        col = await CollectionService(self.db).get(collection_id)
        run = TestRun(
            collection_id=col.id,
            environment_id=environment_id,
            triggered_by=triggered_by,
            status=RunStatus.running,
        )
        self.db.add(run)
        await self.db.flush()

        passed_total = failed_total = 0
        start = time.perf_counter()
        item_results: list[dict[str, Any]] = []

        cookie_jar = _load_cookies(col.id, environment_id)
        async with httpx.AsyncClient(
            timeout=30, follow_redirects=True, cookies=cookie_jar
        ) as client:
            for item in col.items:
                url = _substitute(item.url, variables)
                headers = {k: _substitute(v, variables) for k, v in (item.headers or {}).items()}
                req_started = time.perf_counter()
                try:
                    response = await client.request(
                        item.method,
                        url,
                        headers=headers,
                        params=item.query or None,
                        json=item.body,
                    )
                except Exception as exc:
                    item_results.append(
                        {
                            "name": item.name,
                            "method": item.method,
                            "url": url,
                            "error": str(exc),
                            "duration_ms": int((time.perf_counter() - req_started) * 1000),
                        }
                    )
                    self.db.add(
                        TestAssertion(
                            run_id=run.id,
                            item_name=item.name,
                            assertion_type="request_error",
                            passed=False,
                            message=str(exc),
                        )
                    )
                    failed_total += 1
                    continue

                body_text = response.text or ""
                truncated = len(body_text) > 8192
                item_results.append(
                    {
                        "name": item.name,
                        "method": item.method,
                        "url": str(response.request.url),
                        "status_code": response.status_code,
                        "duration_ms": int((time.perf_counter() - req_started) * 1000),
                        "response_headers": dict(response.headers),
                        "response_body": body_text[:8192],
                        "response_truncated": truncated,
                        "response_size": len(body_text),
                    }
                )

                for assertion in item.assertions or [{"type": "status_code", "expected": 200}]:
                    r = run_assertion(response, assertion)
                    self.db.add(
                        TestAssertion(
                            run_id=run.id,
                            item_name=item.name,
                            assertion_type=r.type,
                            passed=r.passed,
                            message=r.message,
                            details=r.details,
                        )
                    )
                    if r.passed:
                        passed_total += 1
                    else:
                        failed_total += 1

        _save_cookies(col.id, environment_id, cookie_jar)
        run.passed = passed_total
        run.failed = failed_total
        run.total = passed_total + failed_total
        run.duration_ms = int((time.perf_counter() - start) * 1000)
        run.status = RunStatus.passed if failed_total == 0 and passed_total > 0 else RunStatus.failed
        run.summary = {
            "pass_rate": (passed_total / run.total) if run.total else 0.0,
            "items": item_results,
        }
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def run_item(
        self,
        collection_id: uuid.UUID,
        item_id: uuid.UUID,
        *,
        variables: dict[str, str] | None = None,
        triggered_by: uuid.UUID | None = None,
        environment_id: uuid.UUID | None = None,
    ) -> TestRun:
        variables = await self._resolve_vars(environment_id, variables or {})
        col = await CollectionService(self.db).get(collection_id)
        item = next((i for i in col.items if i.id == item_id), None)
        if not item:
            raise NotFoundError("Item not found")

        run = TestRun(
            collection_id=col.id,
            environment_id=environment_id,
            triggered_by=triggered_by,
            status=RunStatus.running,
        )
        self.db.add(run)
        await self.db.flush()

        passed_total = failed_total = 0
        start = time.perf_counter()
        item_results: list[dict[str, Any]] = []

        cookie_jar = _load_cookies(col.id, environment_id)
        async with httpx.AsyncClient(
            timeout=30, follow_redirects=True, cookies=cookie_jar
        ) as client:
            url = _substitute(item.url, variables)
            headers = {k: _substitute(v, variables) for k, v in (item.headers or {}).items()}
            req_started = time.perf_counter()
            try:
                response = await client.request(
                    item.method,
                    url,
                    headers=headers,
                    params=item.query or None,
                    json=item.body,
                )
            except Exception as exc:
                item_results.append(
                    {
                        "name": item.name,
                        "method": item.method,
                        "url": url,
                        "error": str(exc),
                        "duration_ms": int((time.perf_counter() - req_started) * 1000),
                    }
                )
                self.db.add(
                    TestAssertion(
                        run_id=run.id,
                        item_name=item.name,
                        assertion_type="request_error",
                        passed=False,
                        message=str(exc),
                    )
                )
                failed_total += 1
            else:
                body_text = response.text or ""
                truncated = len(body_text) > 8192
                item_results.append(
                    {
                        "name": item.name,
                        "method": item.method,
                        "url": str(response.request.url),
                        "status_code": response.status_code,
                        "duration_ms": int((time.perf_counter() - req_started) * 1000),
                        "response_headers": dict(response.headers),
                        "response_body": body_text[:8192],
                        "response_truncated": truncated,
                        "response_size": len(body_text),
                    }
                )
                for assertion in item.assertions or [{"type": "status_code", "expected": 200}]:
                    r = run_assertion(response, assertion)
                    self.db.add(
                        TestAssertion(
                            run_id=run.id,
                            item_name=item.name,
                            assertion_type=r.type,
                            passed=r.passed,
                            message=r.message,
                            details=r.details,
                        )
                    )
                    if r.passed:
                        passed_total += 1
                    else:
                        failed_total += 1

        _save_cookies(col.id, environment_id, cookie_jar)
        run.passed = passed_total
        run.failed = failed_total
        run.total = passed_total + failed_total
        run.duration_ms = int((time.perf_counter() - start) * 1000)
        run.status = RunStatus.passed if failed_total == 0 and passed_total > 0 else RunStatus.failed
        run.summary = {
            "pass_rate": (passed_total / run.total) if run.total else 0.0,
            "items": item_results,
        }
        await self.db.commit()
        await self.db.refresh(run)
        return run
