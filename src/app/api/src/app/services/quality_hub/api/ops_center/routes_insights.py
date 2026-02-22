# ruff: noqa: B008,PLR0913,F403,F405

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
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
    simulate_risk_decisions,
)
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository
from app.services.quality_hub.schemas.request.ops_center import RiskSimulationRequest


@router.get("/quality-cost")
async def get_quality_cost_dashboard(
    workspace_id: int | None = Query(default=None, gt=0),
    days: int = Query(default=30, ge=7, le=365),
    hourly_rate_usd: float = Query(default=120.0, gt=0, le=5000),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, workspace_group_path = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    _, pipelines, _, _, _ = await _load_workspace_dataset(
        repository=repository,
        workspace_group_path=workspace_group_path,
    )
    incident_rows = await _list_incident_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )

    now = datetime.now(UTC)
    cutoff = now - timedelta(days=days)
    recent_pipelines = [row for row in pipelines if (row.finished_at or row.started_at or now) >= cutoff]
    failed_pipelines = [row for row in recent_pipelines if (row.status or "").lower() in {"failed", "canceled"}]

    dora = compute_dora_metrics(recent_pipelines, days=days, now=now)
    mttr_hours = dora["mttr_hours"]["value"] or 0.0

    incidents_total = len(incident_rows)
    open_incidents = sum(1 for row in incident_rows if (row.status or "").lower() != "resolved")
    incident_recovery_hours = round(float(mttr_hours) * incidents_total, 2)
    failure_rework_hours = round(len(failed_pipelines) * 1.5, 2)
    coordination_hours = round(incidents_total * 2.0, 2)
    total_hours = round(incident_recovery_hours + failure_rework_hours + coordination_hours, 2)

    return {
        "workspace_id": resolved_workspace_id,
        "window_days": days,
        "hourly_rate_usd": hourly_rate_usd,
        "summary": {
            "incidents_total": incidents_total,
            "open_incidents": open_incidents,
            "failed_pipelines": len(failed_pipelines),
            "estimated_quality_hours": total_hours,
            "estimated_quality_cost_usd": round(total_hours * hourly_rate_usd, 2),
        },
        "breakdown_hours": {
            "incident_recovery": incident_recovery_hours,
            "failure_rework": failure_rework_hours,
            "coordination": coordination_hours,
        },
        "method": "heuristic_v1",
    }


