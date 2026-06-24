"""Middleware for request IDs, structured logging, and error mapping."""
from __future__ import annotations

import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.errors import AppError
from app.core.logging import get_logger

log = get_logger("http")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except AppError as exc:
            response = JSONResponse(
                status_code=exc.status_code,
                content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
            )
        except Exception as exc:  # pragma: no cover
            log.exception("unhandled_error", path=request.url.path)
            response = JSONResponse(
                status_code=500,
                content={"error": {"code": "internal_error", "message": str(exc)}},
            )
        duration_ms = int((time.perf_counter() - start) * 1000)
        response.headers["x-request-id"] = rid
        response.headers["x-response-time-ms"] = str(duration_ms)
        log.info(
            "http_request",
            request_id=rid,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response
