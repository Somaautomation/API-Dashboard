"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.middleware import RequestContextMiddleware
from app.api.v1 import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.db.base import Base  # noqa: F401 (ensure models loaded)
from app.db.session import SessionLocal, engine
from app.modules.users.service import UserService

log = get_logger("startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging("INFO")
    # Create schema (Alembic recommended for prod — kept for first-boot dev convenience).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await UserService(db).ensure_bootstrap_admin(
            settings.bootstrap_admin_email, settings.bootstrap_admin_password
        )
    log.info("app_started", env=settings.app_env)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "ZPE Systems Pvt Ltd — internal API testing & governance platform.\n\n"
            "**Note:** this spec documents the *local platform* (all routes are under `/api/v1`).\n"
            "To test the upstream **ZPE Cloud** APIs (QA / Staging / Prod), open the dashboard at "
            "http://localhost:5173/swagger and use the Quick Login card — those endpoints live at "
            "different paths (e.g. `/user/auth`, `/account/company`)."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        servers=[
            {"url": "http://localhost:8000", "description": "Local (Docker)"},
            {"url": "http://127.0.0.1:8000", "description": "Local (loopback)"},
        ],
        swagger_ui_parameters={
            "persistAuthorization": True,
            "tryItOutEnabled": True,
            "displayRequestDuration": True,
            "filter": True,
            "docExpansion": "none",
        },
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins if isinstance(settings.api_cors_origins, list) else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)
    app.include_router(api_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

    return app


app = create_app()
