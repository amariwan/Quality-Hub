from __future__ import annotations

from fastapi import APIRouter

from app.services.quality_hub.api.settings.get import router as get_router

router = APIRouter()
router.include_router(get_router)

__all__ = ["router"]
