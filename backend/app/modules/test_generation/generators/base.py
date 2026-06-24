"""Common base for generator strategies."""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.modules.test_generation.dtos import GeneratedTestCase, GenerateOptions


@dataclass
class EndpointContext:
    """All endpoint metadata a generator needs, normalised into one struct."""

    endpoint_id: str | None
    method: str
    path: str
    summary: str
    operation_id: str | None
    parameters: list[dict[str, Any]] = field(default_factory=list)
    request_schema: dict[str, Any] | None = None
    responses: dict[str, Any] = field(default_factory=dict)
    security: list[dict[str, Any]] = field(default_factory=list)
    base_url: str = "{{baseUrl}}"
    options: GenerateOptions = field(default_factory=GenerateOptions)

    # --- convenience -------------------------------------------------------
    @property
    def requires_auth(self) -> bool:
        return bool(self.security)

    def params(self, location: str) -> list[dict[str, Any]]:
        return [p for p in self.parameters if p.get("in") == location]

    def required_body_fields(self) -> list[str]:
        return list((self.request_schema or {}).get("required") or [])

    def first_success_status(self) -> int:
        if self.method.upper() == "POST":
            for code in self.responses or {}:
                if str(code) in {"201", "200"}:
                    return int(code)
            return 201 if self.responses else 200
        if self.method.upper() == "DELETE":
            return 204 if "204" in (self.responses or {}) else 200
        return 200

    def build_url(self, path_overrides: dict[str, Any] | None = None) -> str:
        p = self.path
        if path_overrides:
            for k, v in path_overrides.items():
                p = p.replace(f"{{{k}}}", str(v))
        return f"{self.base_url.rstrip('/')}{p}"


class TestGenerator(ABC):
    """Strategy interface — each implementation returns one category of cases."""

    category: str = "generic"

    @abstractmethod
    def generate(self, ctx: EndpointContext) -> list[GeneratedTestCase]:
        ...


# ---- helpers used by all concrete generators ------------------------------
def make_case(
    *,
    ctx: EndpointContext,
    category: str,
    name: str,
    description: str = "",
    body: Any | None = None,
    query: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    path_overrides: dict[str, Any] | None = None,
    expected_status: int | None = None,
    tags: list[str] | None = None,
) -> GeneratedTestCase:
    """Factory enforcing consistent IDs and default headers."""
    base_headers: dict[str, str] = {}
    if ctx.requires_auth:
        base_headers[ctx.options.auth_header_name] = ctx.options.auth_header_value
    if body is not None:
        base_headers.setdefault("Content-Type", "application/json")
    if headers:
        base_headers.update(headers)
    return GeneratedTestCase(
        id=str(uuid.uuid4()),
        name=name,
        category=category,  # type: ignore[arg-type]
        description=description,
        method=ctx.method.upper(),
        path=ctx.path,
        url=ctx.build_url(path_overrides),
        headers=base_headers,
        query=query or {},
        body=body,
        assertions=[],
        tags=tags or [],
        expected_status=expected_status,
    )
