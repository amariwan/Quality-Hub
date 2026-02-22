from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import list_projects as list_gitlab_projects
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    sync_from_gitlab: bool = Query(default=False),
) -> list[dict]:
    repository = QualityHubRepository(session)
    if sync_from_gitlab:
        credential = await repository.get_gitlab_credential(current_user.id)
        if credential is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

        token = TokenCipher().decrypt(credential.token_encrypted)
        gitlab_projects = await list_gitlab_projects(token=token, base_url=credential.base_url)
        for project in gitlab_projects:
            gitlab_project_id = project.get("id")
            if not isinstance(gitlab_project_id, int):
                continue
            path_with_namespace = project.get("path_with_namespace") or project.get("path") or str(gitlab_project_id)
            default_branch = project.get("default_branch")
            await repository.upsert_project(
                gitlab_project_id=gitlab_project_id,
                path_with_namespace=path_with_namespace,
                default_branch=default_branch,
            )

    rows = await repository.list_projects()
    return [
        {
            "id": row.id,
            "gitlab_project_id": row.gitlab_project_id,
            "path_with_namespace": row.path_with_namespace,
            "default_branch": row.default_branch,
        }
        for row in rows
    ]
