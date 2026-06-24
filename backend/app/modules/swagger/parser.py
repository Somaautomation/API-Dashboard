"""OpenAPI / Swagger parser & validator (works for OpenAPI 2.0 and 3.x)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import yaml
from openapi_spec_validator import validate as openapi_validate
from openapi_spec_validator.validation.exceptions import OpenAPIValidationError

from app.core.errors import ValidationError

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


@dataclass
class ParsedEndpoint:
    method: str
    path: str
    operation_id: str | None
    summary: str
    tags: list[str]
    parameters: list[dict[str, Any]]
    request_schema: dict[str, Any] | None
    responses: dict[str, Any]


@dataclass
class ParsedSpec:
    title: str
    version: str
    openapi_version: str
    description: str
    raw: dict[str, Any]
    endpoints: list[ParsedEndpoint]


def _load(payload: bytes, filename: str) -> dict[str, Any]:
    text = payload.decode("utf-8", errors="replace").strip()
    try:
        if filename.lower().endswith((".yml", ".yaml")) or not text.startswith("{"):
            return yaml.safe_load(text)
        return json.loads(text)
    except Exception as exc:
        raise ValidationError(f"Could not parse spec file: {exc}") from exc


def parse_and_validate(payload: bytes, filename: str) -> ParsedSpec:
    """Validate an OpenAPI/Swagger spec and extract endpoint metadata."""
    raw = _load(payload, filename)
    if not isinstance(raw, dict):
        raise ValidationError("Spec must be a JSON/YAML object")

    try:
        openapi_validate(raw)
    except OpenAPIValidationError as exc:
        raise ValidationError(f"Invalid OpenAPI spec: {exc.message}") from exc

    info = raw.get("info", {})
    version = raw.get("openapi") or raw.get("swagger") or "unknown"

    endpoints: list[ParsedEndpoint] = []
    for path, item in (raw.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        path_params = item.get("parameters", []) or []
        for method, op in item.items():
            if method.lower() not in HTTP_METHODS or not isinstance(op, dict):
                continue

            req_schema: dict | None = None
            body = op.get("requestBody") or {}
            content = body.get("content") if isinstance(body, dict) else None
            if isinstance(content, dict):
                json_body = content.get("application/json") or next(iter(content.values()), {})
                if isinstance(json_body, dict):
                    req_schema = json_body.get("schema")

            endpoints.append(
                ParsedEndpoint(
                    method=method.upper(),
                    path=path,
                    operation_id=op.get("operationId"),
                    summary=op.get("summary") or op.get("description") or "",
                    tags=op.get("tags") or [],
                    parameters=[*path_params, *(op.get("parameters") or [])],
                    request_schema=req_schema,
                    responses=op.get("responses") or {},
                )
            )

    return ParsedSpec(
        title=info.get("title") or "Untitled API",
        version=info.get("version") or "0.0.0",
        openapi_version=str(version),
        description=info.get("description") or "",
        raw=raw,
        endpoints=endpoints,
    )
