"""Unit tests for the AI test-generation module."""
from __future__ import annotations

import asyncio

import pytest

from app.modules.test_generation.dtos import FailureInput, GenerateOptions
from app.modules.test_generation.failure_analyzer import explain_failure
from app.modules.test_generation.generators import (
    AssertionGenerator,
    BoundaryGenerator,
    EdgeCaseGenerator,
    EndpointContext,
    NegativeGenerator,
    PositiveGenerator,
)
from app.modules.test_generation.schema_analyzer import (
    SchemaNode,
    invalid_format_value,
    random_string,
    sample_value,
)
from app.modules.test_generation.service import TestGenerationService


SAMPLE_SCHEMA = {
    "type": "object",
    "required": ["email", "name", "age"],
    "properties": {
        "email": {"type": "string", "format": "email", "maxLength": 320},
        "name": {"type": "string", "minLength": 1, "maxLength": 50},
        "age": {"type": "integer", "minimum": 0, "maximum": 150},
        "role": {"type": "string", "enum": ["admin", "user", "viewer"]},
    },
}


def _ctx(method: str = "POST", path: str = "/users", **overrides) -> EndpointContext:
    return EndpointContext(
        endpoint_id="ep-1",
        method=method,
        path=path,
        summary="Create user",
        operation_id="createUser",
        parameters=overrides.get("parameters", []),
        request_schema=overrides.get("request_schema", SAMPLE_SCHEMA),
        responses=overrides.get(
            "responses",
            {
                "201": {
                    "description": "Created",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["id"],
                                "properties": {"id": {"type": "string"}},
                            }
                        }
                    },
                },
                "400": {"description": "Validation error"},
            },
        ),
        base_url="https://api.example.com",
        options=overrides.get("options", GenerateOptions(use_ai=False)),
    )


# ---- schema_analyzer ------------------------------------------------------
def test_sample_value_respects_examples_and_defaults():
    assert sample_value({"type": "string", "example": "hello"}) == "hello"
    assert sample_value({"type": "integer", "default": 7}) == 7
    assert sample_value({"type": "string", "enum": ["a", "b"]}) == "a"


def test_sample_value_object_recurses():
    val = sample_value(SAMPLE_SCHEMA)
    assert isinstance(val, dict)
    assert val["email"] == "user@example.com"
    assert val["age"] == 0
    assert val["role"] == "admin"


def test_schema_node_handles_oas31_nullable_array_types():
    node = SchemaNode({"type": ["string", "null"], "format": "email"})
    assert node.type == "string"
    assert node.nullable is True
    assert node.format == "email"


def test_random_string_bounded():
    assert random_string(0) == ""
    assert len(random_string(50)) == 50
    assert len(random_string(20_000)) == 10_000  # guardrail


def test_invalid_format_value_known_formats():
    assert "@" not in invalid_format_value("email")
    assert invalid_format_value("uuid") == "not-a-uuid"


# ---- positive -------------------------------------------------------------
def test_positive_generator_emits_happy_path():
    cases = PositiveGenerator().generate(_ctx())
    assert cases, "expected at least one positive case"
    happy = cases[0]
    assert happy.expected_status == 201
    assert happy.body and happy.body["email"] == "user@example.com"
    assert happy.url == "https://api.example.com/users"
    assert "happy-path" in happy.tags


def test_positive_generator_skips_full_payload_when_no_optionals():
    schema = {
        "type": "object",
        "required": ["name"],
        "properties": {"name": {"type": "string"}},
    }
    cases = PositiveGenerator().generate(_ctx(request_schema=schema))
    # required-only and full payload are identical -> only one happy case.
    assert len(cases) == 1


# ---- negative -------------------------------------------------------------
def test_negative_generator_covers_required_and_format_and_type_errors():
    cases = NegativeGenerator().generate(_ctx())
    tags = [t for c in cases for t in c.tags]
    assert "missing-required" in tags
    assert "wrong-type" in tags
    assert "format" in tags
    assert "enum" in tags
    assert any(c.expected_status == 400 for c in cases)


