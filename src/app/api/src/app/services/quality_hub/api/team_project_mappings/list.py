from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/team-project-mappings", tags=["team-project-mappings"])


@router.get("")
async def list_team_project_mappings(
    _: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> list[dict]:
    repository = QualityHubRepository(session)
    rows = await repository.list_team_project_mappings()

    teams = {team.id: team for team in await repository.list_teams()}
    projects = {project.id: project for project in await repository.list_projects()}

    return [
        {
            "id": row.id,
            "team_id": row.team_id,
            "project_id": row.project_id,
            "team": teams.get(row.team_id).name if teams.get(row.team_id) else None,
            "project": projects.get(row.project_id).path_with_namespace if projects.get(row.project_id) else None,
        }
        for row in rows
    ]
