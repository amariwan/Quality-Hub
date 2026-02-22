from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import (
    list_project_merge_requests,
    list_project_pipelines,
)
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/gitlab/insights", tags=["gitlab"])


def _attention_level(*, failure_rate_pct: float, latest_pipeline_status: str | None, open_merge_requests: int) -> str:
    if latest_pipeline_status == "failed" or failure_rate_pct >= 50.0 or open_merge_requests >= 20:
        return "high"
    if failure_rate_pct >= 20.0 or open_merge_requests >= 10:
        return "medium"
    return "low"


@router.get("/projects")
async def get_projects_insights(
    project_ids: list[int] = Query(default_factory=list),
    pipeline_limit: int = Query(default=40, ge=10, le=200),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    if not project_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one project_id is required")

    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    token = TokenCipher().decrypt(credential.token_encrypted)
    output: list[dict] = []
    totals = {
        "projects": 0,
        "open_merge_requests": 0,
        "pipelines_sampled": 0,
        "failed_pipelines": 0,
    }

    for project_id in project_ids:
        try:
            pipelines = await list_project_pipelines(
                token=token,
                base_url=credential.base_url,
                project_id=project_id,
                limit=pipeline_limit,
            )
            merge_requests = await list_project_merge_requests(
                token=token,
                base_url=credential.base_url,
                project_id=project_id,
                state="opened",
                limit=200,
            )
        except httpx.HTTPStatusError as exc:
            detail = "Failed to load project insights from GitLab"
            if exc.response.status_code == status.HTTP_404_NOT_FOUND:
                detail = f"GitLab project not found: {project_id}"
            elif exc.response.status_code == status.HTTP_403_FORBIDDEN:
                detail = f"No access to GitLab project: {project_id}"
            raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc

        sampled = len(pipelines)
        failed_count = sum(1 for row in pipelines if row.get("status") == "failed")
        success_count = sum(1 for row in pipelines if row.get("status") == "success")
        running_count = sum(1 for row in pipelines if row.get("status") == "running")
        latest = pipelines[0] if pipelines else {}
        latest_status = latest.get("status")
        latest_updated_at = latest.get("updated_at")
        failure_rate_pct = round((failed_count / sampled) * 100, 1) if sampled else 0.0
        open_mr_count = len(merge_requests)
        attention = _attention_level(
            failure_rate_pct=failure_rate_pct,
            latest_pipeline_status=latest_status,
            open_merge_requests=open_mr_count,
        )

        output.append(
            {
                "project_id": project_id,
                "open_merge_requests": open_mr_count,
                "pipelines_sampled": sampled,
                "failed_pipelines": failed_count,
                "success_pipelines": success_count,
                "running_pipelines": running_count,
                "failure_rate_pct": failure_rate_pct,
                "latest_pipeline_status": latest_status,
                "latest_pipeline_updated_at": latest_updated_at,
                "attention_level": attention,
            }
        )

        totals["projects"] += 1
        totals["open_merge_requests"] += open_mr_count
        totals["pipelines_sampled"] += sampled
        totals["failed_pipelines"] += failed_count

    totals["failure_rate_pct"] = round(
        (totals["failed_pipelines"] / totals["pipelines_sampled"]) * 100, 1
    ) if totals["pipelines_sampled"] else 0.0

    return {
        "count": len(output),
        "totals": totals,
        "items": output,
    }
