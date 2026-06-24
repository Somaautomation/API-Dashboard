"""Generate starter k6 and JMeter scripts from a collection / endpoint set."""
from __future__ import annotations

import json
from dataclasses import dataclass
from xml.sax.saxutils import escape
from typing import Any

from app.modules.collections.models import Collection


@dataclass
class LoadProfile:
    vus: int = 50
    ramp_up_seconds: int = 30
    duration_seconds: int = 120
    p95_threshold_ms: int = 500
    error_rate_threshold: float = 0.01


def _substitute(value: Any, variables: dict[str, str]) -> Any:
    if isinstance(value, str):
        out = value
        for k, v in variables.items():
            out = out.replace(f"{{{{{k}}}}}", str(v))
        return out
    if isinstance(value, list):
        return [_substitute(v, variables) for v in value]
    if isinstance(value, dict):
        return {k: _substitute(v, variables) for k, v in value.items()}
    return value


def k6_script(collection: Collection, profile: LoadProfile, variables: dict[str, str] | None = None) -> str:
    variables = variables or {}
    items = ",\n    ".join(
        json.dumps(
            {
                "name": i.name,
                "method": i.method,
                "url": _substitute(i.url, variables),
                "headers": _substitute(i.headers or {}, variables),
                "body": _substitute(i.body, variables),
            }
        )
        for i in collection.items
    )
    return f"""import http from 'k6/http';
import {{ check, sleep }} from 'k6';

export const options = {{
  stages: [
    {{ duration: '{profile.ramp_up_seconds}s', target: {profile.vus} }},
    {{ duration: '{profile.duration_seconds}s', target: {profile.vus} }},
    {{ duration: '30s', target: 0 }},
  ],
  thresholds: {{
    http_req_failed:   ['rate<{profile.error_rate_threshold}'],
    http_req_duration: ['p(95)<{profile.p95_threshold_ms}'],
  }},
}};

const REQUESTS = [
    {items}
];

export default function () {{
  for (const r of REQUESTS) {{
    const res = http.request(
      r.method,
      r.url,
      r.body === undefined || r.body === null ? null : JSON.stringify(r.body),
      {{ headers: r.headers || {{}} }}
    );
    check(res, {{ [`${{r.name}} 2xx`]: (x) => x.status >= 200 && x.status < 300 }});
  }}
  sleep(1);
}}
"""


def jmeter_script(collection: Collection, profile: LoadProfile) -> str:
    samplers = "".join(
        f"""
      <HTTPSamplerProxy enabled="true">
        <stringProp name="HTTPSampler.method">{escape(i.method)}</stringProp>
        <stringProp name="HTTPSampler.path">{escape(i.url)}</stringProp>
      </HTTPSamplerProxy><hashTree/>"""
        for i in collection.items
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2">
  <hashTree>
    <TestPlan testname="{escape(collection.name)}" enabled="true"/>
    <hashTree>
      <ThreadGroup testname="ZPE Load" enabled="true">
        <stringProp name="ThreadGroup.num_threads">{profile.vus}</stringProp>
        <stringProp name="ThreadGroup.ramp_time">{profile.ramp_up_seconds}</stringProp>
        <stringProp name="ThreadGroup.duration">{profile.duration_seconds}</stringProp>
      </ThreadGroup>
      <hashTree>{samplers}
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
"""
