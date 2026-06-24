"""Async job manager for long-running spec-wide generation."""
from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import datetime
from typing import Any, Awaitable, Callable

from app.modules.test_generation.dtos import JobOut, TestSuite

JobRunner = Callable[["Job"], Awaitable[None]]


class Job:
    def __init__(self, job_id: str, total: int):
        self.id = job_id
        self.status: str = "queued"
        self.total = total
        self.completed = 0
        self.failed = 0
        self.suites: list[TestSuite] = []
        self.error: str | None = None
        self.started_at: datetime | None = None
        self.finished_at: datetime | None = None
        self.cancelled = False
        self._task: asyncio.Task | None = None

    @property
    def progress(self) -> int:
        if not self.total:
            return 100 if self.status == "completed" else 0
        return min(100, int((self.completed + self.failed) / self.total * 100))

    def to_dto(self, *, include_suites: bool = True) -> JobOut:
        return JobOut(
            job_id=self.id,
            status=self.status,  # type: ignore[arg-type]
            total=self.total,
            completed=self.completed,
            failed=self.failed,
            progress=self.progress,
            suites=self.suites if include_suites else [],
            error=self.error,
            started_at=self.started_at,
            finished_at=self.finished_at,
        )


class JobManager:
    """Thread-safe in-memory registry of background generation jobs."""

    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.RLock()

    def create(self, total: int) -> Job:
        job_id = str(uuid.uuid4())
        job = Job(job_id, total)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        with self._lock:
            return list(self._jobs.values())

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.status not in {"queued", "running"}:
                return False
            job.cancelled = True
            if job._task and not job._task.done():
                job._task.cancel()
            job.status = "cancelled"
            job.finished_at = datetime.utcnow()
            return True

    def launch(self, job: Job, runner: JobRunner) -> None:
        async def _wrap() -> None:
            job.status = "running"
            job.started_at = datetime.utcnow()
            try:
                await runner(job)
                if job.status == "running":
                    job.status = "completed"
            except asyncio.CancelledError:
                job.status = "cancelled"
                raise
            except Exception as exc:  # noqa: BLE001
                job.status = "failed"
                job.error = f"{type(exc).__name__}: {exc}"
            finally:
                job.finished_at = datetime.utcnow()

        loop = asyncio.get_event_loop()
        job._task = loop.create_task(_wrap())


job_manager = JobManager()
