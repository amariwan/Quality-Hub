from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config.settings import get_settings
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.infrastructure.models import UserModel

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_runtime_settings(_: UserModel = Depends(get_current_user)) -> dict:
    settings = get_settings()
    return {
        "api_version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "gitlab_base_url": settings.GITLAB_BASE_URL,
        "ws_live_default_interval_seconds": settings.WS_GITLAB_LIVE_DEFAULT_INTERVAL_SECONDS,
        "ws_live_max_interval_seconds": settings.WS_GITLAB_LIVE_MAX_INTERVAL_SECONDS,
        "watch_heartbeat_interval_seconds": settings.WATCH_HEARTBEAT_INTERVAL_SECONDS,
    }
