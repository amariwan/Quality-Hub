from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.dev"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Quality-Hub API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    DB_ENABLED: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quality_hub"
    DB_ENGINE_ECHO: bool = False
    DB_PORT: int = 5432
    DB_USERNAME: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_DATABASE: str = "quality_hub"
    DB_IP: str = "localhost"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    GITLAB_BASE_URL: str = "https://gitlab.com"
    GITLAB_API_PATH: str = "/api/v4"

    SESSION_COOKIE_NAME: str = "qh_session"
    SESSION_SECRET: str = "quality-hub-dev-session-secret"
    SESSION_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 14

    TOKEN_ENCRYPTION_KEY: str = ""

    REPORT_STORAGE_DIR: str = "./storage/reports"

    WATCH_STALE_TTL_SECONDS: int = 120
    WATCH_HEARTBEAT_INTERVAL_SECONDS: int = 15

    @field_validator("API_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    @property
    def gitlab_api_base_url(self) -> str:
        return f"{self.GITLAB_BASE_URL.rstrip('/')}{self.GITLAB_API_PATH}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
