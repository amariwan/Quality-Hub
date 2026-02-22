from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import list_groups
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/gitlab/groups", tags=["gitlab"])


@router.get("")
async def list_gitlab_groups(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    token = TokenCipher().decrypt(credential.token_encrypted)
    groups = await list_groups(token=token, base_url=credential.base_url)

    return [
        {
            "id": group["id"],
            "path": group.get("path") or group.get("full_path"),
            "full_path": group.get("full_path") or group.get("path"),
            "name": group.get("name") or str(group["id"]),
            "web_url": group.get("web_url"),
        }
        for group in groups
    ]
