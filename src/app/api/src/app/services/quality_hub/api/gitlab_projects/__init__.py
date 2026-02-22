from fastapi import APIRouter

from app.services.quality_hub.api.gitlab_projects.changelog import router as changelog_router
from app.services.quality_hub.api.gitlab_projects.events import router as events_router
from app.services.quality_hub.api.gitlab_projects.insights import router as insights_router
from app.services.quality_hub.api.gitlab_projects.list import router as list_router

router = APIRouter()
router.include_router(list_router)
router.include_router(changelog_router)
router.include_router(events_router)
router.include_router(insights_router)

__all__ = ["router"]
