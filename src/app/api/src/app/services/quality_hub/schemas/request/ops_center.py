from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

OpsProductEventName = Literal[
    "quality_dashboard_opened",
    "quality_score_threshold_breached",
    "sla_risk_detected",
    "sla_alert_acknowledged",
    "incident_timeline_opened",
    "timeline_event_filtered",
    "rca_started",
    "rca_hypothesis_confirmed",
    "runbook_started",
    "runbook_step_failed",
    "runbook_completed",
    "release_selected",
    "post_release_regression_detected",
    "impact_heatmap_opened",
    "high_impact_segment_clicked",
    "possible_duplicate_found",
    "duplicate_incident_merged",
    "postmortem_created",
    "action_item_assigned",
    "action_item_closed",
    "owner_missing_detected",
    "escalation_triggered",
    "quality_debt_item_created",
    "quality_debt_item_resolved",
    "drill_started",
    "drill_completed",
    "drill_score_shared",
]


class ProductEventCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    scenario: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$")
    event_name: OpsProductEventName
    source: str = Field(default="ops_center_dashboard", min_length=2, max_length=64)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class ReleaseGatePolicyCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=255)
    workspace_id: int | None = Field(default=None, gt=0)
    team_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    max_release_risk_score: float = Field(default=59.0, ge=0, le=100)
    min_release_readiness_pct: float = Field(default=75.0, ge=0, le=100)
    min_delivery_confidence_pct: float = Field(default=70.0, ge=0, le=100)
    require_green_build: bool = True
    block_on_open_incidents: bool = True
    active: bool = True


class ReleaseGatePolicyUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=255)
    workspace_id: int | None = Field(default=None, gt=0)
    team_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    max_release_risk_score: float | None = Field(default=None, ge=0, le=100)
    min_release_readiness_pct: float | None = Field(default=None, ge=0, le=100)
    min_delivery_confidence_pct: float | None = Field(default=None, ge=0, le=100)
    require_green_build: bool | None = None
    block_on_open_incidents: bool | None = None
    active: bool | None = None


class AlertRuleCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=255)
    workspace_id: int | None = Field(default=None, gt=0)
    team_id: int | None = Field(default=None, gt=0)
    severity: str = Field(default="high", pattern="^(low|medium|high)$")
    channel: str = Field(default="slack", pattern="^(slack|teams|email|webhook)$")
    condition_type: str = Field(default="release_risk", max_length=64)
    threshold_value: float = Field(default=60.0)
    escalation_minutes: int = Field(default=60, ge=1, le=10080)
    recipients: list[str] = Field(default_factory=list)
    active: bool = True


class AlertRuleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=255)
    workspace_id: int | None = Field(default=None, gt=0)
    team_id: int | None = Field(default=None, gt=0)
    severity: str | None = Field(default=None, pattern="^(low|medium|high)$")
    channel: str | None = Field(default=None, pattern="^(slack|teams|email|webhook)$")
    condition_type: str | None = Field(default=None, max_length=64)
    threshold_value: float | None = None
    escalation_minutes: int | None = Field(default=None, ge=1, le=10080)
    recipients: list[str] | None = None
    active: bool | None = None


class IncidentLinkCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int = Field(gt=0)
    pipeline_id: int | None = Field(default=None, gt=0)
    provider: str = Field(default="gitlab", max_length=32)
    external_issue_id: str = Field(min_length=1, max_length=255)
    external_url: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=255)
    status: str = Field(default="open", pattern="^(open|monitoring|resolved)$")


class IncidentLinkUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str | None = Field(default=None, max_length=32)
    external_issue_id: str | None = Field(default=None, min_length=1, max_length=255)
    external_url: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, pattern="^(open|monitoring|resolved)$")


class WorkspaceTemplateCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    definition_json: dict[str, Any] = Field(default_factory=dict)


class WorkspaceTemplateUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    definition_json: dict[str, Any] | None = None


class RiskSimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    weeks: int = Field(default=6, ge=2, le=12)
    release_risk_high_above: float = Field(default=60.0, ge=0, le=100)
    release_risk_medium_above: float = Field(default=40.0, ge=0, le=100)
    release_readiness_min_pct: float = Field(default=75.0, ge=0, le=100)
    delivery_confidence_min_pct: float = Field(default=70.0, ge=0, le=100)
    block_on_open_incidents: bool = True


class ReleaseTrainEventCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=2, max_length=255)
    event_type: str = Field(default="release", pattern="^(release|freeze|maintenance)$")
    status: str = Field(default="planned", pattern="^(planned|in_progress|completed|canceled)$")
    start_at: str
    end_at: str
    notes: str | None = Field(default=None, max_length=4000)


class ReleaseTrainEventUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=2, max_length=255)
    event_type: str | None = Field(default=None, pattern="^(release|freeze|maintenance)$")
    status: str | None = Field(default=None, pattern="^(planned|in_progress|completed|canceled)$")
    start_at: str | None = None
    end_at: str | None = None
    notes: str | None = Field(default=None, max_length=4000)


class RemediationPlaybookCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    team_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=2, max_length=255)
    trigger_type: str = Field(default="alert_rule", max_length=64)
    action_type: str = Field(default="notify", max_length=64)
    config_json: dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class RemediationPlaybookUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    team_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    trigger_type: str | None = Field(default=None, max_length=64)
    action_type: str | None = Field(default=None, max_length=64)
    config_json: dict[str, Any] | None = None
    active: bool | None = None


class ServiceSLOCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int = Field(gt=0)
    service_name: str = Field(min_length=2, max_length=255)
    slo_target_pct: float = Field(default=99.9, ge=0, le=100)
    window_days: int = Field(default=30, ge=1, le=365)
    error_budget_remaining_pct: float = Field(default=100.0, ge=0, le=100)
    availability_pct: float = Field(default=100.0, ge=0, le=100)
    burn_rate: float = Field(default=0.0, ge=0)
    status: str = Field(default="healthy", pattern="^(healthy|warning|exhausted)$")


class ServiceSLOUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    service_name: str | None = Field(default=None, min_length=2, max_length=255)
    slo_target_pct: float | None = Field(default=None, ge=0, le=100)
    window_days: int | None = Field(default=None, ge=1, le=365)
    error_budget_remaining_pct: float | None = Field(default=None, ge=0, le=100)
    availability_pct: float | None = Field(default=None, ge=0, le=100)
    burn_rate: float | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, pattern="^(healthy|warning|exhausted)$")


class RolloutGuardrailCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=255)
    canary_required: bool = True
    canary_success_rate_min_pct: float = Field(default=98.0, ge=0, le=100)
    max_flag_rollout_pct: float = Field(default=50.0, ge=0, le=100)
    block_if_error_budget_below_pct: float = Field(default=25.0, ge=0, le=100)
    active: bool = True


class RolloutGuardrailUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    canary_required: bool | None = None
    canary_success_rate_min_pct: float | None = Field(default=None, ge=0, le=100)
    max_flag_rollout_pct: float | None = Field(default=None, ge=0, le=100)
    block_if_error_budget_below_pct: float | None = Field(default=None, ge=0, le=100)
    active: bool | None = None


class ServiceDependencyCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    source_project_id: int = Field(gt=0)
    target_project_id: int = Field(gt=0)
    criticality: str = Field(default="medium", pattern="^(low|medium|high)$")


class ServiceDependencyUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    criticality: str | None = Field(default=None, pattern="^(low|medium|high)$")


class PostmortemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    incident_link_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=2, max_length=255)
    summary: str = Field(min_length=2)
    root_cause: str | None = None
    impact: str | None = None
    action_items: list[str] = Field(default_factory=list)
    status: str = Field(default="draft", pattern="^(draft|published|closed)$")


class PostmortemUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    incident_link_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=2, max_length=255)
    summary: str | None = None
    root_cause: str | None = None
    impact: str | None = None
    action_items: list[str] | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|closed)$")


class ChangeApprovalCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    release_version: str = Field(min_length=1, max_length=128)
    required_roles: list[str] = Field(default_factory=list)
    requested_by: str | None = Field(default=None, max_length=255)
    status: str = Field(default="pending", pattern="^(pending|approved|rejected)$")


class ChangeApprovalUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    release_version: str | None = Field(default=None, min_length=1, max_length=128)
    required_roles: list[str] | None = None
    approvals: list[dict[str, Any]] | None = None
    requested_by: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, pattern="^(pending|approved|rejected)$")


class WebhookAutomationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=2, max_length=255)
    event_type: str = Field(default="release_blocked", max_length=64)
    url: str = Field(min_length=1, max_length=1000)
    secret_ref: str | None = Field(default=None, max_length=255)
    headers_json: dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class WebhookAutomationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    event_type: str | None = Field(default=None, max_length=64)
    url: str | None = Field(default=None, min_length=1, max_length=1000)
    secret_ref: str | None = Field(default=None, max_length=255)
    headers_json: dict[str, Any] | None = None
    active: bool | None = None
    last_status: str | None = Field(default=None, max_length=32)
