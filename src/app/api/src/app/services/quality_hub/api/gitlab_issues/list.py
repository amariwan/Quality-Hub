from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import list_group_issues
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/gitlab/issues", tags=["gitlab"])


@router.get("")
async def get_group_issues(
    group_id: int = Query(...),
    state: str = Query(default="opened", pattern="^(opened|closed|all)$"),
    search: str | None = Query(default=None),
    current_user: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> dict:
    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    token = TokenCipher().decrypt(credential.token_encrypted)
    rows = await list_group_issues(
        token=token,
        base_url=credential.base_url,
        group_id=group_id,
        state=state,
        search=search,
        limit=200,
    )

    items = [
        {
            "id": row.get("id"),
            "iid": row.get("iid"),
            "project_id": row.get("project_id"),
            "title": row.get("title"),
            "description": row.get("description"),
            "state": row.get("state"),
            "labels": row.get("labels", []),
            "web_url": row.get("web_url"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "due_date": row.get("due_date"),
            "author": (row.get("author") or {}).get("name"),
            "assignees": [
                assignee.get("name")
                for assignee in row.get("assignees", [])
                if isinstance(assignee, dict)
            ],
        }
        for row in rows
        if isinstance(row, dict)
    ]

    return {
        "group_id": group_id,
        "state": state,
        "count": len(items),
        "items": items,
    }
