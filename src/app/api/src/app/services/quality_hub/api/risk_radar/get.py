from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository
from app.services.quality_hub.services.queries.get_management_risk_radar import get_management_risk_radar

router = APIRouter(prefix="/risk-radar", tags=["risk-radar"])


@router.get("")
async def get_risk_radar(
    weeks: int = Query(default=3, ge=2, le=12),
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> dict:
    repository = QualityHubRepository(session)
    workspace_group_path: str | None = None
    if workspace_id is not None:
        workspace = await repository.get_monitored_group(workspace_id, current_user.id)
        if workspace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        workspace_group_path = workspace.gitlab_group_path

    payload = await get_management_risk_radar(
        repository,
        user_id=current_user.id,
        weeks=weeks,
        workspace_group_path=workspace_group_path,
    )
    payload["user_id"] = current_user.id
    payload["workspace_id"] = workspace_id
    return payload
