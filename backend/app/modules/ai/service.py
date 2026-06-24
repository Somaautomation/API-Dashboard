"""AI assistance service: assertions, retry suggestions, test case generation."""
from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

from app.modules.ai.provider import (
    DisabledProvider,
    get_provider,
    heuristic_assertions,
    heuristic_retry_policy,
    heuristic_test_cases,
)


class AssertSuggestRequest(BaseModel):
    sample_response: Any
    swagger_schema: dict | None = None


class RetrySuggestRequest(BaseModel):
    error_kind: str = "http_error"
    status_code: int | None = None
    latency_ms: int | None = None


class TestCaseRequest(BaseModel):
    endpoint: dict  # {method, path, parameters, request_schema, ...}


class AIService:
    def __init__(self):
        self.provider = get_provider()

    async def suggest_assertions(self, req: AssertSuggestRequest) -> list[dict]:
        if isinstance(self.provider, DisabledProvider):
            return heuristic_assertions(req.sample_response)
        system = "You are an API testing expert. Output strict JSON with key 'assertions'."
        user = json.dumps(req.model_dump())
        raw = await self.provider.complete(system, user)
        try:
            return json.loads(raw).get("assertions", [])
        except Exception:
            return heuristic_assertions(req.sample_response)

    async def suggest_retry_policy(self, req: RetrySuggestRequest) -> dict:
        if isinstance(self.provider, DisabledProvider):
            return heuristic_retry_policy(req.error_kind, req.status_code)
        system = "You are a resiliency engineer. Output strict JSON for retry/backoff/circuit-breaker."
        raw = await self.provider.complete(system, json.dumps(req.model_dump()))
        try:
            return json.loads(raw)
        except Exception:
            return heuristic_retry_policy(req.error_kind, req.status_code)

    async def generate_test_cases(self, req: TestCaseRequest) -> dict:
        if isinstance(self.provider, DisabledProvider):
            return heuristic_test_cases(req.endpoint)
        system = (
            "You are a senior QA engineer. Produce strict JSON with keys "
            "'positive','negative','boundary','security', each an array of test descriptors."
        )
        raw = await self.provider.complete(system, json.dumps(req.model_dump()))
        try:
            return json.loads(raw)
        except Exception:
            return heuristic_test_cases(req.endpoint)
