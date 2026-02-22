from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import get_project as get_gitlab_project
from app.services.quality_hub.domain.validators import ensure_visibility
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository
from app.services.quality_hub.schemas.request.watchlist import WatchlistCreateRequest

router = APIRouter(prefix="/workspace/watchlist", tags=["workspace-watchlist"])


async def _resolve_local_project_id(
    *,
    repository: QualityHubRepository,
    user_id: int,
    project_id_or_gitlab_id: int,
) -> int | None:
    local_project = await repository.get_project(project_id_or_gitlab_id)
    if local_project is not None:
        return local_project.id

    by_gitlab_id = await repository.get_project_by_gitlab_id(project_id_or_gitlab_id)
    if by_gitlab_id is not None:
        return by_gitlab_id.id

    credential = await repository.get_gitlab_credential(user_id)
    if credential is None:
        return None

    token = TokenCipher().decrypt(credential.token_encrypted)
    remote_project = await get_gitlab_project(
        token=token,
        base_url=credential.base_url,
        project_id=project_id_or_gitlab_id,
    )
    if remote_project is None:
        return None

    gitlab_project_id = remote_project.get("id")
    if not isinstance(gitlab_project_id, int):
        return None

    path_with_namespace = remote_project.get("path_with_namespace") or remote_project.get("path") or str(gitlab_project_id)
    default_branch = remote_project.get("default_branch")
    upserted = await repository.upsert_project(
        gitlab_project_id=gitlab_project_id,
        path_with_namespace=path_with_namespace,
        default_branch=default_branch,
    )
    return upserted.id


@router.post("")
async def create_watchlist_item(
    payload: WatchlistCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    repository = QualityHubRepository(session)
    resolved_project_id = await _resolve_local_project_id(
        repository=repository,
        user_id=current_user.id,
        project_id_or_gitlab_id=payload.project_id,
    )
    if resolved_project_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    existing_item = await repository.get_watchlist_item_by_project(current_user.id, resolved_project_id)
    if existing_item is not None:
        item = existing_item
    else:
        item = await repository.create_watchlist_item(
            owner_user_id=current_user.id,
            visibility=ensure_visibility(payload.visibility),
            team_id=payload.team_id,
            project_id=resolved_project_id,
        )
    return {
        "id": item.id,
        "visibility": item.visibility,
        "team_id": item.team_id,
        "project_id": item.project_id,
    }
