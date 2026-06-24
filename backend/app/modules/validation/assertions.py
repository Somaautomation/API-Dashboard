"""Reusable assertion library + JSON-schema validation primitives."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from jsonschema import Draft202012Validator


@dataclass
class AssertionResult:
    type: str
    passed: bool
    message: str
    details: dict[str, Any]


def assert_status_code(response: httpx.Response, expected: int) -> AssertionResult:
    ok = response.status_code == expected
    return AssertionResult(
        type="status_code",
        passed=ok,
        message=f"Expected {expected}, got {response.status_code}",
        details={"expected": expected, "actual": response.status_code},
    )


def assert_header(response: httpx.Response, name: str, contains: str | None = None) -> AssertionResult:
    actual = response.headers.get(name)
    if actual is None:
        return AssertionResult("header", False, f"Header {name} missing", {"name": name})
    if contains and contains not in actual:
        return AssertionResult("header", False, f"Header {name}='{actual}' does not contain '{contains}'",
                               {"name": name, "actual": actual, "contains": contains})
    return AssertionResult("header", True, f"Header {name} present", {"name": name, "actual": actual})


def assert_json_schema(response: httpx.Response, schema: dict) -> AssertionResult:
    try:
        body = response.json()
    except Exception as exc:
        return AssertionResult("json_schema", False, f"Response is not JSON: {exc}", {})
    errors = sorted(Draft202012Validator(schema).iter_errors(body), key=lambda e: e.path)
    if not errors:
        return AssertionResult("json_schema", True, "Schema OK", {})
    return AssertionResult(
        "json_schema",
        False,
        f"{len(errors)} schema violation(s)",
        {"violations": [{"path": list(e.path), "msg": e.message} for e in errors[:25]]},
    )


def assert_contains_key(response: httpx.Response, json_path: list[str]) -> AssertionResult:
    try:
        cur: Any = response.json()
        for p in json_path:
            cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    except Exception as exc:
        return AssertionResult("contains_key", False, f"Path {json_path} not found: {exc}",
                               {"path": json_path})
    return AssertionResult("contains_key", True, "Path present", {"path": json_path, "value": cur})


def assert_status_code_in(response: httpx.Response, expected_in: list[int]) -> AssertionResult:
    expected = [int(x) for x in expected_in or []]
    ok = response.status_code in expected
    return AssertionResult(
        type="status_code_in",
        passed=ok,
        message=f"Expected one of {expected}, got {response.status_code}",
        details={"expected_in": expected, "actual": response.status_code},
    )


def assert_response_time_ms(
    response: httpx.Response, threshold_ms: int, elapsed_ms: int | None = None
) -> AssertionResult:
    # ``elapsed_ms`` should come from the caller (httpx.Response.elapsed exists
    # but is not always set when responses are constructed manually).
    actual = elapsed_ms
    if actual is None:
        try:
            actual = int(response.elapsed.total_seconds() * 1000)
        except Exception:  # noqa: BLE001
            actual = 0
    ok = actual <= int(threshold_ms)
    return AssertionResult(
        type="response_time_ms",
        passed=ok,
        message=f"Expected <= {threshold_ms} ms, took {actual} ms",
        details={"threshold_ms": int(threshold_ms), "actual_ms": actual},
    )


DISPATCH = {
    "status_code": lambda r, a: assert_status_code(r, int(a["expected"])),
    "status_code_in": lambda r, a: assert_status_code_in(r, a.get("expected_in") or []),
    "header": lambda r, a: assert_header(r, a["name"], a.get("contains")),
    "json_schema": lambda r, a: assert_json_schema(r, a.get("schema") or a.get("response_schema")),
    "contains_key": lambda r, a: assert_contains_key(r, a["path"]),
    "response_time_ms": lambda r, a: assert_response_time_ms(
        r, int(a.get("threshold_ms") or 0), a.get("_elapsed_ms")
    ),
}


def run_assertion(response: httpx.Response, assertion: dict) -> AssertionResult:
    fn = DISPATCH.get(assertion.get("type"))
    if not fn:
        return AssertionResult(
            type=assertion.get("type", "unknown"),
            passed=False,
            message=f"Unknown assertion type: {assertion.get('type')}",
            details={},
        )
    try:
        return fn(response, assertion)
    except Exception as exc:  # pragma: no cover
        return AssertionResult(assertion.get("type", "unknown"), False, f"Assertion error: {exc}", {})
