"""Exporters that convert a Collection into Postman / cURL / Robot / Playwright / k6 artifacts."""
from __future__ import annotations

import json
from typing import Iterable

from app.modules.collections.models import Collection, CollectionItem


# ---------- Postman v2.1 ----------
def to_postman(collection: Collection) -> dict:
    return {
        "info": {
            "name": collection.name,
            "description": collection.description,
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": [
            {
                "name": i.name,
                "request": {
                    "method": i.method,
                    "header": [{"key": k, "value": v} for k, v in (i.headers or {}).items()],
                    "url": {
                        "raw": i.url,
                        "query": [{"key": k, "value": str(v)} for k, v in (i.query or {}).items()],
                    },
                    "body": (
                        {"mode": "raw", "raw": json.dumps(i.body, indent=2)} if i.body is not None else None
                    ),
                },
            }
            for i in collection.items
        ],
    }


# ---------- cURL ----------
def to_curl(items: Iterable[CollectionItem]) -> str:
    lines: list[str] = []
    for i in items:
        parts = ["curl", "-X", i.method, f"'{i.url}'"]
        for k, v in (i.headers or {}).items():
            parts += ["-H", f"'{k}: {v}'"]
        if i.body is not None:
            parts += ["--data", f"'{json.dumps(i.body)}'"]
        lines.append(" ".join(parts))
    return "\n\n".join(lines)


# ---------- Robot Framework ----------
def to_robot(collection: Collection) -> str:
    out = [
        "*** Settings ***",
        "Library    RequestsLibrary",
        "Library    Collections",
        "",
        "*** Variables ***",
        "${BASE_URL}    https://api.example.com",
        "",
        "*** Test Cases ***",
    ]
    for i in collection.items:
        out += [
            i.name.replace(" ", "_"),
            f"    Create Session    api    ${{BASE_URL}}",
            f"    ${{resp}}=    {i.method.upper()} On Session    api    {i.url}",
            "    Status Should Be    200    ${resp}",
            "",
        ]
    return "\n".join(out)


# ---------- Playwright (TypeScript) ----------
def to_playwright(collection: Collection) -> str:
    out = ["import { test, expect, request } from '@playwright/test';", "", f"// {collection.name}", ""]
    for i in collection.items:
        out.append(f"test('{i.name}', async ({{ request }}) => {{")
        body = f", data: {json.dumps(i.body)}" if i.body is not None else ""
        headers = f", headers: {json.dumps(i.headers or {})}" if i.headers else ""
        out.append(f"  const res = await request.{i.method.lower()}('{i.url}', {{ }}{headers}{body});")
        out.append("  expect(res.ok()).toBeTruthy();")
        out.append("});\n")
    return "\n".join(out)


# ---------- k6 ----------
def to_k6(collection: Collection) -> str:
    out = [
        "import http from 'k6/http';",
        "import { check, sleep } from 'k6';",
        "",
        "export const options = {",
        "  stages: [",
        "    { duration: '30s', target: 20 },",
        "    { duration: '1m',  target: 50 },",
        "    { duration: '30s', target: 0  },",
        "  ],",
        "  thresholds: {",
        "    http_req_failed: ['rate<0.01'],",
        "    http_req_duration: ['p(95)<500'],",
        "  },",
        "};",
        "",
        "export default function () {",
    ]
    for i in collection.items:
        body = json.dumps(json.dumps(i.body)) if i.body is not None else "null"
        headers = json.dumps(i.headers or {})
        out.append(
            f"  {{ const r = http.request('{i.method}', '{i.url}', {body}, {{ headers: {headers} }});"
            f" check(r, {{ '{i.name}: 2xx': (x) => x.status >= 200 && x.status < 300 }}); }}"
        )
    out += ["  sleep(1);", "}"]
    return "\n".join(out)


EXPORTERS = {
    "postman": ("application/json", lambda c: json.dumps(to_postman(c), indent=2)),
    "curl": ("text/plain", lambda c: to_curl(c.items)),
    "robot": ("text/plain", to_robot),
    "playwright": ("text/typescript", to_playwright),
    "k6": ("application/javascript", to_k6),
}
