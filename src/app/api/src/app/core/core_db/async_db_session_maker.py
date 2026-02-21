from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from app.config import AppSettings, DbSettings, get_app_settings, get_db_settings

# Import SQLAlchemy runtime symbols lazily so the module can be imported when
# SQLAlchemy is not installed and DB is disabled. Type-only imports are used
# for static typing support.
if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession

app_settings: AppSettings = get_app_settings()
db_settings: DbSettings = get_db_settings()


def _postgres_connection_string_builder(db_port: int, db_user: str, db_pw: str, db: str, db_ip: str = "localhost") -> str:
    """Creates a Postgres Connection string"""
    pg_prefix = "postgresql+asyncpg"
    connection_string = f"{pg_prefix}://{db_user}:{db_pw}@{db_ip}:{db_port}/{db}"
    return connection_string


class DatabaseSessionManager:
    """
    Manages a single async SQLAlchemy Engine and provides async session and connection context managers.

    The heavy SQLAlchemy runtime imports are performed lazily in `__init__` so
    the module can be imported in environments where SQLAlchemy is not
    installed — as long as `DB_ENABLED` is False.
    """

    def __init__(self, host: str, engine_kwargs: dict[str, Any] | None = None):
        # avoid mutable default; initialize dict inside the function
        engine_kwargs = engine_kwargs or {}
        # perform runtime import only when constructing the session manager
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        self._engine: AsyncEngine = create_async_engine(host, **engine_kwargs)
        self._sessionmaker = async_sessionmaker(autocommit=False, bind=self._engine)

    async def close(self):
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        await self._engine.dispose()

        self._engine = None
        self._sessionmaker = None

    @contextlib.asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncConnection]:
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        async with self._engine.begin() as connection:
            try:
                yield connection
            except Exception:
                await connection.rollback()
                raise

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        if self._sessionmaker is None:
            raise Exception("DatabaseSessionManager has not initialized")

        session = self._sessionmaker()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# If DB is disabled, provide a No-op session manager that matches the surface area of DatabaseSessionManager
class NoopDatabaseSessionManager:
    def __init__(self):
        self._engine = None

    async def close(self):
        # No resources to free when DB is disabled
        return

    @contextlib.asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncConnection]:
        raise RuntimeError("Database is disabled (DB_ENABLED=False)")
        yield  # pragma: no cover

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        raise RuntimeError("Database is disabled (DB_ENABLED=False)")
        yield  # pragma: no cover


if db_settings.DB_ENABLED:
    connection_string: str = _postgres_connection_string_builder(
        db_port=db_settings.DB_PORT, db_ip=db_settings.DB_IP, db_user=db_settings.DB_USERNAME, db_pw=db_settings.DB_PASSWORD, db=db_settings.DB_DATABASE
    )
    sessionmanager: DatabaseSessionManager = DatabaseSessionManager(connection_string, engine_kwargs={"echo": db_settings.DB_ENGINE_ECHO})
else:
    sessionmanager = NoopDatabaseSessionManager()


async def get_db_session():
    """
    FastAPI dependency that yields an async DB session.
    Handles commit, rollback, and closure automatically because of the WITH / Contextmanager
    """
    if not db_settings.DB_ENABLED:
        raise RuntimeError("Database is disabled (DB_ENABLED=False)")
    async with sessionmanager.session() as session:
        yield session
