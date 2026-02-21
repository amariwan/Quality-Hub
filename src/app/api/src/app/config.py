import sys
from enum import Enum

from pydantic_settings import BaseSettings, SettingsConfigDict


# All allowed values for ENV LOG_LEVEL
class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


# Overall Settings
class AppSettings(BaseSettings):
    LOG_LEVEL: LogLevel
    TEST_MODE: bool
    PROFILING_ENABLED: bool

    model_config = SettingsConfigDict(
        env_file=".dev.env", case_sensitive=False, extra="ignore"
    )


# DB Specific Settings
class DbSettings(BaseSettings):
    # When DB_ENABLED is False, DB fields may be omitted to run without a DB
    # Defaulting to False makes the application easier to run in environments
    # that don't provide a database (local/dev/test). Enable via env var when needed.
    DB_ENABLED: bool = False
    DB_PORT: int | None = None
    DB_USERNAME: str | None = None
    DB_PASSWORD: str | None = None
    DB_DATABASE: str | None = None
    DB_IP: str = "localhost"
    DB_ENGINE_ECHO: bool = False  # sets echo=False

    model_config = SettingsConfigDict(
        env_file=".dev.env", case_sensitive=False, extra="ignore"
    )


# Lazy-initialized singletons for application and DB settings
# Singletons (initialized on first access)
_app_instance: AppSettings | None = None
_db_instance: DbSettings | None = None


def get_db_settings() -> DbSettings:
    """
    Return a singleton instance of DbSettings.
    Initializes on first access. Exits if environment variables are invalid unless DB_ENABLED is False.
    """
    global _db_instance
    if _db_instance is None:
        try:
            _db_instance = DbSettings()
            # Validate required DB values only when DB is enabled
            if _db_instance.DB_ENABLED:
                missing = [name for name in ("DB_PORT","DB_USERNAME","DB_PASSWORD","DB_DATABASE") if getattr(_db_instance, name) in (None, "")]
                if missing:
                    print("CRITICAL ERROR: DB is enabled but missing variables: " + ", ".join(missing))
                    sys.exit(1)
        except Exception as e:
            print("CRITICAL ERROR: Invalid DB environment variables!")
            print(e)
            sys.exit(1)
    return _db_instance  # always return the instance


def get_app_settings() -> AppSettings:
    """
    Return a singleton instance of AppSettings.
    Initializes on first access. Exits if environment variables are invalid.
    """
    global _app_instance
    if _app_instance is None:
        try:
            _app_instance = AppSettings()
        except Exception as e:
            print("CRITICAL ERROR: Invalid App environment variables!")
            print(e)
            sys.exit(1)
    return _app_instance
