# ruff: noqa: PLR0913

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.models.tables import AuditEventModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository


async def _resolve_workspace_scope(
    *,
    repository: QualityHubRepository,
    current_user: UserModel,
    workspace_id: int | None,
) -> tuple[int | None, str | None]:
    if workspace_id is None:
        return None, None
    workspace = await repository.get_monitored_group(workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace.id, workspace.gitlab_group_path


def _parse_datetime_or_400(raw: str | None, field_name: str) -> datetime:
    if raw is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} is required")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid datetime for {field_name}") from exc
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _append_audit_event(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_group_id: int | None,
    resource_type: str,
    resource_id: int | None,
    action: str,
    details_json: dict[str, Any],
) -> None:
    session.add(
        AuditEventModel(
            owner_user_id=owner_user_id,
            workspace_group_id=workspace_group_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            details_json=details_json,
        )
    )


async def _validate_team_and_project_scope(
    *,
    repository: QualityHubRepository,
    team_id: int | None,
    project_id: int | None,
) -> None:
    if team_id is not None and await repository.get_team(team_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if project_id is not None and await repository.get_project(project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


# Keep star-import compatibility for route modules that use helper names with a
# leading underscore.
__all__ = [
    name
    for name, value in globals().items()
    if name.startswith("_") and not name.startswith("__") and callable(value)
]