def test_negative_generator_emits_unauthorized_when_security_required():
    ctx = _ctx()
    ctx.security = [{"bearerAuth": []}]
    cases = NegativeGenerator().generate(ctx)
    auth_cases = [c for c in cases if "auth" in c.tags]
    assert any(c.expected_status == 401 for c in auth_cases)


def test_negative_generator_emits_invalid_path_param():
    parameters = [
        {"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}
    ]
    ctx = _ctx(method="GET", path="/users/{id}", parameters=parameters)
    cases = NegativeGenerator().generate(ctx)
    assert any("__invalid__" in str(c.url) for c in cases), cases


# ---- boundary -------------------------------------------------------------
def test_boundary_generator_emits_min_and_just_below():
    cases = BoundaryGenerator().generate(_ctx())
    labels = [t for c in cases for t in c.tags]
    assert "min value" in labels
    assert "just below min" in labels
    assert "just above max" in labels


# ---- edge cases ------------------------------------------------------------
def test_edge_case_suggestions_uses_field_hints_and_enums():
    suggestions = EdgeCaseGenerator().suggestions(_ctx())
    by_field = {s.field: s for s in suggestions}
    assert "email" in by_field
    assert "missing @" in by_field["email"].suggestions
    assert "role" in by_field  # enum
    assert "unknown value '__invalid__'" in by_field["role"].suggestions


# ---- assertion generator --------------------------------------------------
def test_assertion_generator_attaches_status_and_schema_assertions():
    ctx = _ctx()
    case = PositiveGenerator().generate(ctx)[0]
    AssertionGenerator().attach(ctx, case)
    types = [a.type for a in case.assertions]
    assert "status_code" in types
    assert "response_time_ms" in types
    assert "json_schema" in types  # 201 has a documented schema in fixture
    assert "contains_key" in types  # 'id' is required


# ---- service end-to-end (heuristic, no DB) --------------------------------
def test_service_generate_for_raw_produces_complete_suite():
    options = GenerateOptions(use_ai=False, include_security=True)
    suite = asyncio.run(
        TestGenerationService().generate_for_raw(
            method="POST",
            path="/users",
            summary="Create user",
            request_schema=SAMPLE_SCHEMA,
            responses={"201": {"description": "Created"}},
            options=options,
        )
    )
    assert suite.counts["positive"] >= 1
    assert suite.counts["negative"] >= 3
    assert suite.counts["boundary"] >= 1
    assert suite.counts["edge_case"] >= 1
    assert suite.counts["security"] >= 1
    assert suite.counts["total"] == sum(
        v for k, v in suite.counts.items() if k != "total"
    )
    # Every case must have at least one assertion
    for case in suite.all_cases():
        assert case.assertions


def test_service_caches_repeated_calls_for_same_endpoint(monkeypatch):
    """Two identical generate_for_raw calls run independently (no DB cache),
    but identical generated cases imply deterministic output for reproducibility."""
    options = GenerateOptions(use_ai=False)
    svc = TestGenerationService()
    a = asyncio.run(
        svc.generate_for_raw(
            method="GET",
            path="/items",
            request_schema=None,
            options=options,
        )
    )
    b = asyncio.run(
        svc.generate_for_raw(
            method="GET",
            path="/items",
            request_schema=None,
            options=options,
        )
    )
    assert a.counts == b.counts


# ---- failure analyzer ------------------------------------------------------
def test_failure_analyzer_explains_500_with_validation_hint():
    inp = FailureInput(
        endpoint_method="POST",
        endpoint_path="/users",
        test_name="Missing Email",
        expected_status=400,
        actual_status=500,
        request_body={"name": "John"},
        response_body="Internal Server Error",
    )
    out = asyncio.run(explain_failure(inp))
    assert out.severity == "critical"
    assert any("validation" in c.lower() or "null" in c.lower() for c in out.possible_causes)
    assert out.technical["expected_status"] == 400
    assert out.technical["actual_status"] == 500


def test_failure_analyzer_explains_401():
    inp = FailureInput(
        endpoint_method="GET",
        endpoint_path="/me",
        test_name="Missing token",
        expected_status=200,
        actual_status=401,
    )
    out = asyncio.run(explain_failure(inp))
    assert out.severity == "high"
    assert "Authentication" in out.summary or "authenticat" in out.summary.lower()
