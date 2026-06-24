"""Aggregate v1 API router."""
from fastapi import APIRouter

from app.api.v1 import (
    ai,
    analytics,
    auth,
    collections,
    environments,
    health,
    loadtest,
    mocks,
    reports,
    runs,
    swagger,
    test_generation,
    users,
    vault,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(environments.router, prefix="/environments", tags=["environments"])
api_router.include_router(swagger.router, prefix="/swagger", tags=["swagger"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
api_router.include_router(vault.router, prefix="/vault", tags=["vault"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(mocks.router, prefix="/mocks", tags=["mocks"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(
    test_generation.router, prefix="/test-generation", tags=["test-generation"]
)
api_router.include_router(loadtest.router, prefix="/loadtest", tags=["loadtest"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
