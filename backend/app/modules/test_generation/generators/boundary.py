"""Boundary test-case generator — min, max, just-below, just-above."""
from __future__ import annotations

from typing import Any

from app.modules.test_generation.dtos import GeneratedTestCase
from app.modules.test_generation.generators.base import EndpointContext, TestGenerator, make_case
from app.modules.test_generation.schema_analyzer import SchemaNode, random_string, sample_value, set_field

VALIDATION_STATUS = 400


class BoundaryGenerator(TestGenerator):
    category = "boundary"

    def generate(self, ctx: EndpointContext) -> list[GeneratedTestCase]:
        cases: list[GeneratedTestCase] = []
        if not isinstance(ctx.request_schema, dict):
            return cases

        base_body = sample_value(ctx.request_schema)
        if not isinstance(base_body, dict):
            return cases
        path_vals = self._sample_path(ctx)
        success = ctx.first_success_status()

        for name, sub in (ctx.request_schema.get("properties") or {}).items():
            node = SchemaNode(sub)
            t = node.inferred_type()

            if t in {"integer", "number"}:
                if node.minimum is not None:
                    cases.append(
                        self._case(ctx, name, "min value", node.minimum, base_body, path_vals, success)
                    )
                    cases.append(
                        self._case(
                            ctx,
                            name,
                            "just below min",
                            _decrement(node.minimum, t),
                            base_body,
                            path_vals,
                            VALIDATION_STATUS,
                        )
                    )
                if node.maximum is not None:
                    cases.append(
                        self._case(ctx, name, "max value", node.maximum, base_body, path_vals, success)
                    )
                    cases.append(
                        self._case(
                            ctx,
                            name,
                            "just above max",
                            _increment(node.maximum, t),
                            base_body,
                            path_vals,
                            VALIDATION_STATUS,
                        )
                    )
            elif t == "string":
                if node.min_length is not None:
                    cases.append(
                        self._case(
                            ctx,
                            name,
                            f"minLength={node.min_length}",
                            "a" * int(node.min_length),
                            base_body,
                            path_vals,
                            success,
                        )
                    )
                if node.max_length is not None:
                    cases.append(
                        self._case(
                            ctx,
                            name,
                            f"maxLength={node.max_length}",
                            random_string(int(node.max_length)),
                            base_body,
                            path_vals,
                            success,
                        )
                    )

        return cases

    # -----
    def _case(
        self,
        ctx: EndpointContext,
        field: str,
        label: str,
        value: Any,
        base_body: dict,
        path_vals: dict,
        expected_status: int,
    ) -> GeneratedTestCase:
        return make_case(
            ctx=ctx,
            category=self.category,
            name=f"Boundary — '{field}' {label}",
            description=f"Set '{field}' to {value!r}",
            body=set_field(base_body, field, value),
            path_overrides=path_vals,
            expected_status=expected_status,
            tags=["boundary", field, label],
        )

    def _sample_path(self, ctx: EndpointContext) -> dict[str, Any]:
        return {p["name"]: sample_value(p.get("schema") or {}) for p in ctx.params("path")}


def _decrement(value: Any, t: str) -> Any:
    if t == "integer":
        return int(value) - 1
    try:
        return float(value) - 0.000001
    except Exception:
        return value


def _increment(value: Any, t: str) -> Any:
    if t == "integer":
        return int(value) + 1
    try:
        return float(value) + 0.000001
    except Exception:
        return value
