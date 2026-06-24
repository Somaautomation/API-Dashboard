"""Natural-language failure analysis for test results.

Heuristic explanations are produced instantly. If an LLM provider is
configured, a richer narrative is requested asynchronously and overlaid.
"""
from __future__ import annotations

import json
from typing import Any

from app.modules.ai.provider import DisabledProvider, get_provider
from app.modules.test_generation.dtos import FailureExplanation, FailureInput


_TECHNICAL_HINTS: dict[int, tuple[str, list[str], list[str]]] = {
    500: (
        "The server returned an internal error instead of a client-side "
        "validation response. The validation layer is likely not catching "
        "the malformed input before it reaches business logic.",
        [
            "Missing validation middleware or pydantic guard",
            "Null-pointer / dereference in the handler",
            "Database constraint violation surfacing as 500",
            "Unhandled exception in a downstream call",
        ],
        [
            "Add input validation at the API boundary",
            "Wrap the handler with structured error mapping (400/422 vs 500)",
            "Reproduce with the exact payload above to capture a stack trace",
        ],
    ),
    401: (
        "Authentication failed — the request did not present credentials "
        "the API could verify.",
        [
            "Auth header missing or malformed",
            "Token expired or signed with the wrong key",
            "Session cookie not propagated",
        ],
        [
            "Refresh the access token / re-run the login step",
            "Confirm the Authorization header reaches the backend (no proxy stripping)",
        ],
    ),
    403: (
        "The request authenticated but was forbidden — the principal does "
        "not have permission for this resource.",
        [
            "Role / scope insufficient for this operation",
            "Row-level security or tenant mismatch",
        ],
        [
            "Run with a user that owns the required role",
            "Check policy / RBAC rules for the endpoint",
        ],
    ),
    404: (
        "The endpoint or resource id was not found.",
        [
            "Path parameter does not exist in the database",
            "Route mounted under a different prefix",
        ],
        [
            "Verify the path parameter value",
            "Confirm the resource was created prior to this test",
        ],
    ),
    409: (
        "Conflict — typically a uniqueness or optimistic-concurrency violation.",
        [
            "Resource with the same key was created in a previous run",
            "If-Match / version header mismatched",
        ],
        [
            "Generate a unique key per run, or clean state between runs",
        ],
    ),
    422: (
        "Server rejected the payload as semantically invalid.",
        [
            "Field type or format does not match the schema",
            "Required field omitted",
            "Enum / range constraint violated",
        ],
        [
            "Compare the request body against the documented schema",
            "Check the validation error details in the response body",
        ],
    ),
}


def _heuristic(inp: FailureInput) -> FailureExplanation:
    technical = {
        "endpoint": f"{inp.endpoint_method} {inp.endpoint_path}",
        "expected_status": inp.expected_status,
        "actual_status": inp.actual_status,
        "request_body": inp.request_body,
        "response_excerpt": (inp.response_body or "")[:500],
        "error": inp.error,
    }
    actual = inp.actual_status or 0
    summary, causes, actions = _TECHNICAL_HINTS.get(
        actual,
        (
            "The endpoint returned an unexpected status code. Compare the "
            "request shape against the documented contract.",
            [
                "Unexpected branch in the handler",
                "Upstream dependency returned an error",
                "Race condition with another concurrent test",
            ],
            [
                "Re-run the test in isolation",
                "Inspect the response body for an error message",
            ],
        ),
    )
    severity = (
        "critical"
        if actual >= 500
        else "high"
        if actual in {401, 403, 409}
        else "medium"
    )
    return FailureExplanation(
        title=f"Test failed: {inp.test_name}",
        summary=summary,
        technical=technical,
        possible_causes=causes,
        suggested_actions=actions,
        severity=severity,
        source="heuristic",
    )


async def explain_failure(inp: FailureInput) -> FailureExplanation:
    base = _heuristic(inp)
    provider = get_provider()
    if isinstance(provider, DisabledProvider):
        return base
    try:
        system = (
            "You are a senior backend engineer triaging an API test failure. "
            "Return strict JSON: {summary, possible_causes:[], suggested_actions:[]}."
        )
        user = json.dumps(inp.model_dump(mode="json"))
        raw = await provider.complete(system, user)
        data: dict[str, Any] = json.loads(raw)
        if isinstance(data, dict):
            base.summary = data.get("summary") or base.summary
            if isinstance(data.get("possible_causes"), list):
                base.possible_causes = [str(x) for x in data["possible_causes"]][:10]
            if isinstance(data.get("suggested_actions"), list):
                base.suggested_actions = [str(x) for x in data["suggested_actions"]][:10]
            base.source = "ai"
    except Exception:  # noqa: BLE001 — never let LLM hiccups break the API
        pass
    return base
