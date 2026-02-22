from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import create_project_issue, get_project
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository
from app.services.quality_hub.schemas.request.gitlab_issues import GitlabIssueCreateRequest

router = APIRouter(prefix="/gitlab/issues", tags=["gitlab"])


def _candidate_gitlab_project_ids(
    *,
    requested_id: int,
    local_mapped_gitlab_id: int | None,
) -> list[int]:
    candidates: list[int] = []
    if local_mapped_gitlab_id is not None:
        candidates.append(local_mapped_gitlab_id)
    if requested_id not in candidates:
        candidates.append(requested_id)
    return candidates


@router.post("")
async def create_issue(  # noqa: C901, PLR0912, PLR0915
    payload: GitlabIssueCreateRequest,
    current_user: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> dict:
    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    token = TokenCipher().decrypt(credential.token_encrypted)
    local_project = await repository.get_project(payload.project_id)
    candidates = _candidate_gitlab_project_ids(
        requested_id=payload.project_id,
        local_mapped_gitlab_id=local_project.gitlab_project_id if local_project else None,
    )

    created: dict | None = None
    selected_gitlab_project_id: int | None = None
    last_http_error: httpx.HTTPStatusError | None = None
    last_create_error: Exception | None = None
    for candidate_id in candidates:
        project = await get_project(
            token=token,
            base_url=credential.base_url,
            project_id=candidate_id,
        )
        if project is None:
            continue

        try:
            created = await create_project_issue(
                token=token,
                base_url=credential.base_url,
                project_id=candidate_id,
                title=payload.title,
                description=payload.description,
                labels=payload.labels,
                due_date=payload.due_date,
            )
            selected_gitlab_project_id = candidate_id
            break
        except httpx.HTTPStatusError as exc:
            last_http_error = exc
            # Retry next candidate on upstream server errors.
            if exc.response.status_code >= 500:
                continue
            raise
        except Exception as exc:  # noqa: BLE001
            last_create_error = exc
            continue

    if created is None and last_http_error is not None:
        exc = last_http_error
        detail = "GitLab issue create failed"
        try:
            body = exc.response.json()
            if isinstance(body, dict):
                message = body.get("message")
                if isinstance(message, str):
                    detail = f"GitLab: {message}"
                elif isinstance(message, dict):
                    detail = f"GitLab validation: {message}"
        except ValueError:
            raw = (exc.response.text or "").strip()
            if raw:
                detail = f"GitLab: {raw[:300]}"
        upstream_status = exc.response.status_code
        api_status = status.HTTP_502_BAD_GATEWAY if upstream_status >= 500 else upstream_status
        raise HTTPException(
            status_code=api_status,
            detail=(
                f"{detail} (upstream_status={upstream_status}, "
                f"project_id={payload.project_id}, "
                f"resolved_gitlab_project_id={selected_gitlab_project_id}, "
                f"candidates={candidates})"
            ),
        ) from exc
    if created is None:
        if last_create_error is not None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"GitLab issue create failed: {last_create_error} "
                    f"(project_id={payload.project_id}, candidates={candidates})"
                ),
            ) from last_create_error
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No accessible GitLab project resolved for issue creation "
                f"(project_id={payload.project_id}, candidates={candidates})"
            ),
        )

    if not isinstance(created, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitLab response parse error: Unexpected GitLab issue response",
        )

    return {
        "id": created.get("id"),
        "iid": created.get("iid"),
        "project_id": created.get("project_id"),
        "title": created.get("title"),
        "state": created.get("state"),
        "labels": created.get("labels", []),
        "web_url": created.get("web_url"),
        "created_at": created.get("created_at"),
        "due_date": created.get("due_date") or payload.due_date,
    }
