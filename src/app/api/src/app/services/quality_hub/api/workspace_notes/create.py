from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.domain.validators import ensure_visibility
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository
from app.services.quality_hub.schemas.request.notes import NoteCreateRequest

router = APIRouter(prefix="/workspace/notes", tags=["workspace-notes"])


@router.post("")
async def create_note(
    payload: NoteCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    repository = QualityHubRepository(session)
    workspace = await repository.get_monitored_group(payload.workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    item = await repository.create_note(
        owner_user_id=current_user.id,
        workspace_group_id=workspace.id,
        visibility=ensure_visibility(payload.visibility),
        team_id=payload.team_id,
        scope_type=payload.scope_type,
        project_id=payload.project_id,
        env=payload.env,
        cluster_id=payload.cluster_id,
        content=payload.content,
    )
    return {
        "id": item.id,
        "workspace_id": item.workspace_group_id,
        "visibility": item.visibility,
        "team_id": item.team_id,
        "scope_type": item.scope_type,
        "project_id": item.project_id,
        "env": item.env,
        "cluster_id": item.cluster_id,
        "content": item.content,
    }
