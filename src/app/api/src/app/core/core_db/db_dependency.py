from typing import TYPE_CHECKING, Annotated, Any

from fastapi import Depends

from app.core.core_db.async_db_session_maker import get_db_session

# Import SQLAlchemy types only for type checking to avoid a hard runtime
# dependency when DB is disabled / SQLAlchemy is not installed.
if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


DBSessionDep = Annotated[Any, Depends(dependency=get_db_session)]


"""
Primary Dependency for Database Access

`DBSessionDep` provides a FastAPI-compatible dependency that yields an
`AsyncSession` from the application's async SQLAlchemy session manager.

Usage:
    - Inject `DBSessionDep` into your path operations or other dependencies
      to perform async database queries.
    - Ensures proper session lifecycle: commits, rollbacks, and closure
      are handled automatically.

Example:
    router = APIRouter()

    @router.get("/users/{user_id}")
    async def get_user(user_id: int, db: AsyncSession = DBSessionDep):
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        return user

Notes:
    - This is the single recommended entry point for obtaining a database session
      in the application.
    - Internally, it uses `get_db_session` from the async DB session manager.
"""


DBSessionDep = Annotated[AsyncSession, Depends(dependency=get_db_session)]
