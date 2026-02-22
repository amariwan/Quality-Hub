from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/workspace/notes", tags=["workspace-notes"])


@router.get("")
async def list_notes(
    workspace_id: int = Query(..., gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    repository = QualityHubRepository(session)
    workspace = await repository.get_monitored_group(workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    rows = await repository.list_notes(current_user.id, workspace.id)
    return [
        {
            "id": row.id,
            "workspace_id": row.workspace_group_id,
            "visibility": row.visibility,
            "team_id": row.team_id,
            "scope_type": row.scope_type,
            "project_id": row.project_id,
            "env": row.env,
            "cluster_id": row.cluster_id,
            "content": row.content,
        }
        for row in rows
    ]
