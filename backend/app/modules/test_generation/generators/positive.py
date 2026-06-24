"""Positive test-case generator."""
from __future__ import annotations

from typing import Any

from app.modules.test_generation.dtos import GeneratedTestCase
from app.modules.test_generation.generators.base import EndpointContext, TestGenerator, make_case
from app.modules.test_generation.schema_analyzer import SchemaNode, sample_value


class PositiveGenerator(TestGenerator):
    category = "positive"

    def generate(self, ctx: EndpointContext) -> list[GeneratedTestCase]:
        cases: list[GeneratedTestCase] = []
        status = ctx.first_success_status()

        path_vals = self._sample_params(ctx, "path")
        query_required = self._sample_params(ctx, "query", required_only=True)
        query_all = self._sample_params(ctx, "query", required_only=False)
        header_vals = self._sample_params(ctx, "header")

        body_full = sample_value(ctx.request_schema) if ctx.request_schema else None
        body_required = _required_only(ctx.request_schema, body_full)

        cases.append(
            make_case(
                ctx=ctx,
                category=self.category,
                name=f"Valid request — {ctx.method} {ctx.path}",
                description="Happy-path call with all required fields populated",
                body=body_required,
                query=query_required,
                headers=header_vals,
                path_overrides=path_vals,
                expected_status=status,
                tags=["happy-path"],
            )
        )

        if body_full and body_full != body_required:
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Valid request — required + optional fields",
                    description="Request that exercises every documented field",
                    body=body_full,
                    query=query_all,
                    headers=header_vals,
                    path_overrides=path_vals,
                    expected_status=status,
                    tags=["full-payload"],
                )
            )
        elif query_all and query_all != query_required:
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Valid request — including optional query params",
                    body=body_required,
                    query=query_all,
                    headers=header_vals,
                    path_overrides=path_vals,
                    expected_status=status,
                    tags=["optional-params"],
                )
            )

        # Auth-success scenario (only meaningful when the endpoint requires auth).
        if ctx.requires_auth:
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Authenticated request succeeds",
                    description="Valid token supplied — backend should authorise the call",
                    body=body_required,
                    query=query_required,
                    headers=header_vals,
                    path_overrides=path_vals,
                    expected_status=status,
                    tags=["auth"],
                )
            )

        # Boundary-valid: minimum allowed values still pass.
        boundary_body = _apply_boundary_extremes(ctx.request_schema, body_full, edge="min")
        if boundary_body is not None and boundary_body != body_required:
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Valid boundary — minimum allowed values",
                    description="All numeric/string fields at their lower bound",
                    body=boundary_body,
                    query=query_required,
                    headers=header_vals,
                    path_overrides=path_vals,
                    expected_status=status,
                    tags=["boundary-valid"],
                )
            )

        return cases

    # ----- helpers -------------------------------------------------------
    def _sample_params(
        self, ctx: EndpointContext, location: str, *, required_only: bool = True
    ) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for p in ctx.params(location):
            if required_only and not p.get("required"):
                continue
            schema = p.get("schema") or {}
            if "example" in p:
                out[p["name"]] = p["example"]
            else:
                out[p["name"]] = sample_value(schema)
        return out


def _required_only(schema: dict[str, Any] | None, full: Any) -> Any:
    if not isinstance(full, dict) or not isinstance(schema, dict):
        return full
    required = list(schema.get("required") or [])
    if not required:
        return full
    return {k: v for k, v in full.items() if k in required}


def _apply_boundary_extremes(
    schema: dict[str, Any] | None, payload: Any, *, edge: str
) -> Any:
    if not isinstance(schema, dict) or not isinstance(payload, dict):
        return payload
    out = dict(payload)
    for field_name, sub in (schema.get("properties") or {}).items():
        if field_name not in out:
            continue
        node = SchemaNode(sub)
        if edge == "min":
            if node.inferred_type() in {"integer", "number"} and node.minimum is not None:
                out[field_name] = node.minimum
            elif node.inferred_type() == "string" and node.min_length:
                out[field_name] = "a" * int(node.min_length)
    return out
