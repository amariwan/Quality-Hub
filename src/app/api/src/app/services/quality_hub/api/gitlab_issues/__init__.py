from fastapi import APIRouter

from app.services.quality_hub.api.gitlab_issues.create import router as create_router
from app.services.quality_hub.api.gitlab_issues.list import router as list_router

router = APIRouter()
router.include_router(list_router)
router.include_router(create_router)

__all__ = ["router"]
