# ruff: noqa: B008,PLR0913,F403,F405

from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.services.quality_hub.api.ops_center.router import router
from app.services.quality_hub.api.ops_center.services import *
from app.services.quality_hub.api.ops_center.utils import *
from app.services.quality_hub.infrastructure.models import UserModel
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
from app.services.quality_hub.schemas.request.ops_center import (
    AlertRuleCreateRequest,
    AlertRuleUpdateRequest,
    ChangeApprovalCreateRequest,
    ChangeApprovalUpdateRequest,
    IncidentLinkCreateRequest,
    IncidentLinkUpdateRequest,
    PostmortemCreateRequest,
    PostmortemUpdateRequest,
    ProductEventCreateRequest,
    ReleaseGatePolicyCreateRequest,
    ReleaseGatePolicyUpdateRequest,
    ReleaseTrainEventCreateRequest,
    ReleaseTrainEventUpdateRequest,
    RemediationPlaybookCreateRequest,
    RemediationPlaybookUpdateRequest,
    RolloutGuardrailCreateRequest,
    RolloutGuardrailUpdateRequest,
    ServiceDependencyCreateRequest,
    ServiceDependencyUpdateRequest,
    ServiceSLOCreateRequest,
    ServiceSLOUpdateRequest,
    WebhookAutomationCreateRequest,
    WebhookAutomationUpdateRequest,
    WorkspaceTemplateCreateRequest,
    WorkspaceTemplateUpdateRequest,
)


@router.get("/release-gates")
async def list_release_gates(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_release_gate_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_release_gate(row) for row in rows]


@router.post("/release-gates")
async def create_release_gate(
    payload: ReleaseGatePolicyCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    await _validate_team_and_project_scope(
        repository=repository,
        team_id=payload.team_id,
        project_id=payload.project_id,
    )

    row = ReleaseGatePolicyModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        team_id=payload.team_id,
        project_id=payload.project_id,
        name=payload.name,
        max_release_risk_score=payload.max_release_risk_score,
        min_release_readiness_pct=payload.min_release_readiness_pct,
        min_delivery_confidence_pct=payload.min_delivery_confidence_pct,
        require_green_build=payload.require_green_build,
        block_on_open_incidents=payload.block_on_open_incidents,
        active=payload.active,
    )
    session.add(row)
    await session.flush()

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="release_gate_policy",
        resource_id=row.id,
        action="create",
        details_json={"name": payload.name},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_release_gate(row)


