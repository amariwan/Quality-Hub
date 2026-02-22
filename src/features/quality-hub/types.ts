export type DeploymentCluster = {
  cluster_id: number;
  cluster: string | null;
  status: 'ready' | 'progressing' | 'degraded' | 'failed' | 'unknown';
  updated_at: string | null;
};

export type DeploymentEnvironment = {
  env: string;
  status: 'ready' | 'progressing' | 'degraded' | 'failed' | 'unknown';
  clusters: DeploymentCluster[];
};

export type PortfolioItem = {
  project_id: number;
  project: string | null;
  environments: DeploymentEnvironment[];
};

export type PortfolioResponse = {
  user_id: number;
  show_clusters: boolean;
  items: PortfolioItem[];
  workspace_id?: number | null;
};

export type PipelineItem = {
  id: number;
  project_id: number;
  gitlab_pipeline_id: number;
  status: string;
  ref: string | null;
  sha: string | null;
  source_type: string | null;
  deployability_state: 'deployable' | 'not_deployable' | 'partial_unknown';
  failure_reasons: string[];
  missing_signals: string[];
};

export type PipelinesResponse = {
  scope: 'all' | 'readiness';
  count: number;
  items: PipelineItem[];
  workspace_id?: number | null;
};

export type ProjectMatrixResponse = {
  project_id: number;
  user_id: number;
  matrix: Record<string, Array<Record<string, string | number | null>>>;
};

export type Team = {
  id: number;
  name: string;
};

export type TeamMember = {
  id: number;
  team_id: number;
  user_id: number;
  role: string;
};

export type TeamProjectMapping = {
  id: number;
  team_id: number;
  project_id: number;
  team: string | null;
  project: string | null;
};

export type GitlabGroup = {
  id: number;
  path: string;
  full_path: string;
  name: string;
  web_url: string | null;
};

export type WorkspaceGroup = {
  id: number;
  gitlab_group_id: number;
  gitlab_group_path: string;
};

export type GitlabProject = {
  id: number;
  name: string;
  path_with_namespace: string | null;
  default_branch: string | null;
  web_url: string | null;
};

export type WorkspaceChangelogItem = {
  id: number;
  name: string;
  path_with_namespace: string | null;
  default_branch: string | null;
  web_url: string | null;
  changelog: {
    found: boolean;
    path: string | null;
    ref: string | null;
    content: string | null;
    truncated: boolean;
    size_chars: number | null;
    web_url: string | null;
    error: string | null;
  };
  mr_rule: {
    rule_id: string;
    description: string;
    checked_merge_requests: number;
    violations: number;
    items: Array<{
      iid: number;
      title: string;
      web_url: string | null;
      state: string | null;
      has_changelog_change: boolean;
      matching_paths: string[];
      error: string | null;
    }>;
    error: string | null;
  };
};

export type WorkspaceChangelogResponse = {
  workspace_id: number;
  workspace_path: string;
  project_limit: number;
  content_max_chars: number;
  mr_limit: number;
  count: number;
  found_count: number;
  mr_rule: {
    checked_merge_requests: number;
    violations: number;
    projects_with_violations: number;
  };
  items: WorkspaceChangelogItem[];
};

export type GitlabIssue = {
  id: number | null;
  iid: number | null;
  project_id: number | null;
  title: string | null;
  description: string | null;
  state: string | null;
  labels: string[];
  web_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  due_date: string | null;
  author: string | null;
  assignees: string[];
};

export type GitlabIssuesResponse = {
  group_id: number;
  state: 'opened' | 'closed' | 'all';
  count: number;
  items: GitlabIssue[];
};

export type GitlabProjectEvent = {
  id: number | null;
  status: string | null;
  ref: string | null;
  sha: string | null;
  source: string | null;
  updated_at: string | null;
  web_url: string | null;
};

export type GitlabProjectEventsResponse = {
  project_id: number;
  count: number;
  status_counts: Record<string, number>;
  items: GitlabProjectEvent[];
};

export type GitlabProjectInsight = {
  project_id: number;
  open_merge_requests: number;
  pipelines_sampled: number;
  failed_pipelines: number;
  success_pipelines: number;
  running_pipelines: number;
  failure_rate_pct: number;
  latest_pipeline_status: string | null;
  latest_pipeline_updated_at: string | null;
  attention_level: 'low' | 'medium' | 'high';
};

export type GitlabProjectInsightsResponse = {
  count: number;
  totals: {
    projects: number;
    open_merge_requests: number;
    pipelines_sampled: number;
    failed_pipelines: number;
    failure_rate_pct: number;
  };
  items: GitlabProjectInsight[];
};

