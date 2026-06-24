"""Heuristic + (optionally) LLM-driven edge-case suggestions.

The heuristic layer is fast and always available. When a real LLM provider
is configured (``settings.ai_provider == "openai"``) the service layer
augments these suggestions with a model call.
"""
from __future__ import annotations

from typing import Any

from app.modules.test_generation.dtos import EdgeCaseSuggestion, GeneratedTestCase
from app.modules.test_generation.generators.base import EndpointContext, TestGenerator, make_case
from app.modules.test_generation.schema_analyzer import SchemaNode, sample_value, set_field

VALIDATION_STATUS = 400


# Field-name hints -> extra suggestions. Tuned for typical REST APIs.
_FIELD_HINTS: dict[str, list[str]] = {
    "email": [
        "empty string",
        "missing @",
        "very long local part (>200 chars)",
        "international/unicode characters",
        "leading/trailing whitespace",
    ],
    "password": [
        "single character",
        "extremely long (>1000 chars)",
        "only whitespace",
        "common password 'password123'",
        "unicode characters",
    ],
    "age": [
        "0",
        "-1",
        "999999",
        "non-integer (e.g. 3.5)",
        "string '20'",
    ],
    "name": [
        "empty",
        "single space",
        "only special characters",
        "SQL fragment ' OR 1=1 --",
        "very long string",
    ],
    "phone": [
        "letters",
        "missing country code",
        "very long (>30 digits)",
        "international format",
    ],
    "id": [
        "0",
        "-1",
        "non-existent uuid",
        "wrong format (e.g. 'abc')",
        "extremely large id (2^63)",
    ],
    "url": [
        "missing scheme",
        "javascript: scheme",
        "very long (>2000 chars)",
        "non-ascii characters",
    ],
    "date": [
        "leap-year boundary 2024-02-29",
        "31-13-2024",
        "epoch zero",
        "future far date 9999-12-31",
    ],
}


class EdgeCaseGenerator(TestGenerator):
    """Combines heuristic suggestions with concrete generated test cases."""

    category = "edge_case"

    def suggestions(self, ctx: EndpointContext) -> list[EdgeCaseSuggestion]:
        out: list[EdgeCaseSuggestion] = []
        if not isinstance(ctx.request_schema, dict):
            return out
        for name, sub in (ctx.request_schema.get("properties") or {}).items():
            node = SchemaNode(sub)
            hints = _FIELD_HINTS.get(name.lower(), [])
            if node.enum:
                out.append(
                    EdgeCaseSuggestion(
                        field=name,
                        type="enum",
                        suggestions=[
                            "lowercase variation",
                            "uppercase variation",
                            "value with surrounding whitespace",
                            "numeric instead of string",
                            "unknown value '__invalid__'",
                        ],
                        rationale=f"Field accepts enum {node.enum}",
                    )
                )
                continue
            t = node.inferred_type()
            if t == "integer" or t == "number":
                merged = ["0", "-1", str(2**31), str(-(2**31)), "NaN", "Infinity"]
                if hints:
                    merged = list(dict.fromkeys([*merged, *hints]))
                out.append(
                    EdgeCaseSuggestion(
                        field=name,
                        type=t,
                        suggestions=merged,
                        rationale="Numeric boundary & overflow edge cases",
                    )
                )
            elif t == "string":
                base = [
                    "empty string",
                    "single character",
                    "very long string (10kB)",
                    "unicode characters",
                    "control characters (\\0, \\x01)",
                    "whitespace-only",
                ]
                if hints:
                    base = list(dict.fromkeys([*hints, *base]))
                out.append(
                    EdgeCaseSuggestion(
                        field=name,
                        type=t,
                        suggestions=base,
                        rationale="Common string edge cases (encoding, length, whitespace)",
                    )
                )
        return out

    def generate(self, ctx: EndpointContext) -> list[GeneratedTestCase]:
        cases: list[GeneratedTestCase] = []
        if not isinstance(ctx.request_schema, dict):
            return cases
        base_body = sample_value(ctx.request_schema)
        if not isinstance(base_body, dict):
            return cases
        path_vals = {p["name"]: sample_value(p.get("schema") or {}) for p in ctx.params("path")}

        for name, sub in (ctx.request_schema.get("properties") or {}).items():
            node = SchemaNode(sub)
            t = node.inferred_type()
            if t == "string":
                cases.append(
                    self._case(
                        ctx,
                        name=f"Edge — whitespace-only value for '{name}'",
                        body=set_field(base_body, name, "   "),
                        path_vals=path_vals,
                        expected_status=VALIDATION_STATUS,
                    )
                )
                cases.append(
                    self._case(
                        ctx,
                        name=f"Edge — unicode value for '{name}'",
                        body=set_field(base_body, name, "测试-😀-Ω"),
                        path_vals=path_vals,
                        expected_status=200,
                    )
                )
            elif t in {"integer", "number"}:
                cases.append(
                    self._case(
                        ctx,
                        name=f"Edge — zero value for '{name}'",
                        body=set_field(base_body, name, 0),
                        path_vals=path_vals,
                        expected_status=VALIDATION_STATUS
                        if (node.minimum is not None and node.minimum > 0)
                        else 200,
                    )
                )
                cases.append(
                    self._case(
                        ctx,
                        name=f"Edge — large value for '{name}'",
                        body=set_field(base_body, name, 999_999_999),
                        path_vals=path_vals,
                        expected_status=VALIDATION_STATUS
                        if node.maximum is not None
                        else 200,
                    )
                )
        return cases

    def _case(
        self,
        ctx: EndpointContext,
        *,
        name: str,
        body: Any,
        path_vals: dict[str, Any],
        expected_status: int,
    ) -> GeneratedTestCase:
        return make_case(
            ctx=ctx,
            category=self.category,
            name=name,
            body=body,
            path_overrides=path_vals,
            expected_status=expected_status,
            tags=["edge-case"],
        )
