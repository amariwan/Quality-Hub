from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository
from app.services.quality_hub.schemas.request.team_project_mappings import TeamProjectMappingCreateRequest

router = APIRouter(prefix="/team-project-mappings", tags=["team-project-mappings"])


@router.post("")
async def create_team_project_mapping(
    payload: TeamProjectMappingCreateRequest,
    _: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> dict:
    repository = QualityHubRepository(session)

    team = await repository.get_team(payload.team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    project = await repository.get_project(payload.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    try:
        item = await repository.create_team_project_mapping(
            team_id=payload.team_id,
            project_id=payload.project_id,
        )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team project mapping already exists",
        ) from exc

    return {
        "id": item.id,
        "team_id": item.team_id,
        "project_id": item.project_id,
    }
