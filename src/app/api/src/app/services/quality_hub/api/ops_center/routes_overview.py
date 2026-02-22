# ruff: noqa: B008,PLR0913,F403,F405

from __future__ import annotations

from typing import Any

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.api.ops_center.router import router
from app.services.quality_hub.api.ops_center.services import *
from app.services.quality_hub.api.ops_center.utils import *
from app.services.quality_hub.application.ops_center import (
    build_ownership_heatmap,
    compute_dora_metrics,
    now_utc,
)
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository


@router.get("/overview")
async def get_ops_overview(
    workspace_id: int | None = Query(default=None, gt=0),
    weeks: int = Query(default=6, ge=2, le=12),
    days: int = Query(default=30, ge=7, le=365),
    capacity_threshold: int = Query(default=6, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, workspace_group_path = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )

    projects, pipelines, reports, teams, team_project_rows = await _load_workspace_dataset(
        repository=repository,
        workspace_group_path=workspace_group_path,
    )
    radar_payload = _build_local_radar_payload(
        projects=projects,
        pipelines=pipelines,
        reports=reports,
        teams=teams,
        team_project_rows=team_project_rows,
        weeks=weeks,
    )
    dora_metrics = compute_dora_metrics(pipelines, days=days)
    rows = await _load_ops_overview_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )

    incident_rows = rows["incident_links"]
    release_gate_rows = rows["release_gates"]
    incident_count_by_project = _incident_counts_by_project(incident_rows)
    open_incident_rows = _open_incident_rows(incident_rows)
    generated_at = now_utc().isoformat()

    ownership_heatmap = build_ownership_heatmap(
        projects=projects,
        teams=teams,
        team_project_mappings=team_project_rows,
        capacity_threshold=capacity_threshold,
    )
    analytics = _build_ops_overview_analytics_payloads(
        workspace_id=resolved_workspace_id,
        weeks=weeks,
        days=days,
        generated_at=generated_at,
        pipelines=pipelines,
        teams=teams,
        team_project_rows=team_project_rows,
        radar_payload=radar_payload,
        dora_metrics=dora_metrics,
        release_gate_rows=release_gate_rows,
        incident_rows=incident_rows,
        incident_count_by_project=incident_count_by_project,
        open_incident_rows=open_incident_rows,
    )

    return _build_ops_overview_response(
        generated_at=generated_at,
        workspace_id=resolved_workspace_id,
        weeks=weeks,
        days=days,
        projects=projects,
        pipelines=pipelines,
        radar_payload=radar_payload,
        dora_metrics=dora_metrics,
        weekly_summary=analytics["weekly_summary"],
        ownership_heatmap=ownership_heatmap,
        risk_simulation_preview=analytics["risk_simulation_preview"],
        quality_cost=analytics["quality_cost"],
        predictive_risk=analytics["predictive_risk"],
        status_page=analytics["status_page"],
        team_benchmarking=analytics["team_benchmarking"],
        rows=rows,
    )
