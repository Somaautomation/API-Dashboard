"""Process-local TTL caches for parsed specs and generated suites.

These are deliberately in-memory: the persistent store of record remains
PostgreSQL (uploaded specs + saved collections). The cache only avoids
recomputing test cases for the *same* endpoint with the *same* options
during the lifetime of the API process — invaluable for large specs
(>1000 endpoints) where users iterate on options.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, *, max_items: int = 2048, ttl_seconds: int = 3600):
        self._data: dict[str, tuple[float, T]] = {}
        self._max = max_items
        self._ttl = ttl_seconds
        self._lock = threading.RLock()

    def _evict(self) -> None:
        if len(self._data) <= self._max:
            return
        # Drop oldest 10%.
        ordered = sorted(self._data.items(), key=lambda kv: kv[1][0])
        for key, _ in ordered[: max(1, len(ordered) // 10)]:
            self._data.pop(key, None)

    def get(self, key: str) -> T | None:
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                return None
            stored_at, value = entry
            if time.time() - stored_at > self._ttl:
                self._data.pop(key, None)
                return None
            return value

    def set(self, key: str, value: T) -> None:
        with self._lock:
            self._data[key] = (time.time(), value)
            self._evict()

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {"items": len(self._data), "max_items": self._max, "ttl_seconds": self._ttl}


def cache_key(parts: dict[str, Any]) -> str:
    blob = json.dumps(parts, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()
