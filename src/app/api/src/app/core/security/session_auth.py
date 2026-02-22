from __future__ import annotations

from itsdangerous import BadSignature, URLSafeSerializer
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.core.db.session import get_db_session
from app.services.quality_hub.infrastructure.models import UserModel

settings = get_settings()
serializer = URLSafeSerializer(settings.SESSION_SECRET, salt="quality-hub-session")


def create_session(response: Response, user_id: int) -> None:
    token = serializer.dumps({"user_id": user_id})
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")


def get_session_user_id_from_raw(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        payload = serializer.loads(raw)
    except BadSignature:
        return None
    user_id = payload.get("user_id")
    if isinstance(user_id, int):
        return user_id
    return None


def get_session_user_id(request: Request) -> int | None:
    raw = request.cookies.get(settings.SESSION_COOKIE_NAME)
    return get_session_user_id_from_raw(raw)


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> UserModel:
    user_id = get_session_user_id(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session user not found")
    return user


async def get_current_user_id(user: UserModel = Depends(get_current_user)) -> int:
    return user.id
