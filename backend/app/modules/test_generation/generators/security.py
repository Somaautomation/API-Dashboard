"""Security probe generator — opt-in via GenerateOptions.include_security."""
from __future__ import annotations

from typing import Any

from app.modules.test_generation.dtos import GeneratedTestCase
from app.modules.test_generation.generators.base import EndpointContext, TestGenerator, make_case
from app.modules.test_generation.schema_analyzer import sample_value, set_field


class SecurityGenerator(TestGenerator):
    category = "security"

    def generate(self, ctx: EndpointContext) -> list[GeneratedTestCase]:
        cases: list[GeneratedTestCase] = []
        base_body = sample_value(ctx.request_schema) if ctx.request_schema else None
        path_vals = {p["name"]: sample_value(p.get("schema") or {}) for p in ctx.params("path")}

        # Header injection / oversized headers.
        cases.append(
            make_case(
                ctx=ctx,
                category=self.category,
                name="Security — oversized header value",
                description="Server should not crash on a 16kB header",
                headers={"X-Probe": "A" * 16000},
                body=base_body,
                path_overrides=path_vals,
                expected_status=400,
                tags=["security", "oversized-header"],
            )
        )

        # Common injection payloads against string fields.
        if isinstance(base_body, dict) and isinstance(ctx.request_schema, dict):
            for name in list((ctx.request_schema.get("properties") or {}).keys())[:3]:
                cases.append(
                    make_case(
                        ctx=ctx,
                        category=self.category,
                        name=f"Security — XSS payload in '{name}'",
                        body=set_field(base_body, name, "<script>alert(1)</script>"),
                        path_overrides=path_vals,
                        expected_status=200,
                        tags=["security", "xss"],
                    )
                )
                cases.append(
                    make_case(
                        ctx=ctx,
                        category=self.category,
                        name=f"Security — SQL fragment in '{name}'",
                        body=set_field(base_body, name, "' OR 1=1 --"),
                        path_overrides=path_vals,
                        expected_status=400,
                        tags=["security", "sqli"],
                    )
                )
        return cases
