"""Celery app + sample tasks for async load tests / scheduled reports."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "zpe_api_platform",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.task_default_queue = "default"
celery_app.conf.timezone = "UTC"


@celery_app.task(name="zpe.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="zpe.scheduled_report")
def scheduled_report(recipient: str) -> dict:
    # Placeholder for a real scheduled report dispatch (email / Slack / Teams).
    return {"recipient": recipient, "status": "queued"}