@router.get("/predictive-risk")
async def get_predictive_risk(
    workspace_id: int | None = Query(default=None, gt=0),
    weeks: int = Query(default=6, ge=2, le=12),
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
    incident_rows = await _list_incident_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    incident_count_by_project = _incident_counts_by_project(incident_rows)

    projections: list[dict[str, Any]] = []
    for project in radar_payload.get("projects", []):
        project_id = int(project.get("project_id", 0) or 0)
        if project_id <= 0:
            continue
        base_risk = float(project.get("release_risk", {}).get("score", 0.0))
        regressions = len(project.get("regressions", []))
        confidence_gap = max(0.0, 70.0 - float(project.get("delivery_confidence_pct", 0.0)))
        incidents = int(incident_count_by_project.get(project_id, 0))
        projected_risk = min(100.0, round(base_risk + (regressions * 7.5) + (incidents * 8.0) + (confidence_gap * 0.4), 1))
        level = "low"
        if projected_risk >= 70:
            level = "high"
        elif projected_risk >= 45:
            level = "medium"

        projections.append(
            {
                "project_id": project_id,
                "project": project.get("project"),
                "current_release_risk_score": round(base_risk, 1),
                "projected_risk_score": projected_risk,
                "projected_level": level,
                "open_incidents": incidents,
                "regression_signals": regressions,
                "confidence_gap": round(confidence_gap, 1),
            }
        )

    projections.sort(key=lambda row: row["projected_risk_score"], reverse=True)
    return {
        "workspace_id": resolved_workspace_id,
        "weeks": weeks,
        "generated_at": now_utc().isoformat(),
        "count": len(projections),
        "items": projections,
    }


@router.get("/status-page")
async def get_status_page_payload(
    workspace_id: int | None = Query(default=None, gt=0),
    weeks: int = Query(default=6, ge=2, le=12),
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
    incident_rows = await _list_incident_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    open_incidents = [row for row in incident_rows if (row.status or "").lower() != "resolved"]

    overall = "operational"
    if len(open_incidents) >= 3:
        overall = "degraded"
    if len(open_incidents) >= 6:
        overall = "major_outage"

    project_rows = radar_payload.get("project_status", [])
    top_services = [
        {
            "service": item.get("project"),
            "status": item.get("status"),
            "reason": item.get("reason"),
        }
        for item in project_rows[:10]
    ]

    return {
        "workspace_id": resolved_workspace_id,
        "generated_at": now_utc().isoformat(),
        "overall_status": overall,
        "open_incidents": len(open_incidents),
        "message": (
            "System fully operational"
            if overall == "operational"
            else "Some services are degraded"
            if overall == "degraded"
            else "Major disruption under investigation"
        ),
        "services": top_services,
        "active_incidents": [
            {
                "id": row.id,
                "project_id": row.project_id,
                "title": row.title,
                "status": row.status,
                "external_issue_id": row.external_issue_id,
                "external_url": row.external_url,
            }
            for row in open_incidents[:20]
        ],
    }


@router.get("/team-benchmarking")
async def get_team_benchmarking(
    workspace_id: int | None = Query(default=None, gt=0),
    days: int = Query(default=30, ge=7, le=365),
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
        weeks=max(2, min(12, int(days / 7))),
    )

    team_to_project_ids: dict[str, set[int]] = defaultdict(set)
    for row in team_project_rows:
        team = next((item for item in teams if item.id == row.team_id), None)
        if team is None:
            continue
        team_to_project_ids[team.name].add(row.project_id)

    rankings: list[dict[str, Any]] = []
    for team_name, project_ids in team_to_project_ids.items():
        team_pipelines = [row for row in pipelines if row.project_id in project_ids]
        dora = compute_dora_metrics(team_pipelines, days=days)
        team_status_row = next((row for row in radar_payload.get("team_quality_indicator", []) if row.get("team") == team_name), None)
        readiness = float(team_status_row.get("avg_readiness_pct", 0.0)) if isinstance(team_status_row, dict) else 0.0
        score = (
            (4 if dora["overall_classification"] == "elite" else 3 if dora["overall_classification"] == "high" else 2 if dora["overall_classification"] == "medium" else 1)
            * 20
        ) + (readiness * 0.4)
        rankings.append(
            {
                "team": team_name,
                "project_count": len(project_ids),
                "readiness_avg_pct": round(readiness, 1),
                "dora_classification": dora["overall_classification"],
                "score": round(score, 1),
            }
        )

    rankings.sort(key=lambda row: row["score"], reverse=True)
    for index, row in enumerate(rankings, start=1):
        row["rank"] = index

    return {
        "workspace_id": resolved_workspace_id,
        "window_days": days,
        "count": len(rankings),
        "items": rankings,
    }


@router.get("/trend-regressions")
async def get_trend_regressions(
    workspace_id: int | None = Query(default=None, gt=0),
    weeks: int = Query(default=6, ge=2, le=12),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    _, workspace_group_path = await _resolve_workspace_scope(
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

    return {
        "workspace_id": workspace_id,
        "weeks": weeks,
        "generated_at": radar_payload.get("generated_at"),
        "quality_trend": radar_payload.get("quality_trend", []),
        "regressions": radar_payload.get("regressions", []),
    }


@router.get("/dora-metrics")
async def get_dora_metrics(
    workspace_id: int | None = Query(default=None, gt=0),
    days: int = Query(default=30, ge=7, le=365),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    _, workspace_group_path = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )

    _, pipelines, _, _, _ = await _load_workspace_dataset(
        repository=repository,
        workspace_group_path=workspace_group_path,
    )
    metrics = compute_dora_metrics(pipelines, days=days)
    return {
        "workspace_id": workspace_id,
        **metrics,
    }


@router.get("/ownership-heatmap")
async def get_ownership_heatmap(
    workspace_id: int | None = Query(default=None, gt=0),
    capacity_threshold: int = Query(default=6, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    _, workspace_group_path = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )

    projects, _, _, teams, team_project_rows = await _load_workspace_dataset(
        repository=repository,
        workspace_group_path=workspace_group_path,
    )
    payload = build_ownership_heatmap(
        projects=projects,
        teams=teams,
        team_project_mappings=team_project_rows,
        capacity_threshold=capacity_threshold,
    )
    payload["workspace_id"] = workspace_id
    return payload


@router.post("/risk-simulation")
async def run_risk_simulation(
    payload: RiskSimulationRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, workspace_group_path = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
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
        weeks=payload.weeks,
    )

    incident_rows = await _list_incident_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    incident_count_by_project = _incident_counts_by_project(incident_rows)

    simulation = simulate_risk_decisions(
        projects=radar_payload.get("projects", []),
        incident_count_by_project=incident_count_by_project,
        release_risk_high_above=payload.release_risk_high_above,
        release_risk_medium_above=payload.release_risk_medium_above,
        release_readiness_min_pct=payload.release_readiness_min_pct,
        delivery_confidence_min_pct=payload.delivery_confidence_min_pct,
        block_on_open_incidents=payload.block_on_open_incidents,
    )

    return {
        "workspace_id": resolved_workspace_id,
        "weeks": payload.weeks,
        "generated_at": now_utc().isoformat(),
        **simulation,
    }


@router.get("/weekly-summary")
async def get_weekly_summary(
    workspace_id: int | None = Query(default=None, gt=0),
    weeks: int = Query(default=6, ge=2, le=12),
    days: int = Query(default=30, ge=7, le=365),
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

    incident_rows = await _list_incident_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    open_incidents = sum(1 for row in incident_rows if (row.status or "").lower() != "resolved")
    active_release_policies = await _count_active_release_policies(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )

    summary = build_weekly_executive_summary(
        radar_payload=radar_payload,
        dora_metrics=dora_metrics,
        open_incidents=open_incidents,
        active_release_policies=active_release_policies,
    )
    summary["workspace_id"] = resolved_workspace_id
    summary["weeks"] = weeks
    summary["days"] = days
    return summary
