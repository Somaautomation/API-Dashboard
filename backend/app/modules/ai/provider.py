"""Pluggable LLM provider abstraction with safe heuristic fallback."""
from __future__ import annotations

import json
from typing import Any

from app.core.config import settings


class LLMProvider:
    async def complete(self, system: str, user: str) -> str:  # pragma: no cover
        raise NotImplementedError


class DisabledProvider(LLMProvider):
    async def complete(self, system: str, user: str) -> str:
        return json.dumps({"note": "AI provider disabled — returning empty result"})


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def complete(self, system: str, user: str) -> str:
        resp = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or "{}"


def get_provider() -> LLMProvider:
    if settings.ai_provider == "openai" and settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    return DisabledProvider()


# ---------- heuristic fallbacks (used if provider is disabled) ----------
def heuristic_assertions(sample_response: Any) -> list[dict]:
    """Suggest assertions from a sample response payload."""
    out: list[dict] = [{"type": "status_code", "expected": 200}]
    if isinstance(sample_response, dict):
        for k, v in sample_response.items():
            out.append({"type": "contains_key", "path": [k]})
            if isinstance(v, (int, float, str, bool)):
                out.append({"type": "json_schema", "schema": {
                    "type": "object",
                    "required": [k],
                    "properties": {k: {"type": _json_type(v)}},
                }})
    return out


def _json_type(v: Any) -> str:
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "number"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return "string"


def heuristic_retry_policy(error_kind: str, status_code: int | None) -> dict:
    if status_code and 500 <= status_code < 600:
        return {"retries": 3, "backoff": "exponential", "initial_ms": 200, "max_ms": 2000,
                "circuit_breaker": {"failure_threshold": 5, "reset_seconds": 30}}
    if status_code in (408, 425, 429):
        return {"retries": 5, "backoff": "exponential_jitter", "initial_ms": 500, "max_ms": 5000}
    return {"retries": 0, "backoff": "none", "circuit_breaker": None}


def heuristic_test_cases(endpoint: dict) -> dict:
    return {
        "positive": [{"name": f"happy path {endpoint.get('path')}", "expected_status": 200}],
        "negative": [
            {"name": "missing auth", "headers": {}, "expected_status": 401},
            {"name": "bad payload", "body": {"_invalid": True}, "expected_status": 400},
        ],
        "boundary": [{"name": "empty body", "body": {}, "expected_status": 400}],
        "security": [
            {"name": "sql injection in query", "query": {"q": "' OR 1=1 --"}, "expected_status_in": [400, 422]},
            {"name": "xss in body", "body": {"name": "<script>alert(1)</script>"}, "expected_status_in": [200, 400]},
        ],
    }
