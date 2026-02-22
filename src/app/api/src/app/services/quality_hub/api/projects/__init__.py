from __future__ import annotations

from fastapi import APIRouter

from app.services.quality_hub.api.projects.list import router as list_router

router = APIRouter()
router.include_router(list_router)

__all__ = ["router"]
