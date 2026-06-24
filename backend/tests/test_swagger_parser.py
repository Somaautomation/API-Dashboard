"""Tests for the Swagger/OpenAPI parser."""
from __future__ import annotations

import json

import pytest

from app.modules.swagger.parser import parse_and_validate

MINIMAL_OPENAPI = {
    "openapi": "3.0.0",
    "info": {"title": "Pets", "version": "1.0.0"},
    "paths": {
        "/pets": {
            "get": {
                "operationId": "listPets",
                "summary": "List pets",
                "tags": ["pets"],
                "responses": {"200": {"description": "OK"}},
            },
            "post": {
                "operationId": "createPet",
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {"type": "object", "properties": {"name": {"type": "string"}}}
                        }
                    }
                },
                "responses": {"201": {"description": "Created"}},
            },
        }
    },
}


def test_parse_extracts_endpoints():
    parsed = parse_and_validate(json.dumps(MINIMAL_OPENAPI).encode(), "spec.json")
    assert parsed.title == "Pets"
    assert {(e.method, e.path) for e in parsed.endpoints} == {("GET", "/pets"), ("POST", "/pets")}
    post = next(e for e in parsed.endpoints if e.method == "POST")
    assert post.request_schema and post.request_schema["properties"]["name"]["type"] == "string"


def test_parse_rejects_invalid_spec():
    from app.core.errors import ValidationError

    with pytest.raises(ValidationError):
        parse_and_validate(b"{not even json", "spec.json")
