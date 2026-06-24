"""Centralized application configuration (pydantic-settings)."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # App
    app_name: str = "ZPE API Testing Platform"
    app_env: str = "development"
    app_debug: bool = True
    app_secret_key: str = Field(min_length=16)
    app_encryption_key: str = Field(default="")  # Fernet key (base64, 32 bytes)

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: str | List[str] = "http://localhost:5173"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60
    jwt_refresh_ttl_days: int = 14

    # DB / Redis
    database_url: str
    database_sync_url: str
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # Bootstrap
    bootstrap_admin_email: str = "admin@zpesystems.com"
    bootstrap_admin_password: str = "ChangeMe!123"

    # AI
    ai_provider: str = "disabled"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    @field_validator("api_cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
