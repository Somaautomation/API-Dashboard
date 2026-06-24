"""Tests for the reusable assertion library."""
from __future__ import annotations

import httpx
import pytest

from app.modules.validation.assertions import (
    assert_contains_key,
    assert_header,
    assert_json_schema,
    assert_status_code,
)


def _resp(status: int = 200, body=None, headers=None) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=body if body is not None else {},
        headers=headers or {"content-type": "application/json"},
    )


def test_status_code():
    assert assert_status_code(_resp(200), 200).passed
    assert not assert_status_code(_resp(500), 200).passed


def test_header():
    r = _resp(headers={"x-foo": "bar"})
    assert assert_header(r, "x-foo").passed
    assert assert_header(r, "x-foo", contains="bar").passed
    assert not assert_header(r, "x-missing").passed


def test_json_schema():
    schema = {"type": "object", "required": ["id"], "properties": {"id": {"type": "integer"}}}
    assert assert_json_schema(_resp(body={"id": 1}), schema).passed
    assert not assert_json_schema(_resp(body={"id": "x"}), schema).passed


def test_contains_key():
    r = _resp(body={"data": [{"x": 1}]})
    assert assert_contains_key(r, ["data", "0", "x"]).passed
    assert not assert_contains_key(r, ["missing"]).passed
