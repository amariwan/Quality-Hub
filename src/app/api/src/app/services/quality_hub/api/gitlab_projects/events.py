from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import list_project_pipelines
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/gitlab/projects", tags=["gitlab"])


@router.get("/{project_id}/events")
async def list_gitlab_project_events(
    project_id: int,
    limit: int = Query(default=30, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    ref: str | None = Query(default=None),
    source: str | None = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    token = TokenCipher().decrypt(credential.token_encrypted)
    try:
        rows = await list_project_pipelines(
            token=token,
            base_url=credential.base_url,
            project_id=project_id,
            status=status_filter,
            ref=ref,
            source=source,
            limit=limit,
        )
    except httpx.HTTPStatusError as exc:
        detail = "Failed to load project events from GitLab"
        if exc.response.status_code == status.HTTP_404_NOT_FOUND:
            detail = "GitLab project not found"
        elif exc.response.status_code == status.HTTP_403_FORBIDDEN:
            detail = "No access to this GitLab project"
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc

    status_counts: dict[str, int] = {}
    for row in rows:
        key = str(row.get("status") or "unknown")
        status_counts[key] = status_counts.get(key, 0) + 1

    return {
        "project_id": project_id,
        "count": min(len(rows), limit),
        "status_counts": status_counts,
        "items": [
            {
                "id": row.get("id"),
                "status": row.get("status"),
                "ref": row.get("ref"),
                "sha": row.get("sha"),
                "source": row.get("source"),
                "updated_at": row.get("updated_at"),
                "web_url": row.get("web_url"),
            }
            for row in rows[:limit]
        ],
    }
