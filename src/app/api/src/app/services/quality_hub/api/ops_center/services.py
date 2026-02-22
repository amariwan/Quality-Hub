# ruff: noqa: C901,PLR0913,PLR0915

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.quality_hub.api.ops_center.types import OpsOverviewRows
from app.services.quality_hub.application.management_risk_radar import (
    RadarPipeline,
    RadarProject,
    RadarReport,
    RadarTeamProjectMapping,
    build_management_risk_radar,
)
from app.services.quality_hub.application.ops_center import (
    build_weekly_executive_summary,
    compute_dora_metrics,
    normalize_workspace_path,
    project_belongs_to_workspace,
    simulate_risk_decisions,
)
from app.services.quality_hub.infrastructure.models.tables import (
    AlertRuleModel,
    AuditEventModel,
    ChangeApprovalModel,
    IncidentLinkModel,
    PostmortemModel,
    ReleaseGatePolicyModel,
    ReleaseTrainEventModel,
    RemediationPlaybookModel,
    RolloutGuardrailModel,
    ServiceDependencyModel,
    ServiceSLOModel,
    WebhookAutomationModel,
    WorkspaceTemplateModel,
)
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if isinstance(dt, datetime) else None


def _serialize_release_gate(row: ReleaseGatePolicyModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "team_id": row.team_id,
        "project_id": row.project_id,
        "name": row.name,
        "max_release_risk_score": row.max_release_risk_score,
        "min_release_readiness_pct": row.min_release_readiness_pct,
        "min_delivery_confidence_pct": row.min_delivery_confidence_pct,
        "require_green_build": row.require_green_build,
        "block_on_open_incidents": row.block_on_open_incidents,
        "active": row.active,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_alert_rule(row: AlertRuleModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "team_id": row.team_id,
        "name": row.name,
        "severity": row.severity,
        "channel": row.channel,
        "condition_type": row.condition_type,
        "threshold_value": row.threshold_value,
        "escalation_minutes": row.escalation_minutes,
        "recipients": [str(item) for item in (row.recipients_json or [])],
        "active": row.active,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_incident_link(
    row: IncidentLinkModel,
    *,
    project_name: str | None,
    gitlab_pipeline_id: int | None,
) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "project_id": row.project_id,
        "project": project_name,
        "pipeline_id": row.pipeline_id,
        "gitlab_pipeline_id": gitlab_pipeline_id,
        "provider": row.provider,
        "external_issue_id": row.external_issue_id,
        "external_url": row.external_url,
        "title": row.title,
        "status": row.status,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_workspace_template(row: WorkspaceTemplateModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "name": row.name,
        "description": row.description,
        "definition_json": row.definition_json,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_audit_event(row: AuditEventModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "action": row.action,
        "details_json": row.details_json,
        "created_at": _iso(row.created_at),
    }


def _serialize_product_event(row: AuditEventModel) -> dict[str, Any]:
    details_json = row.details_json if isinstance(row.details_json, dict) else {}
    metadata_json = details_json.get("metadata_json")
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "scenario": str(details_json.get("scenario") or "unknown"),
        "event_name": row.action,
        "source": str(details_json.get("source") or "unknown"),
        "metadata_json": metadata_json if isinstance(metadata_json, dict) else {},
        "created_at": _iso(row.created_at),
    }


def _serialize_release_train_event(row: ReleaseTrainEventModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "project_id": row.project_id,
        "title": row.title,
        "event_type": row.event_type,
        "status": row.status,
        "start_at": _iso(row.start_at),
        "end_at": _iso(row.end_at),
        "notes": row.notes,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_remediation_playbook(row: RemediationPlaybookModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "team_id": row.team_id,
        "name": row.name,
        "trigger_type": row.trigger_type,
        "action_type": row.action_type,
        "config_json": row.config_json,
        "active": row.active,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_service_slo(row: ServiceSLOModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "project_id": row.project_id,
        "service_name": row.service_name,
        "slo_target_pct": row.slo_target_pct,
        "window_days": row.window_days,
        "error_budget_remaining_pct": row.error_budget_remaining_pct,
        "availability_pct": row.availability_pct,
        "burn_rate": row.burn_rate,
        "status": row.status,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_rollout_guardrail(row: RolloutGuardrailModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "project_id": row.project_id,
        "name": row.name,
        "canary_required": row.canary_required,
        "canary_success_rate_min_pct": row.canary_success_rate_min_pct,
        "max_flag_rollout_pct": row.max_flag_rollout_pct,
        "block_if_error_budget_below_pct": row.block_if_error_budget_below_pct,
        "active": row.active,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_service_dependency(
    row: ServiceDependencyModel,
    *,
    source_project: str | None,
    target_project: str | None,
) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "source_project_id": row.source_project_id,
        "source_project": source_project,
        "target_project_id": row.target_project_id,
        "target_project": target_project,
        "criticality": row.criticality,
        "created_at": _iso(row.created_at),
    }


def _serialize_postmortem(row: PostmortemModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "incident_link_id": row.incident_link_id,
        "title": row.title,
        "summary": row.summary,
        "root_cause": row.root_cause,
        "impact": row.impact,
        "action_items": [str(item) for item in (row.action_items_json or [])],
        "status": row.status,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_change_approval(row: ChangeApprovalModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "project_id": row.project_id,
        "release_version": row.release_version,
        "required_roles": [str(item) for item in (row.required_roles_json or [])],
        "approvals": list(row.approvals_json or []),
        "status": row.status,
        "requested_by": row.requested_by,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_webhook_automation(row: WebhookAutomationModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "workspace_id": row.workspace_group_id,
        "name": row.name,
        "event_type": row.event_type,
        "url": row.url,
        "secret_ref": row.secret_ref,
        "headers_json": row.headers_json,
        "active": row.active,
        "last_status": row.last_status,
        "last_delivery_at": _iso(row.last_delivery_at),
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }

async def _list_release_gate_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[ReleaseGatePolicyModel]:
    stmt = select(ReleaseGatePolicyModel).where(ReleaseGatePolicyModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(ReleaseGatePolicyModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(ReleaseGatePolicyModel.updated_at.desc(), ReleaseGatePolicyModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_alert_rule_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[AlertRuleModel]:
    stmt = select(AlertRuleModel).where(AlertRuleModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(AlertRuleModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(AlertRuleModel.updated_at.desc(), AlertRuleModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_incident_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[IncidentLinkModel]:
    stmt = select(IncidentLinkModel).where(IncidentLinkModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(IncidentLinkModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(IncidentLinkModel.updated_at.desc(), IncidentLinkModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_template_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[WorkspaceTemplateModel]:
    stmt = select(WorkspaceTemplateModel).where(WorkspaceTemplateModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(WorkspaceTemplateModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(WorkspaceTemplateModel.updated_at.desc(), WorkspaceTemplateModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_audit_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
    limit: int,
    resource_type: str | None = None,
) -> list[AuditEventModel]:
    stmt = select(AuditEventModel).where(AuditEventModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(AuditEventModel.workspace_group_id == workspace_id)
    if resource_type is not None:
        stmt = stmt.where(AuditEventModel.resource_type == resource_type)
    stmt = stmt.order_by(AuditEventModel.id.desc()).limit(limit)
    return list((await session.execute(stmt)).scalars().all())


async def _list_release_train_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[ReleaseTrainEventModel]:
    stmt = select(ReleaseTrainEventModel).where(ReleaseTrainEventModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(ReleaseTrainEventModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(ReleaseTrainEventModel.start_at.asc(), ReleaseTrainEventModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_remediation_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[RemediationPlaybookModel]:
    stmt = select(RemediationPlaybookModel).where(RemediationPlaybookModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(RemediationPlaybookModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(RemediationPlaybookModel.updated_at.desc(), RemediationPlaybookModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_service_slo_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[ServiceSLOModel]:
    stmt = select(ServiceSLOModel).where(ServiceSLOModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(ServiceSLOModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(ServiceSLOModel.updated_at.desc(), ServiceSLOModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_guardrail_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[RolloutGuardrailModel]:
    stmt = select(RolloutGuardrailModel).where(RolloutGuardrailModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(RolloutGuardrailModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(RolloutGuardrailModel.updated_at.desc(), RolloutGuardrailModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_dependency_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[ServiceDependencyModel]:
    stmt = select(ServiceDependencyModel).where(ServiceDependencyModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(ServiceDependencyModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(ServiceDependencyModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_postmortem_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[PostmortemModel]:
    stmt = select(PostmortemModel).where(PostmortemModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(PostmortemModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(PostmortemModel.updated_at.desc(), PostmortemModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_change_approval_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[ChangeApprovalModel]:
    stmt = select(ChangeApprovalModel).where(ChangeApprovalModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(ChangeApprovalModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(ChangeApprovalModel.updated_at.desc(), ChangeApprovalModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _list_webhook_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> list[WebhookAutomationModel]:
    stmt = select(WebhookAutomationModel).where(WebhookAutomationModel.owner_user_id == owner_user_id)
    if workspace_id is not None:
        stmt = stmt.where(WebhookAutomationModel.workspace_group_id == workspace_id)
    stmt = stmt.order_by(WebhookAutomationModel.updated_at.desc(), WebhookAutomationModel.id.desc())
    return list((await session.execute(stmt)).scalars().all())


async def _load_workspace_dataset(
    *,
    repository: QualityHubRepository,
    workspace_group_path: str | None,
) -> tuple[list[Any], list[Any], list[Any], list[Any], list[Any]]:
    projects = list(await repository.list_projects())
    pipelines = list(await repository.list_pipelines())
    reports = list(await repository.list_reports())
    teams = list(await repository.list_teams())
    team_project_rows = list(await repository.list_team_project_mappings())

    normalized_workspace_path = normalize_workspace_path(workspace_group_path)
    if normalized_workspace_path is not None:
        projects = [
            project
            for project in projects
            if project_belongs_to_workspace(project.path_with_namespace, normalized_workspace_path)
        ]

    project_ids = {project.id for project in projects}
    pipelines = [pipeline for pipeline in pipelines if pipeline.project_id in project_ids]
    pipeline_ids = {pipeline.id for pipeline in pipelines}
    reports = [report for report in reports if report.pipeline_id in pipeline_ids]

    team_project_rows = [row for row in team_project_rows if row.project_id in project_ids]
    team_ids = {row.team_id for row in team_project_rows}
    teams = [team for team in teams if team.id in team_ids]

    return projects, pipelines, reports, teams, team_project_rows


def _build_local_radar_payload(
    *,
    projects: list[Any],
    pipelines: list[Any],
    reports: list[Any],
    teams: list[Any],
    team_project_rows: list[Any],
    weeks: int,
) -> dict[str, Any]:
    team_by_id = {team.id: team for team in teams}
    payload = build_management_risk_radar(
        projects=[
            RadarProject(
                id=project.id,
                path_with_namespace=project.path_with_namespace,
            )
            for project in projects
        ],
        pipelines=[
            RadarPipeline(
                id=pipeline.id,
                project_id=pipeline.project_id,
                gitlab_pipeline_id=pipeline.gitlab_pipeline_id,
                status=pipeline.status,
                ref=pipeline.ref,
                sha=pipeline.sha,
                source_type=pipeline.source_type,
                started_at=pipeline.started_at,
                finished_at=pipeline.finished_at,
                duration=pipeline.duration,
            )
            for pipeline in pipelines
        ],
        reports=[
            RadarReport(
                pipeline_id=report.pipeline_id,
                report_type=report.type,
                summary_json=report.summary_json,
            )
            for report in reports
        ],
        team_names=[team.name for team in teams],
        team_project_mappings=[
            RadarTeamProjectMapping(team_name=team_by_id[row.team_id].name, project_id=row.project_id)
            for row in team_project_rows
            if row.team_id in team_by_id
        ],
        merge_requests_by_project={},
        weeks=max(2, min(12, weeks)),
    )
    return payload


def _incident_counts_by_project(rows: list[IncidentLinkModel]) -> dict[int, int]:
    counts: dict[int, int] = defaultdict(int)
    for row in rows:
        if (row.status or "").lower() == "resolved":
            continue
        counts[row.project_id] += 1
    return dict(counts)


async def _count_active_release_policies(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> int:
    stmt = select(func.count(ReleaseGatePolicyModel.id)).where(
        and_(
            ReleaseGatePolicyModel.owner_user_id == owner_user_id,
            ReleaseGatePolicyModel.active.is_(True),
        )
    )
    if workspace_id is not None:
        stmt = stmt.where(ReleaseGatePolicyModel.workspace_group_id == workspace_id)
    return int((await session.execute(stmt)).scalar_one())

async def _load_ops_overview_rows(
    *,
    session: AsyncSession,
    owner_user_id: int,
    workspace_id: int | None,
) -> OpsOverviewRows:
    return {
        "release_gates": await _list_release_gate_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "alert_rules": await _list_alert_rule_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "incident_links": await _list_incident_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "templates": await _list_template_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "audits": await _list_audit_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
            limit=80,
        ),
        "release_trains": await _list_release_train_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "remediation_playbooks": await _list_remediation_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "service_slos": await _list_service_slo_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "guardrails": await _list_guardrail_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "dependencies": await _list_dependency_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "postmortems": await _list_postmortem_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "change_approvals": await _list_change_approval_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
        "webhooks": await _list_webhook_rows(
            session=session,
            owner_user_id=owner_user_id,
            workspace_id=workspace_id,
        ),
    }


def _open_incident_rows(incident_rows: list[IncidentLinkModel]) -> list[IncidentLinkModel]:
    return [row for row in incident_rows if (row.status or "").lower() != "resolved"]


def _build_ops_overview_analytics_payloads(
    *,
    workspace_id: int | None,
    weeks: int,
    days: int,
    generated_at: str,
    pipelines: list[Any],
    teams: list[Any],
    team_project_rows: list[Any],
    radar_payload: dict[str, Any],
    dora_metrics: dict[str, Any],
    release_gate_rows: list[ReleaseGatePolicyModel],
    incident_rows: list[IncidentLinkModel],
    incident_count_by_project: dict[int, int],
    open_incident_rows: list[IncidentLinkModel],
) -> dict[str, dict[str, Any]]:
    return {
        "risk_simulation_preview": _build_risk_simulation_preview_payload(
            workspace_id=workspace_id,
            weeks=weeks,
            generated_at=generated_at,
            radar_payload=radar_payload,
            incident_count_by_project=incident_count_by_project,
        ),
        "weekly_summary": _build_weekly_summary_payload(
            workspace_id=workspace_id,
            weeks=weeks,
            days=days,
            radar_payload=radar_payload,
            dora_metrics=dora_metrics,
            open_incidents=len(open_incident_rows),
            active_release_policies=sum(1 for row in release_gate_rows if row.active),
        ),
        "quality_cost": _build_quality_cost_payload(
            workspace_id=workspace_id,
            days=days,
            hourly_rate_usd=120.0,
            pipelines=pipelines,
            incident_rows=incident_rows,
            dora_metrics=dora_metrics,
        ),
        "predictive_risk": _build_predictive_risk_payload(
            workspace_id=workspace_id,
            weeks=weeks,
            generated_at=generated_at,
            radar_payload=radar_payload,
            incident_count_by_project=incident_count_by_project,
        ),
        "status_page": _build_status_page_payload(
            workspace_id=workspace_id,
            generated_at=generated_at,
            radar_payload=radar_payload,
            open_incident_rows=open_incident_rows,
        ),
        "team_benchmarking": _build_team_benchmarking_payload(
            workspace_id=workspace_id,
            days=days,
            pipelines=pipelines,
            teams=teams,
            team_project_rows=team_project_rows,
            radar_payload=radar_payload,
        ),
    }


def _build_risk_simulation_preview_payload(
    *,
    workspace_id: int | None,
    weeks: int,
    generated_at: str,
    radar_payload: dict[str, Any],
    incident_count_by_project: dict[int, int],
) -> dict[str, Any]:
    return {
        "workspace_id": workspace_id,
        "weeks": weeks,
        "generated_at": generated_at,
        **simulate_risk_decisions(
            projects=radar_payload.get("projects", []),
            incident_count_by_project=incident_count_by_project,
            release_risk_high_above=60.0,
            release_risk_medium_above=40.0,
            release_readiness_min_pct=75.0,
            delivery_confidence_min_pct=70.0,
            block_on_open_incidents=True,
        ),
    }


def _build_weekly_summary_payload(
    *,
    workspace_id: int | None,
    weeks: int,
    days: int,
    radar_payload: dict[str, Any],
    dora_metrics: dict[str, Any],
    open_incidents: int,
    active_release_policies: int,
) -> dict[str, Any]:
    summary = build_weekly_executive_summary(
        radar_payload=radar_payload,
        dora_metrics=dora_metrics,
        open_incidents=open_incidents,
        active_release_policies=active_release_policies,
    )
    summary["workspace_id"] = workspace_id
    summary["weeks"] = weeks
    summary["days"] = days
    return summary


def _build_quality_cost_payload(
    *,
    workspace_id: int | None,
    days: int,
    hourly_rate_usd: float,
    pipelines: list[Any],
    incident_rows: list[IncidentLinkModel],
    dora_metrics: dict[str, Any],
) -> dict[str, Any]:
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=days)
    recent_pipelines = [row for row in pipelines if (row.finished_at or row.started_at or now) >= cutoff]
    failed_pipelines = [row for row in recent_pipelines if (row.status or "").lower() in {"failed", "canceled"}]

    incidents_total = len(incident_rows)
    open_incidents = len(_open_incident_rows(incident_rows))
    mttr_hours = float(dora_metrics.get("mttr_hours", {}).get("value") or 0.0)
    incident_recovery_hours = round(mttr_hours * incidents_total, 2)
    failure_rework_hours = round(len(failed_pipelines) * 1.5, 2)
    coordination_hours = round(incidents_total * 2.0, 2)
    total_hours = round(incident_recovery_hours + failure_rework_hours + coordination_hours, 2)

    return {
        "workspace_id": workspace_id,
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


def _build_predictive_risk_payload(
    *,
    workspace_id: int | None,
    weeks: int,
    generated_at: str,
    radar_payload: dict[str, Any],
    incident_count_by_project: dict[int, int],
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for project in radar_payload.get("projects", []):
        project_id = int(project.get("project_id", 0) or 0)
        if project_id <= 0:
            continue
        base_risk = float(project.get("release_risk", {}).get("score", 0.0))
        regressions = len(project.get("regressions", []))
        confidence_gap = max(0.0, 70.0 - float(project.get("delivery_confidence_pct", 0.0)))
        incidents = int(incident_count_by_project.get(project_id, 0))
        projected_risk = min(100.0, round(base_risk + (regressions * 7.5) + (incidents * 8.0) + (confidence_gap * 0.4), 1))
        level = "high" if projected_risk >= 70 else "medium" if projected_risk >= 45 else "low"
        items.append(
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
    items.sort(key=lambda row: row["projected_risk_score"], reverse=True)
    return {
        "workspace_id": workspace_id,
        "weeks": weeks,
        "generated_at": generated_at,
        "count": len(items),
        "items": items,
    }


def _build_status_page_payload(
    *,
    workspace_id: int | None,
    generated_at: str,
    radar_payload: dict[str, Any],
    open_incident_rows: list[IncidentLinkModel],
) -> dict[str, Any]:
    overall_status = "operational"
    if len(open_incident_rows) >= 6:
        overall_status = "major_outage"
    elif len(open_incident_rows) >= 3:
        overall_status = "degraded"

    return {
        "workspace_id": workspace_id,
        "generated_at": generated_at,
        "overall_status": overall_status,
        "open_incidents": len(open_incident_rows),
        "message": (
            "System fully operational"
            if overall_status == "operational"
            else "Some services are degraded"
            if overall_status == "degraded"
            else "Major disruption under investigation"
        ),
        "services": [
            {
                "service": item.get("project"),
                "status": item.get("status"),
                "reason": item.get("reason"),
            }
            for item in radar_payload.get("project_status", [])[:10]
        ],
        "active_incidents": [
            {
                "id": row.id,
                "project_id": row.project_id,
                "title": row.title,
                "status": row.status,
                "external_issue_id": row.external_issue_id,
                "external_url": row.external_url,
            }
            for row in open_incident_rows[:20]
        ],
    }


def _build_team_benchmarking_payload(
    *,
    workspace_id: int | None,
    days: int,
    pipelines: list[Any],
    teams: list[Any],
    team_project_rows: list[Any],
    radar_payload: dict[str, Any],
) -> dict[str, Any]:
    team_by_id = {team.id: team for team in teams}
    team_indicator_rows = {
        str(row.get("team")): row
        for row in radar_payload.get("team_quality_indicator", [])
        if isinstance(row, dict)
    }
    team_to_project_ids: dict[str, set[int]] = defaultdict(set)
    for row in team_project_rows:
        team = team_by_id.get(row.team_id)
        if team is not None:
            team_to_project_ids[team.name].add(row.project_id)

    items: list[dict[str, Any]] = []
    for team_name, project_ids in team_to_project_ids.items():
        team_pipelines = [row for row in pipelines if row.project_id in project_ids]
        team_dora = compute_dora_metrics(team_pipelines, days=days)
        team_status_row = team_indicator_rows.get(team_name)
        readiness = float(team_status_row.get("avg_readiness_pct", 0.0)) if isinstance(team_status_row, dict) else 0.0
        dora_class = str(team_dora["overall_classification"])
        dora_score = 4 if dora_class == "elite" else 3 if dora_class == "high" else 2 if dora_class == "medium" else 1
        items.append(
            {
                "team": team_name,
                "project_count": len(project_ids),
                "readiness_avg_pct": round(readiness, 1),
                "dora_classification": dora_class,
                "score": round((dora_score * 20) + (readiness * 0.4), 1),
            }
        )

    items.sort(key=lambda row: row["score"], reverse=True)
    for index, item in enumerate(items, start=1):
        item["rank"] = index
    return {
        "workspace_id": workspace_id,
        "window_days": days,
        "count": len(items),
        "items": items,
    }


def _build_ops_overview_response(
    *,
    generated_at: str,
    workspace_id: int | None,
    weeks: int,
    days: int,
    projects: list[Any],
    pipelines: list[Any],
    radar_payload: dict[str, Any],
    dora_metrics: dict[str, Any],
    weekly_summary: dict[str, Any],
    ownership_heatmap: dict[str, Any],
    risk_simulation_preview: dict[str, Any],
    quality_cost: dict[str, Any],
    predictive_risk: dict[str, Any],
    status_page: dict[str, Any],
    team_benchmarking: dict[str, Any],
    rows: OpsOverviewRows,
) -> dict[str, Any]:
    projects_by_id = {project.id: project for project in projects}
    pipeline_by_id = {pipeline.id: pipeline for pipeline in pipelines}

    incident_links = [
        _serialize_incident_link(
            row,
            project_name=(projects_by_id.get(row.project_id).path_with_namespace if projects_by_id.get(row.project_id) else None),
            gitlab_pipeline_id=(pipeline_by_id.get(row.pipeline_id).gitlab_pipeline_id if row.pipeline_id and pipeline_by_id.get(row.pipeline_id) else None),
        )
        for row in rows["incident_links"]
    ]
    dependencies = [
        _serialize_service_dependency(
            row,
            source_project=(projects_by_id.get(row.source_project_id).path_with_namespace if projects_by_id.get(row.source_project_id) else None),
            target_project=(projects_by_id.get(row.target_project_id).path_with_namespace if projects_by_id.get(row.target_project_id) else None),
        )
        for row in rows["dependencies"]
    ]

    return {
        "generated_at": generated_at,
        "workspace_id": workspace_id,
        "weeks": weeks,
        "days": days,
        "release_gate_policies": [_serialize_release_gate(row) for row in rows["release_gates"]],
        "alert_rules": [_serialize_alert_rule(row) for row in rows["alert_rules"]],
        "trend_regressions": {
            "quality_trend": radar_payload.get("quality_trend", []),
            "regressions": radar_payload.get("regressions", []),
            "summary": radar_payload.get("summary", {}),
        },
        "dora_metrics": dora_metrics,
        "weekly_summary": weekly_summary,
        "incident_links": incident_links,
        "release_trains": [_serialize_release_train_event(row) for row in rows["release_trains"]],
        "remediation_playbooks": [_serialize_remediation_playbook(row) for row in rows["remediation_playbooks"]],
        "slo_budgets": [_serialize_service_slo(row) for row in rows["service_slos"]],
        "guardrails": [_serialize_rollout_guardrail(row) for row in rows["guardrails"]],
        "dependencies": dependencies,
        "postmortems": [_serialize_postmortem(row) for row in rows["postmortems"]],
        "change_approvals": [_serialize_change_approval(row) for row in rows["change_approvals"]],
        "webhook_automations": [_serialize_webhook_automation(row) for row in rows["webhooks"]],
        "quality_cost": quality_cost,
        "predictive_risk": predictive_risk,
        "status_page": status_page,
        "team_benchmarking": team_benchmarking,
        "ownership_heatmap": ownership_heatmap,
        "risk_simulation_preview": risk_simulation_preview,
        "workspace_templates": [_serialize_workspace_template(row) for row in rows["templates"]],
        "audit_log": [_serialize_audit_event(row) for row in rows["audits"]],
        "release_risk": radar_payload.get("release_risk", {}),
        "project_status": radar_payload.get("project_status", []),
    }


# Keep star-import compatibility for route modules that use helper names with a
# leading underscore.
__all__ = [
    name
    for name, value in globals().items()
    if name.startswith("_") and not name.startswith("__") and callable(value)
]
