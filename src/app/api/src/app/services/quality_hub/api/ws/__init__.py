from __future__ import annotations

from fastapi import APIRouter

from app.services.quality_hub.api.ws.live import router as live_router

router = APIRouter()
router.include_router(live_router)

__all__ = ["router"]
