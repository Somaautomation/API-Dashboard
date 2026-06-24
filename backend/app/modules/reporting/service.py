"""Dashboard metrics + PDF / Excel exports of test runs."""
from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.validation.models import RunStatus, TestAssertion, TestRun


class ReportingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------- dashboard metrics ----------
    async def overview(self) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        result = await self.db.execute(
            select(
                func.count(TestRun.id),
                func.coalesce(func.sum(TestRun.passed), 0),
                func.coalesce(func.sum(TestRun.failed), 0),
                func.coalesce(func.avg(TestRun.duration_ms), 0),
            ).where(TestRun.created_at >= since)
        )
        total_runs, passed, failed, avg_ms = result.one()
        trend = await self.db.execute(
            select(
                func.date_trunc("day", TestRun.created_at).label("d"),
                func.sum(TestRun.passed),
                func.sum(TestRun.failed),
            )
            .where(TestRun.created_at >= since)
            .group_by("d")
            .order_by("d")
        )
        return {
            "window_days": 30,
            "total_runs": total_runs,
            "passed": int(passed),
            "failed": int(failed),
            "pass_rate": float(passed) / (float(passed) + float(failed)) if (passed + failed) else 0.0,
            "avg_duration_ms": float(avg_ms),
            "trend": [
                {"date": d.isoformat(), "passed": int(p or 0), "failed": int(f or 0)}
                for d, p, f in trend.all()
            ],
        }

    # ---------- exports ----------
    async def _load_run(self, run_id) -> TestRun:
        res = await self.db.execute(
            select(TestRun).where(TestRun.id == run_id).options(selectinload(TestRun.assertions))
        )
        return res.scalar_one()

    async def excel_run_report(self, run_id) -> bytes:
        run = await self._load_run(run_id)
        wb = Workbook()
        ws = wb.active
        ws.title = "Run"
        ws.append(["Run ID", str(run.id)])
        ws.append(["Status", run.status.value])
        ws.append(["Passed", run.passed])
        ws.append(["Failed", run.failed])
        ws.append(["Duration (ms)", run.duration_ms])
        ws.append([])
        ws.append(["Item", "Assertion", "Passed", "Message"])
        for a in run.assertions:
            ws.append([a.item_name, a.assertion_type, a.passed, a.message])
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    async def pdf_run_report(self, run_id) -> bytes:
        run = await self._load_run(run_id)
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, title=f"ZPE Run {run.id}")
        styles = getSampleStyleSheet()
        story = [
            Paragraph("ZPE API Testing Platform — Run Report", styles["Title"]),
            Spacer(1, 12),
            Paragraph(f"<b>Run ID:</b> {run.id}", styles["Normal"]),
            Paragraph(f"<b>Status:</b> {run.status.value}", styles["Normal"]),
            Paragraph(f"<b>Passed / Failed:</b> {run.passed} / {run.failed}", styles["Normal"]),
            Paragraph(f"<b>Duration:</b> {run.duration_ms} ms", styles["Normal"]),
            Spacer(1, 12),
        ]
        rows = [["Item", "Assertion", "Passed", "Message"]]
        rows += [[a.item_name, a.assertion_type, "✓" if a.passed else "✗", a.message[:120]]
                 for a in run.assertions]
        tbl = Table(rows, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0E3A5F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ]))
        story.append(tbl)
        doc.build(story)
        return buf.getvalue()
