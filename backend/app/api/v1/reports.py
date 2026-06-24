import uuid

from fastapi import APIRouter
from fastapi.responses import Response

from app.api.deps import CurrentUser, DbSession
from app.modules.reporting.service import ReportingService

router = APIRouter()


@router.get("/overview")
async def overview(db: DbSession, _: CurrentUser) -> dict:
    return await ReportingService(db).overview()


@router.get("/runs/{run_id}/excel")
async def excel(run_id: uuid.UUID, db: DbSession, _: CurrentUser) -> Response:
    blob = await ReportingService(db).excel_run_report(run_id)
    return Response(
        blob,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="run-{run_id}.xlsx"'},
    )


@router.get("/runs/{run_id}/pdf")
async def pdf(run_id: uuid.UUID, db: DbSession, _: CurrentUser) -> Response:
    blob = await ReportingService(db).pdf_run_report(run_id)
    return Response(
        blob,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="run-{run_id}.pdf"'},
    )
