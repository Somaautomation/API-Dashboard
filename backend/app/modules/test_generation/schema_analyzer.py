"""Light-weight JSON-Schema introspection used by the generators.

We deliberately avoid a heavy dependency on ``jsonschema`` here — we only
need to know *constraints* and produce *sample values* that respect or
violate them. Recursion is bounded for safety against pathological specs.
"""
from __future__ import annotations

import random
import re
import string
import uuid as _uuid
from datetime import date, datetime, timezone
from typing import Any

MAX_DEPTH = 6
_SAMPLE_RNG = random.Random(0)  # deterministic samples for reproducibility


class SchemaNode:
    """Wrapper around a JSON Schema dict exposing constraints."""

    __slots__ = (
        "schema",
        "type",
        "format",
        "enum",
        "required",
        "properties",
        "items",
        "min_length",
        "max_length",
        "minimum",
        "maximum",
        "exclusive_minimum",
        "exclusive_maximum",
        "pattern",
        "example",
        "default",
        "nullable",
        "all_of",
        "any_of",
        "one_of",
        "title",
    )

    def __init__(self, schema: dict[str, Any] | None):
        s = schema or {}
        self.schema = s
        t = s.get("type")
        # OAS 3.1 allows ["string","null"] — normalise to the non-null first one.
        if isinstance(t, list):
            self.nullable = "null" in t
            non_null = [x for x in t if x != "null"]
            self.type = non_null[0] if non_null else None
        else:
            self.type = t
            self.nullable = bool(s.get("nullable"))
        self.format = s.get("format")
        self.enum = s.get("enum")
        self.required = list(s.get("required") or [])
        self.properties = s.get("properties") or {}
        self.items = s.get("items")
        self.min_length = s.get("minLength")
        self.max_length = s.get("maxLength")
        self.minimum = s.get("minimum")
        self.maximum = s.get("maximum")
        self.exclusive_minimum = s.get("exclusiveMinimum")
        self.exclusive_maximum = s.get("exclusiveMaximum")
        self.pattern = s.get("pattern")
        self.example = s.get("example")
        self.default = s.get("default")
        self.all_of = s.get("allOf")
        self.any_of = s.get("anyOf")
        self.one_of = s.get("oneOf")
        self.title = s.get("title")

    # Inference helpers --------------------------------------------------
    def inferred_type(self) -> str:
        if self.type:
            return self.type
        if self.properties:
            return "object"
        if self.enum and self.enum:
            sample = self.enum[0]
            if isinstance(sample, bool):
                return "boolean"
            if isinstance(sample, int):
                return "integer"
            if isinstance(sample, float):
                return "number"
            return "string"
        return "string"


# ---- sample value generators -----------------------------------------------
_FAKE_STRINGS = {
    "email": "user@example.com",
    "uri": "https://example.com/resource",
    "url": "https://example.com/resource",
    "uuid": "00000000-0000-0000-0000-000000000001",
    "ipv4": "192.0.2.1",
    "ipv6": "2001:db8::1",
    "hostname": "example.com",
    "date": "2024-01-01",
    "date-time": "2024-01-01T00:00:00Z",
    "time": "12:00:00",
    "password": "P@ssw0rd-Sample-1",
    "byte": "U0FNUExF",
    "binary": "U0FNUExF",
    "phone": "+1-555-0100",
}


def sample_value(schema: dict[str, Any] | None, depth: int = 0) -> Any:
    """Best-effort *valid* sample value for a schema. Respects examples/defaults/enums."""
    if depth > MAX_DEPTH:
        return None
    node = SchemaNode(schema)
    if node.example is not None:
        return node.example
    if node.default is not None:
        return node.default
    if node.enum:
        return node.enum[0]
    if node.all_of:
        merged: dict[str, Any] = {}
        for sub in node.all_of:
            v = sample_value(sub, depth + 1)
            if isinstance(v, dict):
                merged.update(v)
        if merged:
            return merged
    if node.any_of:
        return sample_value(node.any_of[0], depth + 1)
    if node.one_of:
        return sample_value(node.one_of[0], depth + 1)

    t = node.inferred_type()
    if t == "object":
        out: dict[str, Any] = {}
        for name, sub in node.properties.items():
            out[name] = sample_value(sub, depth + 1)
        return out
    if t == "array":
        return [sample_value(node.items or {}, depth + 1)]
    if t == "boolean":
        return True
    if t == "integer":
        lo = int(node.minimum) if isinstance(node.minimum, (int, float)) else 1
        hi = int(node.maximum) if isinstance(node.maximum, (int, float)) else max(lo + 1, lo + 10)
        return lo
    if t == "number":
        lo = float(node.minimum) if isinstance(node.minimum, (int, float)) else 1.5
        return lo
    # string fall-through
    if node.format and node.format in _FAKE_STRINGS:
        return _FAKE_STRINGS[node.format]
    if node.pattern:
        return _sample_from_pattern(node.pattern)
    base = (node.title or "sample").lower().replace(" ", "-")
    s = base + "-value"
    if node.min_length:
        s = s.ljust(int(node.min_length), "x")
    if node.max_length and len(s) > int(node.max_length):
        s = s[: int(node.max_length)]
    return s


def _sample_from_pattern(pattern: str) -> str:
    """Naive regex-aware sample. Falls back to a generic ascii string."""
    try:
        # exrex would be ideal — we keep a tiny heuristic for common shapes.
        if re.fullmatch(r"\^?\[a-zA-Z0-9_\-]\+\$?", pattern):
            return "sample-123"
        if re.fullmatch(r"\^?\\d\+\$?", pattern):
            return "12345"
    except Exception:
        pass
    return "sample-value"


def random_string(length: int) -> str:
    if length <= 0:
        return ""
    if length > 10_000:
        length = 10_000  # guardrail
    return "".join(_SAMPLE_RNG.choices(string.ascii_letters + string.digits, k=length))


# ---- mutation helpers (used by negative/boundary generators) --------------
def remove_field(payload: dict, field: str) -> dict:
    if not isinstance(payload, dict):
        return payload
    new = dict(payload)
    new.pop(field, None)
    return new


def set_field(payload: Any, field: str, value: Any) -> Any:
    if not isinstance(payload, dict):
        return {field: value}
    new = dict(payload)
    new[field] = value
    return new


def invalid_format_value(fmt: str) -> Any:
    return {
        "email": "not-an-email",
        "uuid": "not-a-uuid",
        "uri": "not a uri",
        "url": "not a url",
        "ipv4": "999.999.999.999",
        "ipv6": "zzzz::1",
        "hostname": "@@invalid_hostname@@",
        "date": "31-13-2024",
        "date-time": "2024-13-99T99:99:99",
        "time": "25:99:99",
        "phone": "abc",
        "byte": "@@@notbase64@@@",
    }.get(fmt, "INVALID")


def wrong_type_value(type_: str) -> Any:
    return {
        "string": 12345,
        "integer": "not-an-int",
        "number": "not-a-number",
        "boolean": "yes",
        "array": {"oops": "should be array"},
        "object": "should-be-object",
    }.get(type_, None)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_uuid() -> str:
    return str(_uuid.uuid4())