@router.patch("/release-gates/{policy_id}")
async def update_release_gate(
    policy_id: int,
    payload: ReleaseGatePolicyUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(ReleaseGatePolicyModel).where(
                and_(
                    ReleaseGatePolicyModel.id == policy_id,
                    ReleaseGatePolicyModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release gate policy not found")

    updates = payload.model_dump(exclude_unset=True)
    workspace_id_update = updates.pop("workspace_id", None) if "workspace_id" in updates else None
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=workspace_id_update,
        )
        row.workspace_group_id = resolved_workspace_id

    team_id = updates.get("team_id", row.team_id)
    project_id = updates.get("project_id", row.project_id)
    await _validate_team_and_project_scope(repository=repository, team_id=team_id, project_id=project_id)

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="release_gate_policy",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_release_gate(row)


@router.delete("/release-gates/{policy_id}")
async def delete_release_gate(
    policy_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(ReleaseGatePolicyModel).where(
                and_(
                    ReleaseGatePolicyModel.id == policy_id,
                    ReleaseGatePolicyModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release gate policy not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="release_gate_policy",
        resource_id=row.id,
        action="delete",
        details_json={"name": row.name},
    )

    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/alert-rules")
async def list_alert_rules(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_alert_rule_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_alert_rule(row) for row in rows]


@router.post("/alert-rules")
async def create_alert_rule(
    payload: AlertRuleCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    if payload.team_id is not None and await repository.get_team(payload.team_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    row = AlertRuleModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        team_id=payload.team_id,
        name=payload.name,
        severity=payload.severity,
        channel=payload.channel,
        condition_type=payload.condition_type,
        threshold_value=payload.threshold_value,
        escalation_minutes=payload.escalation_minutes,
        recipients_json=payload.recipients,
        active=payload.active,
    )
    session.add(row)
    await session.flush()

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="alert_rule",
        resource_id=row.id,
        action="create",
        details_json={"name": payload.name, "channel": payload.channel},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_alert_rule(row)


@router.patch("/alert-rules/{rule_id}")
async def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(AlertRuleModel).where(
                and_(
                    AlertRuleModel.id == rule_id,
                    AlertRuleModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")

    updates = payload.model_dump(exclude_unset=True)
    workspace_id_update = updates.pop("workspace_id", None) if "workspace_id" in updates else None
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=workspace_id_update,
        )
        row.workspace_group_id = resolved_workspace_id

    team_id = updates.get("team_id", row.team_id)
    if team_id is not None and await repository.get_team(team_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    for field, value in updates.items():
        if field == "recipients":
            row.recipients_json = value
            continue
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="alert_rule",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_alert_rule(row)


@router.delete("/alert-rules/{rule_id}")
async def delete_alert_rule(
    rule_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(AlertRuleModel).where(
                and_(
                    AlertRuleModel.id == rule_id,
                    AlertRuleModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="alert_rule",
        resource_id=row.id,
        action="delete",
        details_json={"name": row.name},
    )

    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/incident-links")
async def list_incident_links(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_incident_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )

    projects = {project.id: project for project in await repository.list_projects()}
    pipeline_ids = {row.pipeline_id for row in rows if row.pipeline_id is not None}
    pipeline_rows = (
        list((await session.execute(select(PipelineModel).where(PipelineModel.id.in_(pipeline_ids)))).scalars().all())
        if pipeline_ids
        else []
    )
    pipeline_by_id = {row.id: row for row in pipeline_rows}

    return [
        _serialize_incident_link(
            row,
            project_name=(projects.get(row.project_id).path_with_namespace if projects.get(row.project_id) else None),
            gitlab_pipeline_id=(pipeline_by_id.get(row.pipeline_id).gitlab_pipeline_id if row.pipeline_id and pipeline_by_id.get(row.pipeline_id) else None),
        )
        for row in rows
    ]


@router.post("/incident-links")
async def create_incident_link(
    payload: IncidentLinkCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )

    project = await repository.get_project(payload.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if payload.pipeline_id is not None:
        pipeline = await session.get(PipelineModel, payload.pipeline_id)
        if pipeline is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
        if pipeline.project_id != payload.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pipeline does not belong to project")

    row = IncidentLinkModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        project_id=payload.project_id,
        pipeline_id=payload.pipeline_id,
        provider=payload.provider,
        external_issue_id=payload.external_issue_id,
        external_url=payload.external_url,
        title=payload.title,
        status=payload.status,
    )
    session.add(row)
    await session.flush()

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="incident_link",
        resource_id=row.id,
        action="create",
        details_json={"project_id": payload.project_id, "external_issue_id": payload.external_issue_id},
    )

    await session.commit()
    await session.refresh(row)

    pipeline_gitlab_id: int | None = None
    if payload.pipeline_id is not None:
        pipeline = await session.get(PipelineModel, payload.pipeline_id)
        pipeline_gitlab_id = pipeline.gitlab_pipeline_id if pipeline is not None else None

    return _serialize_incident_link(
        row,
        project_name=project.path_with_namespace,
        gitlab_pipeline_id=pipeline_gitlab_id,
    )


@router.patch("/incident-links/{link_id}")
async def update_incident_link(
    link_id: int,
    payload: IncidentLinkUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    row = (
        await session.execute(
            select(IncidentLinkModel).where(
                and_(
                    IncidentLinkModel.id == link_id,
                    IncidentLinkModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident link not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="incident_link",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )

    await session.commit()
    await session.refresh(row)

    repository = QualityHubRepository(session)
    project = await repository.get_project(row.project_id)
    pipeline = await session.get(PipelineModel, row.pipeline_id) if row.pipeline_id else None

    return _serialize_incident_link(
        row,
        project_name=project.path_with_namespace if project else None,
        gitlab_pipeline_id=pipeline.gitlab_pipeline_id if pipeline else None,
    )


@router.delete("/incident-links/{link_id}")
async def delete_incident_link(
    link_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(IncidentLinkModel).where(
                and_(
                    IncidentLinkModel.id == link_id,
                    IncidentLinkModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident link not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="incident_link",
        resource_id=row.id,
        action="delete",
        details_json={"project_id": row.project_id, "external_issue_id": row.external_issue_id},
    )

    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/workspace-templates")
async def list_workspace_templates(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_template_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_workspace_template(row) for row in rows]


@router.post("/workspace-templates")
async def create_workspace_template(
    payload: WorkspaceTemplateCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )

    row = WorkspaceTemplateModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        name=payload.name,
        description=payload.description,
        definition_json=payload.definition_json,
    )
    session.add(row)
    await session.flush()

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="workspace_template",
        resource_id=row.id,
        action="create",
        details_json={"name": payload.name},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_workspace_template(row)


@router.patch("/workspace-templates/{template_id}")
async def update_workspace_template(
    template_id: int,
    payload: WorkspaceTemplateUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(WorkspaceTemplateModel).where(
                and_(
                    WorkspaceTemplateModel.id == template_id,
                    WorkspaceTemplateModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace template not found")

    updates = payload.model_dump(exclude_unset=True)
    workspace_id_update = updates.pop("workspace_id", None) if "workspace_id" in updates else None
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=workspace_id_update,
        )
        row.workspace_group_id = resolved_workspace_id

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="workspace_template",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_workspace_template(row)


@router.delete("/workspace-templates/{template_id}")
async def delete_workspace_template(
    template_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(WorkspaceTemplateModel).where(
                and_(
                    WorkspaceTemplateModel.id == template_id,
                    WorkspaceTemplateModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace template not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="workspace_template",
        resource_id=row.id,
        action="delete",
        details_json={"name": row.name},
    )

    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/release-trains")
async def list_release_trains(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_release_train_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_release_train_event(row) for row in rows]


@router.post("/release-trains")
async def create_release_train(
    payload: ReleaseTrainEventCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )

    project_id = payload.project_id
    if project_id is not None and await repository.get_project(project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    start_at = _parse_datetime_or_400(payload.start_at, "start_at")
    end_at = _parse_datetime_or_400(payload.end_at, "end_at")
    if end_at <= start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_at must be after start_at")

    row = ReleaseTrainEventModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        project_id=project_id,
        title=payload.title,
        event_type=payload.event_type,
        status=payload.status,
        start_at=start_at,
        end_at=end_at,
        notes=payload.notes,
    )
    session.add(row)
    await session.flush()

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="release_train_event",
        resource_id=row.id,
        action="create",
        details_json={"title": payload.title, "event_type": payload.event_type},
    )

    await session.commit()
    await session.refresh(row)
    return _serialize_release_train_event(row)


@router.patch("/release-trains/{event_id}")
async def update_release_train(
    event_id: int,
    payload: ReleaseTrainEventUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(ReleaseTrainEventModel).where(
                and_(
                    ReleaseTrainEventModel.id == event_id,
                    ReleaseTrainEventModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release train event not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id

    if "project_id" in updates and updates["project_id"] is not None and await repository.get_project(int(updates["project_id"])) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if "start_at" in updates:
        row.start_at = _parse_datetime_or_400(updates.pop("start_at"), "start_at")
    if "end_at" in updates:
        row.end_at = _parse_datetime_or_400(updates.pop("end_at"), "end_at")
    if row.end_at <= row.start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_at must be after start_at")

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="release_train_event",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_release_train_event(row)


@router.delete("/release-trains/{event_id}")
async def delete_release_train(
    event_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(ReleaseTrainEventModel).where(
                and_(
                    ReleaseTrainEventModel.id == event_id,
                    ReleaseTrainEventModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release train event not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="release_train_event",
        resource_id=row.id,
        action="delete",
        details_json={"title": row.title},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/remediation-playbooks")
async def list_remediation_playbooks(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_remediation_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_remediation_playbook(row) for row in rows]


@router.post("/remediation-playbooks")
async def create_remediation_playbook(
    payload: RemediationPlaybookCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    if payload.team_id is not None and await repository.get_team(payload.team_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    row = RemediationPlaybookModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        team_id=payload.team_id,
        name=payload.name,
        trigger_type=payload.trigger_type,
        action_type=payload.action_type,
        config_json=payload.config_json,
        active=payload.active,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="remediation_playbook",
        resource_id=row.id,
        action="create",
        details_json={"name": payload.name, "trigger_type": payload.trigger_type},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_remediation_playbook(row)


@router.patch("/remediation-playbooks/{playbook_id}")
async def update_remediation_playbook(
    playbook_id: int,
    payload: RemediationPlaybookUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(RemediationPlaybookModel).where(
                and_(
                    RemediationPlaybookModel.id == playbook_id,
                    RemediationPlaybookModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remediation playbook not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id
    if "team_id" in updates and updates["team_id"] is not None and await repository.get_team(int(updates["team_id"])) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="remediation_playbook",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_remediation_playbook(row)


@router.delete("/remediation-playbooks/{playbook_id}")
async def delete_remediation_playbook(
    playbook_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(RemediationPlaybookModel).where(
                and_(
                    RemediationPlaybookModel.id == playbook_id,
                    RemediationPlaybookModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remediation playbook not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="remediation_playbook",
        resource_id=row.id,
        action="delete",
        details_json={"name": row.name},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/slo-budgets")
async def list_slo_budgets(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_service_slo_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_service_slo(row) for row in rows]


@router.post("/slo-budgets")
async def create_slo_budget(
    payload: ServiceSLOCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    if await repository.get_project(payload.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    row = ServiceSLOModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        project_id=payload.project_id,
        service_name=payload.service_name,
        slo_target_pct=payload.slo_target_pct,
        window_days=payload.window_days,
        error_budget_remaining_pct=payload.error_budget_remaining_pct,
        availability_pct=payload.availability_pct,
        burn_rate=payload.burn_rate,
        status=payload.status,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="service_slo",
        resource_id=row.id,
        action="create",
        details_json={"service_name": payload.service_name, "project_id": payload.project_id},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_service_slo(row)


@router.patch("/slo-budgets/{slo_id}")
async def update_slo_budget(
    slo_id: int,
    payload: ServiceSLOUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(ServiceSLOModel).where(
                and_(
                    ServiceSLOModel.id == slo_id,
                    ServiceSLOModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SLO budget not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id
    if "project_id" in updates and updates["project_id"] is not None and await repository.get_project(int(updates["project_id"])) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="service_slo",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_service_slo(row)


@router.delete("/slo-budgets/{slo_id}")
async def delete_slo_budget(
    slo_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(ServiceSLOModel).where(
                and_(
                    ServiceSLOModel.id == slo_id,
                    ServiceSLOModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SLO budget not found")
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="service_slo",
        resource_id=row.id,
        action="delete",
        details_json={"service_name": row.service_name},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/guardrails")
async def list_guardrails(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_guardrail_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_rollout_guardrail(row) for row in rows]


@router.post("/guardrails")
async def create_guardrail(
    payload: RolloutGuardrailCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    if await repository.get_project(payload.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    row = RolloutGuardrailModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        project_id=payload.project_id,
        name=payload.name,
        canary_required=payload.canary_required,
        canary_success_rate_min_pct=payload.canary_success_rate_min_pct,
        max_flag_rollout_pct=payload.max_flag_rollout_pct,
        block_if_error_budget_below_pct=payload.block_if_error_budget_below_pct,
        active=payload.active,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="rollout_guardrail",
        resource_id=row.id,
        action="create",
        details_json={"name": payload.name, "project_id": payload.project_id},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_rollout_guardrail(row)


@router.patch("/guardrails/{guardrail_id}")
async def update_guardrail(
    guardrail_id: int,
    payload: RolloutGuardrailUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(RolloutGuardrailModel).where(
                and_(
                    RolloutGuardrailModel.id == guardrail_id,
                    RolloutGuardrailModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id
    if "project_id" in updates and updates["project_id"] is not None and await repository.get_project(int(updates["project_id"])) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="rollout_guardrail",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_rollout_guardrail(row)


@router.delete("/guardrails/{guardrail_id}")
async def delete_guardrail(
    guardrail_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(RolloutGuardrailModel).where(
                and_(
                    RolloutGuardrailModel.id == guardrail_id,
                    RolloutGuardrailModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="rollout_guardrail",
        resource_id=row.id,
        action="delete",
        details_json={"name": row.name},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/dependencies")
async def list_dependencies(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_dependency_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    projects = {project.id: project for project in await repository.list_projects()}
    return [
        _serialize_service_dependency(
            row,
            source_project=(projects.get(row.source_project_id).path_with_namespace if projects.get(row.source_project_id) else None),
            target_project=(projects.get(row.target_project_id).path_with_namespace if projects.get(row.target_project_id) else None),
        )
        for row in rows
    ]


@router.post("/dependencies")
async def create_dependency(
    payload: ServiceDependencyCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    source_project = await repository.get_project(payload.source_project_id)
    target_project = await repository.get_project(payload.target_project_id)
    if source_project is None or target_project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if payload.source_project_id == payload.target_project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source_project_id and target_project_id must differ")

    row = ServiceDependencyModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        source_project_id=payload.source_project_id,
        target_project_id=payload.target_project_id,
        criticality=payload.criticality,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="service_dependency",
        resource_id=row.id,
        action="create",
        details_json={
            "source_project_id": payload.source_project_id,
            "target_project_id": payload.target_project_id,
            "criticality": payload.criticality,
        },
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_service_dependency(
        row,
        source_project=source_project.path_with_namespace,
        target_project=target_project.path_with_namespace,
    )


@router.patch("/dependencies/{dependency_id}")
async def update_dependency(
    dependency_id: int,
    payload: ServiceDependencyUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(ServiceDependencyModel).where(
                and_(
                    ServiceDependencyModel.id == dependency_id,
                    ServiceDependencyModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id
    if "criticality" in updates:
        row.criticality = str(updates["criticality"])

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="service_dependency",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)

    source_project = await repository.get_project(row.source_project_id)
    target_project = await repository.get_project(row.target_project_id)
    return _serialize_service_dependency(
        row,
        source_project=source_project.path_with_namespace if source_project else None,
        target_project=target_project.path_with_namespace if target_project else None,
    )


@router.delete("/dependencies/{dependency_id}")
async def delete_dependency(
    dependency_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(ServiceDependencyModel).where(
                and_(
                    ServiceDependencyModel.id == dependency_id,
                    ServiceDependencyModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="service_dependency",
        resource_id=row.id,
        action="delete",
        details_json={"source_project_id": row.source_project_id, "target_project_id": row.target_project_id},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/postmortems")
async def list_postmortems(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_postmortem_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_postmortem(row) for row in rows]


@router.post("/postmortems")
async def create_postmortem(
    payload: PostmortemCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    if payload.incident_link_id is not None:
        incident_row = await session.get(IncidentLinkModel, payload.incident_link_id)
        if incident_row is None or incident_row.owner_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident link not found")

    row = PostmortemModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        incident_link_id=payload.incident_link_id,
        title=payload.title,
        summary=payload.summary,
        root_cause=payload.root_cause,
        impact=payload.impact,
        action_items_json=payload.action_items,
        status=payload.status,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="postmortem",
        resource_id=row.id,
        action="create",
        details_json={"title": payload.title},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_postmortem(row)


@router.patch("/postmortems/{postmortem_id}")
async def update_postmortem(
    postmortem_id: int,
    payload: PostmortemUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(PostmortemModel).where(
                and_(
                    PostmortemModel.id == postmortem_id,
                    PostmortemModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Postmortem not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id
    if "incident_link_id" in updates and updates["incident_link_id"] is not None:
        incident_row = await session.get(IncidentLinkModel, int(updates["incident_link_id"]))
        if incident_row is None or incident_row.owner_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident link not found")

    for field, value in updates.items():
        if field == "action_items":
            row.action_items_json = value
            continue
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="postmortem",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_postmortem(row)


@router.delete("/postmortems/{postmortem_id}")
async def delete_postmortem(
    postmortem_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(PostmortemModel).where(
                and_(
                    PostmortemModel.id == postmortem_id,
                    PostmortemModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Postmortem not found")
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="postmortem",
        resource_id=row.id,
        action="delete",
        details_json={"title": row.title},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/change-approvals")
async def list_change_approvals(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_change_approval_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_change_approval(row) for row in rows]


@router.post("/change-approvals")
async def create_change_approval(
    payload: ChangeApprovalCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    if payload.project_id is not None and await repository.get_project(payload.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    row = ChangeApprovalModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        project_id=payload.project_id,
        release_version=payload.release_version,
        required_roles_json=payload.required_roles,
        approvals_json=[],
        status=payload.status,
        requested_by=payload.requested_by,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="change_approval",
        resource_id=row.id,
        action="create",
        details_json={"release_version": payload.release_version},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_change_approval(row)


@router.patch("/change-approvals/{approval_id}")
async def update_change_approval(
    approval_id: int,
    payload: ChangeApprovalUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(ChangeApprovalModel).where(
                and_(
                    ChangeApprovalModel.id == approval_id,
                    ChangeApprovalModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change approval not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id
    if "project_id" in updates and updates["project_id"] is not None and await repository.get_project(int(updates["project_id"])) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for field, value in updates.items():
        if field == "required_roles":
            row.required_roles_json = value
            continue
        if field == "approvals":
            row.approvals_json = value
            continue
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="change_approval",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_change_approval(row)


@router.delete("/change-approvals/{approval_id}")
async def delete_change_approval(
    approval_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(ChangeApprovalModel).where(
                and_(
                    ChangeApprovalModel.id == approval_id,
                    ChangeApprovalModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change approval not found")
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="change_approval",
        resource_id=row.id,
        action="delete",
        details_json={"release_version": row.release_version},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/webhook-automations")
async def list_webhook_automations(
    workspace_id: int | None = Query(default=None, gt=0),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_webhook_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
    )
    return [_serialize_webhook_automation(row) for row in rows]


@router.post("/webhook-automations")
async def create_webhook_automation(
    payload: WebhookAutomationCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )
    row = WebhookAutomationModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        name=payload.name,
        event_type=payload.event_type,
        url=payload.url,
        secret_ref=payload.secret_ref,
        headers_json=payload.headers_json,
        active=payload.active,
    )
    session.add(row)
    await session.flush()
    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="webhook_automation",
        resource_id=row.id,
        action="create",
        details_json={"name": payload.name, "event_type": payload.event_type},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_webhook_automation(row)


@router.patch("/webhook-automations/{automation_id}")
async def update_webhook_automation(
    automation_id: int,
    payload: WebhookAutomationUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    row = (
        await session.execute(
            select(WebhookAutomationModel).where(
                and_(
                    WebhookAutomationModel.id == automation_id,
                    WebhookAutomationModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook automation not found")

    updates = payload.model_dump(exclude_unset=True)
    if "workspace_id" in payload.model_fields_set:
        resolved_workspace_id, _ = await _resolve_workspace_scope(
            repository=repository,
            current_user=current_user,
            workspace_id=updates.pop("workspace_id", None),
        )
        row.workspace_group_id = resolved_workspace_id

    for field, value in updates.items():
        setattr(row, field, value)

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="webhook_automation",
        resource_id=row.id,
        action="update",
        details_json={"updated_fields": sorted(list(payload.model_fields_set))},
    )
    await session.commit()
    await session.refresh(row)
    return _serialize_webhook_automation(row)


@router.delete("/webhook-automations/{automation_id}")
async def delete_webhook_automation(
    automation_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    row = (
        await session.execute(
            select(WebhookAutomationModel).where(
                and_(
                    WebhookAutomationModel.id == automation_id,
                    WebhookAutomationModel.owner_user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook automation not found")

    _append_audit_event(
        session=session,
        owner_user_id=current_user.id,
        workspace_group_id=row.workspace_group_id,
        resource_type="webhook_automation",
        resource_id=row.id,
        action="delete",
        details_json={"name": row.name},
    )
    await session.delete(row)
    await session.commit()
    return {"deleted": True}


@router.get("/product-events")
async def list_product_events(
    workspace_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=200, ge=1, le=2000),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_audit_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
        limit=limit,
        resource_type="product_event",
    )
    return [_serialize_product_event(row) for row in rows]


@router.post("/product-events")
async def create_product_event(
    payload: ProductEventCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    repository = QualityHubRepository(session)
    workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=payload.workspace_id,
    )

    row = AuditEventModel(
        owner_user_id=current_user.id,
        workspace_group_id=workspace_id,
        resource_type="product_event",
        resource_id=None,
        action=payload.event_name,
        details_json={
            "scenario": payload.scenario,
            "source": payload.source,
            "metadata_json": payload.metadata_json,
        },
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _serialize_product_event(row)


@router.get("/audit-log")
async def list_audit_log(
    workspace_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )

    rows = await _list_audit_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
        limit=limit,
    )
    return [_serialize_audit_event(row) for row in rows]


@router.get("/audit-log/export")
async def export_audit_log(
    workspace_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=1000, ge=1, le=10000),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    repository = QualityHubRepository(session)
    resolved_workspace_id, _ = await _resolve_workspace_scope(
        repository=repository,
        current_user=current_user,
        workspace_id=workspace_id,
    )
    rows = await _list_audit_rows(
        session=session,
        owner_user_id=current_user.id,
        workspace_id=resolved_workspace_id,
        limit=limit,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "created_at", "workspace_id", "resource_type", "resource_id", "action", "details_json"])
    for row in rows:
        writer.writerow(
            [
                row.id,
                _iso(row.created_at),
                row.workspace_group_id,
                row.resource_type,
                row.resource_id,
                row.action,
                row.details_json,
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=qualityhub-audit-log.csv"},
    )
