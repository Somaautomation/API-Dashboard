"""Analytics endpoints powering the dashboard charts."""
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.modules.reporting.analytics import AnalyticsService

router = APIRouter()


@router.get("/executions")
async def executions(db: DbSession, _: CurrentUser) -> dict:
    return await AnalyticsService(db).executions()


@router.get("/failures")
async def failures(db: DbSession, _: CurrentUser) -> dict:
    return await AnalyticsService(db).failures()


@router.get("/trends")
async def trends(db: DbSession, _: CurrentUser, days: int = 14) -> dict:
    return await AnalyticsService(db).trends(days=days)


@router.get("/environments")
async def environments(db: DbSession, _: CurrentUser) -> dict:
    return await AnalyticsService(db).environments()


@router.get("/top-failing")
async def top_failing(db: DbSession, _: CurrentUser, limit: int = 10) -> dict:
    return await AnalyticsService(db).top_failing(limit=limit)


@router.get("/loadtest")
async def loadtest(db: DbSession, _: CurrentUser) -> dict:
    return await AnalyticsService(db).loadtest()
