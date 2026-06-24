"""High-level orchestrator for AI-assisted test generation."""
from __future__ import annotations

import asyncio
import json
import uuid as _uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.modules.ai.provider import DisabledProvider, get_provider
from app.modules.swagger.models import ApiEndpoint, SwaggerSpec
from app.modules.test_generation.cache import TTLCache, cache_key
from app.modules.test_generation.dtos import (
    EdgeCaseSuggestion,
    GenerateOptions,
    JobOut,
    TestSuite,
)
from app.modules.test_generation.generators import (
    AssertionGenerator,
    BoundaryGenerator,
    EdgeCaseGenerator,
    EndpointContext,
    NegativeGenerator,
    PositiveGenerator,
    SecurityGenerator,
)
from app.modules.test_generation.jobs import Job, job_manager

_suite_cache: TTLCache[TestSuite] = TTLCache(max_items=4096, ttl_seconds=1800)


class TestGenerationService:
    """Stateless orchestrator — safe to instantiate per request."""

    __test__ = False  # tell pytest this is not a test class

    def __init__(self, db: AsyncSession | None = None):
        self.db = db
        self._positive = PositiveGenerator()
        self._negative = NegativeGenerator()
        self._boundary = BoundaryGenerator()
        self._edge = EdgeCaseGenerator()
        self._security = SecurityGenerator()
        self._assertions = AssertionGenerator()

    # ---- public API -----------------------------------------------------
    async def generate_for_endpoint_id(
        self, endpoint_id: _uuid.UUID, options: GenerateOptions
    ) -> TestSuite:
        if self.db is None:
            raise RuntimeError("DB session required for endpoint lookup")
        endpoint = await self.db.get(ApiEndpoint, endpoint_id)
        if not endpoint:
            raise NotFoundError("Endpoint not found")
        return await self.generate_for_endpoint(endpoint, options)

    async def generate_for_endpoint(
        self, endpoint: ApiEndpoint, options: GenerateOptions
    ) -> TestSuite:
        key = cache_key(
            {
                "endpoint": str(endpoint.id),
                "method": endpoint.method,
                "path": endpoint.path,
                "options": options.model_dump(),
            }
        )
        cached = _suite_cache.get(key)
        if cached:
            return cached

        ctx = EndpointContext(
            endpoint_id=str(endpoint.id),
            method=endpoint.method,
            path=endpoint.path,
            summary=endpoint.summary,
            operation_id=endpoint.operation_id,
            parameters=list(endpoint.parameters or []),
            request_schema=endpoint.request_schema,
            responses=dict(endpoint.responses or {}),
            security=[],
            base_url=options.base_url,
            options=options,
        )
        suite = await self._build_suite(ctx)
        _suite_cache.set(key, suite)
        return suite

    async def generate_for_raw(
        self,
        *,
        method: str,
        path: str,
        summary: str = "",
        operation_id: str | None = None,
        parameters: list[dict[str, Any]] | None = None,
        request_schema: dict[str, Any] | None = None,
        responses: dict[str, Any] | None = None,
        options: GenerateOptions | None = None,
    ) -> TestSuite:
        opts = options or GenerateOptions()
        ctx = EndpointContext(
            endpoint_id=None,
            method=method,
            path=path,
            summary=summary,
            operation_id=operation_id,
            parameters=parameters or [],
            request_schema=request_schema,
            responses=responses or {},
            base_url=opts.base_url,
            options=opts,
        )
        return await self._build_suite(ctx)

    async def generate_for_spec(
        self, spec_id: _uuid.UUID, options: GenerateOptions
    ) -> JobOut:
        """Kick off a background generation job for an entire spec."""
        if self.db is None:
            raise RuntimeError("DB session required")
        spec = await self.db.get(SwaggerSpec, spec_id)
        if not spec:
            raise NotFoundError("Spec not found")
        endpoints = (
            (await self.db.execute(select(ApiEndpoint).where(ApiEndpoint.spec_id == spec_id)))
            .scalars()
            .all()
        )
        # Snapshot rows into plain dicts so the background task does not
        # need to keep the request-scoped DB session alive.
        snapshots = [
            {
                "id": str(e.id),
                "method": e.method,
                "path": e.path,
                "summary": e.summary,
                "operation_id": e.operation_id,
                "parameters": list(e.parameters or []),
                "request_schema": e.request_schema,
                "responses": dict(e.responses or {}),
            }
            for e in endpoints
        ]
        job = job_manager.create(total=len(snapshots))

        async def _runner(j: Job) -> None:
            sem = asyncio.Semaphore(8)

            async def _one(snap: dict) -> None:
                async with sem:
                    if j.cancelled:
                        return
                    try:
                        suite = await self.generate_for_raw(
                            method=snap["method"],
                            path=snap["path"],
                            summary=snap["summary"],
                            operation_id=snap["operation_id"],
                            parameters=snap["parameters"],
                            request_schema=snap["request_schema"],
                            responses=snap["responses"],
                            options=options,
                        )
                        suite.endpoint_id = snap["id"]
                        j.suites.append(suite)
                        j.completed += 1
                    except Exception:  # noqa: BLE001
                        j.failed += 1

            await asyncio.gather(*[_one(s) for s in snapshots])

        job_manager.launch(job, _runner)
        return job.to_dto(include_suites=False)

    # ---- internals ------------------------------------------------------
    async def _build_suite(self, ctx: EndpointContext) -> TestSuite:
        suite = TestSuite(
            endpoint_id=ctx.endpoint_id,
            method=ctx.method,
            path=ctx.path,
            summary=ctx.summary,
            operation_id=ctx.operation_id,
            base_url=ctx.base_url,
        )

        if ctx.options.include_positive:
            suite.positive = [self._assertions.attach(ctx, c) for c in self._positive.generate(ctx)]
        if ctx.options.include_negative:
            suite.negative = [self._assertions.attach(ctx, c) for c in self._negative.generate(ctx)]
        if ctx.options.include_boundary:
            suite.boundary = [self._assertions.attach(ctx, c) for c in self._boundary.generate(ctx)]
        if ctx.options.include_edge_cases:
            suite.edge_cases = [self._assertions.attach(ctx, c) for c in self._edge.generate(ctx)]
            suite.edge_suggestions = self._edge.suggestions(ctx)
            if ctx.options.use_ai:
                suite.edge_suggestions = await self._augment_suggestions_with_ai(
                    ctx, suite.edge_suggestions
                )
        if ctx.options.include_security:
            suite.security = [self._assertions.attach(ctx, c) for c in self._security.generate(ctx)]

        suite.recompute_counts()
        return suite

    async def _augment_suggestions_with_ai(
        self, ctx: EndpointContext, base: list[EdgeCaseSuggestion]
    ) -> list[EdgeCaseSuggestion]:
        provider = get_provider()
        if isinstance(provider, DisabledProvider):
            return base
        try:
            system = (
                "You are an API testing expert. Given a request schema, propose "
                "extra edge-case values per field. Output strict JSON: "
                "{\"fields\":[{\"field\":string,\"suggestions\":[string]}]}."
            )
            user = json.dumps(
                {
                    "method": ctx.method,
                    "path": ctx.path,
                    "request_schema": ctx.request_schema or {},
                }
            )
            raw = await provider.complete(system, user)
            data = json.loads(raw)
            by_name = {s.field: s for s in base}
            for entry in data.get("fields", []):
                name = entry.get("field")
                ideas = entry.get("suggestions") or []
                if not name or not isinstance(ideas, list):
                    continue
                if name in by_name:
                    merged = list(dict.fromkeys([*by_name[name].suggestions, *ideas]))[:20]
                    by_name[name].suggestions = merged
                    by_name[name].source = "ai"
                else:
                    by_name[name] = EdgeCaseSuggestion(
                        field=name,
                        suggestions=[str(x) for x in ideas][:20],
                        rationale="Suggested by AI",
                        source="ai",
                    )
            return list(by_name.values())
        except Exception:  # noqa: BLE001
            return base
