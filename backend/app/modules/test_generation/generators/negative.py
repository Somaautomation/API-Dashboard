"""Negative test-case generator — exercises validation & auth failures."""
from __future__ import annotations

from typing import Any

from app.modules.test_generation.dtos import GeneratedTestCase
from app.modules.test_generation.generators.base import EndpointContext, TestGenerator, make_case
from app.modules.test_generation.schema_analyzer import (
    SchemaNode,
    invalid_format_value,
    random_string,
    remove_field,
    sample_value,
    set_field,
    wrong_type_value,
)

VALIDATION_STATUS = 400  # also accept 422; runners can broaden via status_code_in
UNAUTHORIZED_STATUS = 401
NOT_FOUND_STATUS = 404
CONFLICT_STATUS = 409


class NegativeGenerator(TestGenerator):
    category = "negative"

    def generate(self, ctx: EndpointContext) -> list[GeneratedTestCase]:
        cases: list[GeneratedTestCase] = []
        valid_body = sample_value(ctx.request_schema) if ctx.request_schema else None
        path_vals = self._sample_path(ctx)

        # --- body validation negatives -----------------------------------
        if isinstance(valid_body, dict) and isinstance(ctx.request_schema, dict):
            schema = ctx.request_schema
            props: dict[str, Any] = schema.get("properties") or {}

            for required in (schema.get("required") or [])[:6]:
                cases.append(
                    make_case(
                        ctx=ctx,
                        category=self.category,
                        name=f"Missing required field — '{required}'",
                        description=f"Drop '{required}' from the payload; expect validation error",
                        body=remove_field(valid_body, required),
                        path_overrides=path_vals,
                        expected_status=VALIDATION_STATUS,
                        tags=["missing-required", required],
                    )
                )
                cases.append(
                    make_case(
                        ctx=ctx,
                        category=self.category,
                        name=f"Null value for required field — '{required}'",
                        body=set_field(valid_body, required, None),
                        path_overrides=path_vals,
                        expected_status=VALIDATION_STATUS,
                        tags=["null", required],
                    )
                )

            for name, sub in list(props.items())[:8]:
                node = SchemaNode(sub)
                t = node.inferred_type()
                if t == "string":
                    cases.append(
                        make_case(
                            ctx=ctx,
                            category=self.category,
                            name=f"Empty string for '{name}'",
                            body=set_field(valid_body, name, ""),
                            path_overrides=path_vals,
                            expected_status=VALIDATION_STATUS,
                            tags=["empty-string", name],
                        )
                    )
                if t in {"string", "integer", "number", "boolean", "array"}:
                    bad = wrong_type_value(t)
                    if bad is not None:
                        cases.append(
                            make_case(
                                ctx=ctx,
                                category=self.category,
                                name=f"Wrong data type for '{name}' (expected {t})",
                                body=set_field(valid_body, name, bad),
                                path_overrides=path_vals,
                                expected_status=VALIDATION_STATUS,
                                tags=["wrong-type", name],
                            )
                        )
                if node.enum:
                    cases.append(
                        make_case(
                            ctx=ctx,
                            category=self.category,
                            name=f"Invalid enum value for '{name}'",
                            body=set_field(valid_body, name, "__not_in_enum__"),
                            path_overrides=path_vals,
                            expected_status=VALIDATION_STATUS,
                            tags=["enum", name],
                        )
                    )
                if t == "string" and node.format:
                    cases.append(
                        make_case(
                            ctx=ctx,
                            category=self.category,
                            name=f"Invalid {node.format} format for '{name}'",
                            body=set_field(valid_body, name, invalid_format_value(node.format)),
                            path_overrides=path_vals,
                            expected_status=VALIDATION_STATUS,
                            tags=["format", node.format, name],
                        )
                    )
                if t == "string" and node.max_length:
                    cases.append(
                        make_case(
                            ctx=ctx,
                            category=self.category,
                            name=f"Exceeds maxLength for '{name}' (>{node.max_length})",
                            body=set_field(
                                valid_body, name, random_string(int(node.max_length) + 1)
                            ),
                            path_overrides=path_vals,
                            expected_status=VALIDATION_STATUS,
                            tags=["max-length", name],
                        )
                    )
                if t == "string" and node.min_length and int(node.min_length) > 0:
                    cases.append(
                        make_case(
                            ctx=ctx,
                            category=self.category,
                            name=f"Below minLength for '{name}' (<{node.min_length})",
                            body=set_field(valid_body, name, ""),
                            path_overrides=path_vals,
                            expected_status=VALIDATION_STATUS,
                            tags=["min-length", name],
                        )
                    )

        # --- auth negatives ----------------------------------------------
        if ctx.requires_auth:
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Unauthorized — no auth header",
                    description="Authorization header omitted; expect 401",
                    body=valid_body,
                    headers={ctx.options.auth_header_name: ""},
                    path_overrides=path_vals,
                    expected_status=UNAUTHORIZED_STATUS,
                    tags=["auth", "missing-token"],
                )
            )
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Unauthorized — expired/garbage token",
                    headers={ctx.options.auth_header_name: "Bearer expired.invalid.token"},
                    body=valid_body,
                    path_overrides=path_vals,
                    expected_status=UNAUTHORIZED_STATUS,
                    tags=["auth", "expired-token"],
                )
            )

        # --- path & query parameter negatives ----------------------------
        for p in ctx.params("path")[:3]:
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name=f"Invalid path parameter — '{p['name']}'",
                    description="Supply garbage value for a path parameter",
                    path_overrides={**path_vals, p["name"]: "__invalid__"},
                    body=valid_body,
                    expected_status=NOT_FOUND_STATUS,
                    tags=["path-param", p["name"]],
                )
            )

        for p in ctx.params("query")[:3]:
            schema = p.get("schema") or {}
            node = SchemaNode(schema)
            if node.inferred_type() in {"integer", "number"}:
                cases.append(
                    make_case(
                        ctx=ctx,
                        category=self.category,
                        name=f"Invalid query parameter type — '{p['name']}' expects {node.inferred_type()}",
                        query={p["name"]: "not-a-number"},
                        body=valid_body,
                        path_overrides=path_vals,
                        expected_status=VALIDATION_STATUS,
                        tags=["query-param", p["name"]],
                    )
                )

        # --- duplicate-create heuristic (POST endpoints) -----------------
        if ctx.method.upper() == "POST":
            cases.append(
                make_case(
                    ctx=ctx,
                    category=self.category,
                    name="Duplicate resource creation should conflict",
                    description="Second POST with the same payload should return 409 Conflict",
                    body=valid_body,
                    path_overrides=path_vals,
                    expected_status=CONFLICT_STATUS,
                    tags=["duplicate"],
                )
            )

        return cases

    def _sample_path(self, ctx: EndpointContext) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for p in ctx.params("path"):
            schema = p.get("schema") or {}
            out[p["name"]] = sample_value(schema)
        return out
