from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import list_group_projects, list_projects
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/gitlab/projects", tags=["gitlab"])


@router.get("")
async def list_gitlab_projects(
    group_id: int | None = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    token = TokenCipher().decrypt(credential.token_encrypted)
    if group_id is not None:
        projects = await list_group_projects(token=token, base_url=credential.base_url, group_id=group_id)
    else:
        projects = await list_projects(token=token, base_url=credential.base_url)

    return [
        {
            "id": project["id"],
            "name": project.get("name") or str(project["id"]),
            "path_with_namespace": project.get("path_with_namespace") or project.get("path"),
            "default_branch": project.get("default_branch"),
            "web_url": project.get("web_url"),
        }
        for project in projects
    ]