export type QualityHubRuntimeSettings = {
  api_version: string;
  environment: string;
  gitlab_base_url: string;
  ws_live_default_interval_seconds: number;
  ws_live_max_interval_seconds: number;
  watch_heartbeat_interval_seconds: number;
};

export type RiskRadarProjectRisk = {
  project_id: number;
  project: string;
  score: number;
  level: 'low' | 'medium' | 'high';
  label: string;
};

export type RiskRadarTrendPoint = {
  week: string;
  score: number;
  label: string;
};

export type RiskRadarRegression = {
  project_id: number;
  project: string;
  type: 'test_failures' | 'security' | 'stability';
  severity: 'medium' | 'high';
  reason: string;
  current: number;
  previous: number;
};

export type RiskRadarTeamIndicator = {
  team: string;
  stability: 'green' | 'yellow' | 'red';
  label: string;
  project_count: number;
  avg_readiness_pct?: number;
};

export type RiskRadarNotification = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
};

export type RiskRadarProjectStatus = {
  project: string;
  status: 'green' | 'yellow' | 'red';
  label: string;
  reason: string;
};

export type RiskRadarMergeImpact = {
  project_id: number;
  project: string;
  target_branch: string | null;
  merge_pipeline_id: number;
  release_readiness_before: number;
  release_readiness_after: number;
  delta: number;
  impact: 'improved' | 'degraded' | 'neutral';
};

export type RiskRadarReleaseNote = {
  version: string;
  target_branch: string;
  date: string;
  project: string;
  category: string;
  category_label: string;
  status: string;
  risk: {
    level: 'low' | 'medium' | 'high';
    label: string;
    reason: string;
  };
  why_relevant: string;
  known_issues: string[];
};

export type RiskRadarResponse = {
  user_id: number;
  workspace_id?: number | null;
  generated_at: string;
  summary: {
    project_count: number;
    high_risk_projects: number;
    regression_events: number;
    delivery_confidence_avg_pct: number;
    release_readiness_avg_pct: number;
  };
  release_risk: {
    distribution: {
      low: number;
      medium: number;
      high: number;
    };
    projects: RiskRadarProjectRisk[];
  };
  quality_trend: RiskRadarTrendPoint[];
  regressions: RiskRadarRegression[];
  team_quality_indicator: RiskRadarTeamIndicator[];
  executive_notifications: RiskRadarNotification[];
  project_status: RiskRadarProjectStatus[];
  merge_impact_events: RiskRadarMergeImpact[];
  sprint_quality_summary: {
    window_start: string;
    window_end: string;
    build_stability_pct: number;
    regression_events: number;
    quality_trend: RiskRadarTrendPoint[];
    release_risk: {
      level: 'low' | 'medium' | 'high';
      label: string;
    };
  };
  release_notes: {
    feed: RiskRadarReleaseNote[];
    comparison: {
      new_features: number;
      bugfixes: number;
      security_fixes: number;
      known_risks: number;
    };
  };
  delivery_confidence: Array<{
    project_id: number;
    project: string;
    value_pct: number;
    mttr_hours: number | null;
    flakiness_score_pct: number;
  }>;
  build_stability: Array<{
    project_id: number;
    project: string;
    value_pct: number;
  }>;
  release_readiness: Array<{
    project_id: number;
    project: string;
    value_pct: number;
  }>;
  projects: Array<{
    project_id: number;
    project: string;
    release_risk: {
      score: number;
      level: 'low' | 'medium' | 'high';
      label: string;
    };
    delivery_confidence_pct: number;
    release_readiness_pct: number;
    build_stability_pct: number;
    quality_trend: RiskRadarTrendPoint[];
  }>;
};

