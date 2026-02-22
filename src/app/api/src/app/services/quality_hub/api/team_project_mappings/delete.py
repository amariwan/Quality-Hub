from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/team-project-mappings", tags=["team-project-mappings"])


@router.delete("/{mapping_id}")
async def delete_team_project_mapping(
    mapping_id: int,
    _: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> dict:
    repository = QualityHubRepository(session)
    deleted = await repository.delete_team_project_mapping(mapping_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team project mapping not found")
    return {"deleted": True}
