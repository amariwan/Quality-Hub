"""Backward-compatible settings accessors."""

from __future__ import annotations

from app.config.settings import Settings, get_settings


class AppSettings(Settings):
    pass


class DbSettings(Settings):
    pass


class RedisSettings(Settings):
    pass


class CelerySettings(Settings):
    pass


def get_app_settings() -> Settings:
    return get_settings()


def get_db_settings() -> Settings:
    return get_settings()


def get_redis_settings() -> Settings:
    return get_settings()


def get_celery_settings() -> Settings:
    return get_settings()
