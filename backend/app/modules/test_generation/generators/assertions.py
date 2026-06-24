"""Assertion generator — derives assertions for a single test case."""
from __future__ import annotations

from typing import Any

from app.modules.test_generation.dtos import Assertion, GeneratedTestCase
from app.modules.test_generation.generators.base import EndpointContext


class AssertionGenerator:
    """Attaches an appropriate assertion set to a generated test case.

    Compatible with the runtime dispatcher in
    ``app.modules.validation.assertions`` (``status_code``, ``header``,
    ``json_schema``, ``contains_key`` + the new ``response_time_ms`` and
    ``status_code_in`` entries we add).
    """

    def attach(self, ctx: EndpointContext, case: GeneratedTestCase) -> GeneratedTestCase:
        assertions: list[Assertion] = []
        status = case.expected_status
        if status is not None:
            assertions.append(
                Assertion(
                    type="status_code",
                    description=f"Expected HTTP {status}",
                    expected=status,
                )
            )

        # Response time threshold — applied universally so users see slow ops.
        assertions.append(
            Assertion(
                type="response_time_ms",
                description=f"Response time below {ctx.options.response_time_threshold_ms} ms",
                threshold_ms=ctx.options.response_time_threshold_ms,
            )
        )

        # Positive cases get richer assertions: schema + required-key checks.
        if case.category == "positive" and status and 200 <= status < 300:
            response_def = (ctx.responses or {}).get(str(status)) or {}
            schema = _extract_response_schema(response_def)
            if schema:
                assertions.append(
                    Assertion(
                        type="json_schema",
                        description="Response body matches the documented schema",
                        **{"schema": schema},
                    )
                )
                for required_key in (schema.get("required") or [])[:5]:
                    assertions.append(
                        Assertion(
                            type="contains_key",
                            description=f"Response contains required field '{required_key}'",
                            path=[required_key],
                        )
                    )

        case.assertions = assertions
        return case


def _extract_response_schema(response_def: dict[str, Any]) -> dict[str, Any] | None:
    content = response_def.get("content") if isinstance(response_def, dict) else None
    if not isinstance(content, dict):
        return None
    json_def = content.get("application/json") or next(iter(content.values()), {})
    if isinstance(json_def, dict):
        schema = json_def.get("schema")
        if isinstance(schema, dict):
            return schema
    return None
