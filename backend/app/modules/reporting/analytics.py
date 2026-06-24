"""Analytics aggregations for the dashboard (KPIs, trends, failures, env health)."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.collections.models import Collection, CollectionItem
from app.modules.environments.models import Environment
from app.modules.validation.models import RunStatus, TestAssertion, TestRun

# Map raw assertion_type / message keywords -> human-readable failure category
_FAILURE_CATEGORIES = [
    ("Authentication Failures", ("401", "403", "unauthor", "forbidden", "token", "auth")),
    ("Timeout Failures",        ("timeout", "timed out", "deadline")),
    ("Network Errors",          ("request_error", "connection", "dns", "network", "ssl", "tls")),
    ("Server Errors",           ("500", "502", "503", "504", "server error")),
    ("Schema Validation Failures", ("schema", "json_schema", "validation")),
    ("Assertion Failures",      ("status_code", "assert", "expected", "header", "contains_key")),
]


def _categorize_failure(assertion_type: str, message: str) -> str:
    blob = f"{assertion_type or ''} {message or ''}".lower()
    for label, keywords in _FAILURE_CATEGORIES:
        if any(k in blob for k in keywords):
            return label
    return "Other"


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------ KPIs / Executions
    async def executions(self) -> dict[str, Any]:
        """Top KPIs + bar chart of Passed / Failed / Skipped totals."""
        totals = (
            await self.db.execute(
                select(
                    func.coalesce(func.sum(TestRun.total), 0),
                    func.coalesce(func.sum(TestRun.passed), 0),
                    func.coalesce(func.sum(TestRun.failed), 0),
                    func.coalesce(func.avg(TestRun.duration_ms), 0),
                    func.count(TestRun.id),
                )
            )
        ).one()
        total_assertions, passed, failed, avg_ms, run_count = totals
        skipped = max(int(total_assertions) - int(passed) - int(failed), 0)

        api_count = (
            await self.db.execute(select(func.count(CollectionItem.id)))
        ).scalar_one()

        pass_rate = (passed / total_assertions * 100) if total_assertions else 0.0
        fail_rate = (failed / total_assertions * 100) if total_assertions else 0.0

        return {
            "kpis": {
                "total_apis": int(api_count),
                "total_executions": int(run_count),
                "total_assertions": int(total_assertions),
                "pass_rate": round(pass_rate, 2),
                "fail_rate": round(fail_rate, 2),
                "avg_response_ms": int(avg_ms or 0),
            },
            "bars": [
                {"name": "Passed",  "count": int(passed)},
                {"name": "Failed",  "count": int(failed)},
                {"name": "Skipped", "count": int(skipped)},
            ],
        }

    # ------------------------------------------------------------------ Failure pie
    async def failures(self) -> dict[str, Any]:
        rows = (
            await self.db.execute(
                select(TestAssertion.assertion_type, TestAssertion.message)
                .where(TestAssertion.passed.is_(False))
            )
        ).all()
        buckets: dict[str, int] = defaultdict(int)
        for assertion_type, message in rows:
            buckets[_categorize_failure(assertion_type, message)] += 1

        # Guarantee the standard set of categories appears (even if zero)
        for label, _ in _FAILURE_CATEGORIES:
            buckets.setdefault(label, 0)

        total = sum(buckets.values()) or 1
        slices = [
            {"name": label, "value": count, "percent": round(count * 100 / total, 1)}
            for label, count in sorted(buckets.items(), key=lambda kv: -kv[1])
        ]
        return {"total": sum(buckets.values()), "slices": slices}

    # ------------------------------------------------------------------ Daily trend
    async def trends(self, days: int = 14) -> dict[str, Any]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        day = func.date_trunc("day", TestRun.created_at).label("day")
        rows = (
            await self.db.execute(
                select(
                    day,
                    func.count(TestRun.id).label("runs"),
                    func.coalesce(func.sum(TestRun.passed), 0).label("passed"),
                    func.coalesce(func.sum(TestRun.failed), 0).label("failed"),
                    func.coalesce(func.avg(TestRun.duration_ms), 0).label("avg_ms"),
                )
                .where(TestRun.created_at >= since)
                .group_by(day)
                .order_by(day)
            )
        ).all()
        series = [
            {
                "date": r.day.strftime("%Y-%m-%d") if r.day else "",
                "runs": int(r.runs),
                "passed": int(r.passed),
                "failed": int(r.failed),
                "avg_ms": int(r.avg_ms or 0),
            }
            for r in rows
        ]
        return {"days": days, "series": series}

    # ------------------------------------------------------------------ Environments
    async def environments(self) -> dict[str, Any]:
        rows = (
            await self.db.execute(
                select(
                    Environment.name,
                    Environment.kind,
                    func.coalesce(func.sum(TestRun.passed), 0),
                    func.coalesce(func.sum(TestRun.failed), 0),
                    func.coalesce(func.avg(TestRun.duration_ms), 0),
                    func.count(TestRun.id),
                )
                .join(TestRun, TestRun.environment_id == Environment.id, isouter=True)
                .group_by(Environment.id, Environment.name, Environment.kind)
                .order_by(Environment.kind)
            )
        ).all()

        envs = []
        for name, kind, passed, failed, avg_ms, runs in rows:
            total = int(passed) + int(failed)
            envs.append({
                "name": name,
                "kind": kind.value if hasattr(kind, "value") else str(kind),
                "runs": int(runs),
                "passed": int(passed),
                "failed": int(failed),
                "success_pct": round(passed * 100 / total, 1) if total else 0.0,
                "failure_pct": round(failed * 100 / total, 1) if total else 0.0,
                "avg_response_ms": int(avg_ms or 0),
            })
        return {"environments": envs}

    # ------------------------------------------------------------------ Top failing APIs
    async def top_failing(self, limit: int = 10) -> dict[str, Any]:
        rows = (
            await self.db.execute(
                select(
                    TestAssertion.item_name,
                    func.count(TestAssertion.id).label("failures"),
                    func.max(TestRun.created_at).label("last_failed"),
                    func.coalesce(func.avg(TestRun.duration_ms), 0).label("avg_ms"),
                )
                .join(TestRun, TestRun.id == TestAssertion.run_id)
                .where(TestAssertion.passed.is_(False))
                .group_by(TestAssertion.item_name)
                .order_by(func.count(TestAssertion.id).desc())
                .limit(limit)
            )
        ).all()
        return {
            "items": [
                {
                    "endpoint": r.item_name or "(unknown)",
                    "failure_count": int(r.failures),
                    "last_failed": r.last_failed.isoformat() if r.last_failed else None,
                    "avg_response_ms": int(r.avg_ms or 0),
                }
                for r in rows
            ]
        }

    # ------------------------------------------------------------------ Load-test mock
    async def loadtest(self) -> dict[str, Any]:
        """Mock load-test series since the loadtest module doesn't persist series yet."""
        # Synthetic but realistic-looking ramp; replace with real data when available.
        series = []
        for i in range(0, 60, 5):
            vus = min(500, 50 + i * 8)
            rps = vus * 4
            err = round(min(8.0, 0.5 + i * 0.1), 2)
            latency = 80 + i * 3 + (i % 10) * 5
            series.append({"t": i, "vus": vus, "rps": rps, "error_rate": err, "avg_latency_ms": latency})
        return {"series": series}