export type ReleaseGatePolicy = {
  id: number;
  workspace_id: number | null;
  team_id: number | null;
  project_id: number | null;
  name: string;
  max_release_risk_score: number;
  min_release_readiness_pct: number;
  min_delivery_confidence_pct: number;
  require_green_build: boolean;
  block_on_open_incidents: boolean;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AlertRule = {
  id: number;
  workspace_id: number | null;
  team_id: number | null;
  name: string;
  severity: 'low' | 'medium' | 'high' | string;
  channel: 'slack' | 'teams' | 'email' | 'webhook' | string;
  condition_type: string;
  threshold_value: number;
  escalation_minutes: number;
  recipients: string[];
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type IncidentLink = {
  id: number;
  workspace_id: number | null;
  project_id: number;
  project: string | null;
  pipeline_id: number | null;
  gitlab_pipeline_id: number | null;
  provider: string;
  external_issue_id: string;
  external_url: string | null;
  title: string | null;
  status: 'open' | 'monitoring' | 'resolved' | string;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkspaceTemplate = {
  id: number;
  workspace_id: number | null;
  name: string;
  description: string | null;
  definition_json: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type ReleaseTrainEvent = {
  id: number;
  workspace_id: number | null;
  project_id: number | null;
  title: string;
  event_type: 'release' | 'freeze' | 'maintenance' | string;
  status: 'planned' | 'in_progress' | 'completed' | 'canceled' | string;
  start_at: string | null;
  end_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RemediationPlaybook = {
  id: number;
  workspace_id: number | null;
  team_id: number | null;
  name: string;
  trigger_type: string;
  action_type: string;
  config_json: Record<string, unknown>;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ServiceSLOBudget = {
  id: number;
  workspace_id: number | null;
  project_id: number;
  service_name: string;
  slo_target_pct: number;
  window_days: number;
  error_budget_remaining_pct: number;
  availability_pct: number;
  burn_rate: number;
  status: 'healthy' | 'warning' | 'exhausted' | string;
  created_at: string | null;
  updated_at: string | null;
};

export type RolloutGuardrail = {
  id: number;
  workspace_id: number | null;
  project_id: number;
  name: string;
  canary_required: boolean;
  canary_success_rate_min_pct: number;
  max_flag_rollout_pct: number;
  block_if_error_budget_below_pct: number;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ServiceDependency = {
  id: number;
  workspace_id: number | null;
  source_project_id: number;
  source_project: string | null;
  target_project_id: number;
  target_project: string | null;
  criticality: 'low' | 'medium' | 'high' | string;
  created_at: string | null;
};

export type Postmortem = {
  id: number;
  workspace_id: number | null;
  incident_link_id: number | null;
  title: string;
  summary: string;
  root_cause: string | null;
  impact: string | null;
  action_items: string[];
  status: 'draft' | 'published' | 'closed' | string;
  created_at: string | null;
  updated_at: string | null;
};

export type ChangeApproval = {
  id: number;
  workspace_id: number | null;
  project_id: number | null;
  release_version: string;
  required_roles: string[];
  approvals: Array<Record<string, unknown>>;
  status: 'pending' | 'approved' | 'rejected' | string;
  requested_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WebhookAutomation = {
  id: number;
  workspace_id: number | null;
  name: string;
  event_type: string;
  url: string;
  secret_ref: string | null;
  headers_json: Record<string, unknown>;
  active: boolean;
  last_status: string | null;
  last_delivery_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const OPS_PRODUCT_EVENT_NAMES = [
  'quality_dashboard_opened',
  'quality_score_threshold_breached',
  'sla_risk_detected',
  'sla_alert_acknowledged',
  'incident_timeline_opened',
  'timeline_event_filtered',
  'rca_started',
  'rca_hypothesis_confirmed',
  'runbook_started',
  'runbook_step_failed',
  'runbook_completed',
  'release_selected',
  'post_release_regression_detected',
  'impact_heatmap_opened',
  'high_impact_segment_clicked',
  'possible_duplicate_found',
  'duplicate_incident_merged',
  'postmortem_created',
  'action_item_assigned',
  'action_item_closed',
  'owner_missing_detected',
  'escalation_triggered',
  'quality_debt_item_created',
  'quality_debt_item_resolved',
  'drill_started',
  'drill_completed',
  'drill_score_shared'
] as const;

export type OpsProductEventName = (typeof OPS_PRODUCT_EVENT_NAMES)[number];

export type OpsProductEvent = {
  id: number;
  workspace_id: number | null;
  scenario: string;
  event_name: OpsProductEventName | string;
  source: string;
  metadata_json: Record<string, unknown>;
  created_at: string | null;
};

export type AuditEvent = {
  id: number;
  workspace_id: number | null;
  resource_type: string;
  resource_id: number | null;
  action: string;
  details_json: Record<string, unknown>;
  created_at: string | null;
};

export type DoraMetrics = {
  window_days: number;
  sample_size: number;
  deployment_frequency: {
    deployments: number;
    per_day: number;
    per_week: number;
    classification: 'elite' | 'high' | 'medium' | 'low' | string;
  };
  lead_time_hours: {
    value: number | null;
    classification: 'elite' | 'high' | 'medium' | 'low' | string;
  };
  change_failure_rate: {
    pct: number;
    classification: 'elite' | 'high' | 'medium' | 'low' | string;
  };
  mttr_hours: {
    value: number | null;
    classification: 'elite' | 'high' | 'medium' | 'low' | string;
  };
  overall_classification: 'elite' | 'high' | 'medium' | 'low' | string;
  calculation_note: string;
};

export type OwnershipHeatmap = {
  summary: {
    projects_total: number;
    teams_total: number;
    unowned_projects: number;
    overloaded_teams: number;
  };
  teams: Array<{
    team_id: number;
    team: string;
    project_count: number;
    status: 'idle' | 'balanced' | 'overloaded' | string;
    capacity_threshold: number;
  }>;
  projects: Array<{
    project_id: number;
    project: string;
    owners_count: number;
    owners: string[];
  }>;
  unowned_projects: Array<{
    project_id: number;
    project: string;
    owners_count: number;
    owners: string[];
  }>;
};

export type RiskSimulationResponse = {
  workspace_id: number | null;
  weeks: number;
  generated_at: string;
  thresholds: {
    release_risk_high_above: number;
    release_risk_medium_above: number;
    release_readiness_min_pct: number;
    delivery_confidence_min_pct: number;
    block_on_open_incidents: boolean;
  };
  summary: {
    projects_total: number;
    blocked: number;
    warning: number;
    pass: number;
    simulated_release_success_rate_pct: number;
  };
  decisions: Array<{
    project_id: number;
    project: string;
    status: 'blocked' | 'warning' | 'pass';
    release_risk_score: number;
    release_readiness_pct: number;
    delivery_confidence_pct: number;
    open_incidents: number;
    blocking_reasons: string[];
    warning_reasons: string[];
  }>;
};

export type WeeklyExecutiveSummary = {
  generated_at: string;
  workspace_id: number | null;
  weeks: number;
  days: number;
  headline: string;
  highlights: string[];
  top_risks: Array<{
    project_id: number;
    project: string;
    score: number;
    level: string;
  }>;
  recommendations: string[];
  kpis: {
    delivery_confidence_avg_pct: number;
    release_readiness_avg_pct: number;
    open_incidents: number;
    active_release_policies: number;
  };
};

export type QualityCostResponse = {
  workspace_id: number | null;
  window_days: number;
  hourly_rate_usd: number;
  summary: {
    incidents_total: number;
    open_incidents: number;
    failed_pipelines: number;
    estimated_quality_hours: number;
    estimated_quality_cost_usd: number;
  };
  breakdown_hours: {
    incident_recovery: number;
    failure_rework: number;
    coordination: number;
  };
  method: string;
};

export type PredictiveRiskResponse = {
  workspace_id: number | null;
  weeks: number;
  generated_at: string;
  count: number;
  items: Array<{
    project_id: number;
    project: string | null;
    current_release_risk_score: number;
    projected_risk_score: number;
    projected_level: 'low' | 'medium' | 'high' | string;
    open_incidents: number;
    regression_signals: number;
    confidence_gap: number;
  }>;
};

export type StatusPageResponse = {
  workspace_id: number | null;
  generated_at: string;
  overall_status: 'operational' | 'degraded' | 'major_outage' | string;
  open_incidents: number;
  message: string;
  services: Array<{
    service: string | null;
    status: string | null;
    reason: string | null;
  }>;
  active_incidents: Array<{
    id: number;
    project_id: number;
    title: string | null;
    status: string;
    external_issue_id: string;
    external_url: string | null;
  }>;
};

export type TeamBenchmarkingResponse = {
  workspace_id: number | null;
  window_days: number;
  count: number;
  items: Array<{
    rank: number;
    team: string;
    project_count: number;
    readiness_avg_pct: number;
    dora_classification: string;
    score: number;
  }>;
};

export type OpsOverviewResponse = {
  generated_at: string;
  workspace_id: number | null;
  weeks: number;
  days: number;
  release_gate_policies: ReleaseGatePolicy[];
  alert_rules: AlertRule[];
  trend_regressions: {
    quality_trend: RiskRadarTrendPoint[];
    regressions: RiskRadarRegression[];
    summary: {
      project_count?: number;
      high_risk_projects?: number;
      regression_events?: number;
      delivery_confidence_avg_pct?: number;
      release_readiness_avg_pct?: number;
    };
  };
  dora_metrics: DoraMetrics;
  weekly_summary: WeeklyExecutiveSummary;
  incident_links: IncidentLink[];
  release_trains: ReleaseTrainEvent[];
  remediation_playbooks: RemediationPlaybook[];
  slo_budgets: ServiceSLOBudget[];
  guardrails: RolloutGuardrail[];
  dependencies: ServiceDependency[];
  postmortems: Postmortem[];
  change_approvals: ChangeApproval[];
  webhook_automations: WebhookAutomation[];
  quality_cost: QualityCostResponse;
  predictive_risk: PredictiveRiskResponse;
  status_page: StatusPageResponse;
  team_benchmarking: TeamBenchmarkingResponse;
  ownership_heatmap: OwnershipHeatmap;
  risk_simulation_preview: RiskSimulationResponse;
  workspace_templates: WorkspaceTemplate[];
  audit_log: AuditEvent[];
  release_risk: RiskRadarResponse['release_risk'];
  project_status: RiskRadarResponse['project_status'];
};
