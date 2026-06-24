"""Pytest fixtures."""
from __future__ import annotations

import os

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-test-secret-key-")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://zpe:zpe@localhost:5432/zpe_api_platform")
os.environ.setdefault("DATABASE_SYNC_URL", "postgresql+psycopg://zpe:zpe@localhost:5432/zpe_api_platform")
