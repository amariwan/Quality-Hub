import {
  AlertRule,
  AuditEvent,
  ChangeApproval,
  DoraMetrics,
  GitlabGroup,
  GitlabIssuesResponse,
  GitlabProjectInsightsResponse,
  GitlabProjectEventsResponse,
  GitlabProject,
  IncidentLink,
  OpsOverviewResponse,
  OpsProductEvent,
  OpsProductEventName,
  OwnershipHeatmap,
  Postmortem,
  PredictiveRiskResponse,
  QualityCostResponse,
  ReleaseGatePolicy,
  ReleaseTrainEvent,
  RemediationPlaybook,
  RolloutGuardrail,
  RiskSimulationResponse,
  ServiceDependency,
  ServiceSLOBudget,
  StatusPageResponse,
  TeamBenchmarkingResponse,
  WeeklyExecutiveSummary,
  WebhookAutomation,
  WorkspaceTemplate,
  WorkspaceChangelogResponse,
  RiskRadarResponse,
  QualityHubRuntimeSettings,
  PipelinesResponse,
  PortfolioResponse,
  ProjectMatrixResponse,
  Team,
  TeamMember,
  TeamProjectMapping,
  WorkspaceGroup
} from '@/features/quality-hub/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/v1';

let lastErrorToastMessage = '';
let lastErrorToastAt = 0;

function notifyApiErrorToast(message: string) {
  if (typeof window === 'undefined') return;

  // Avoid burst duplicates when multiple components request the same endpoint.
  const now = Date.now();
  if (message === lastErrorToastMessage && now - lastErrorToastAt < 1500) {
    return;
  }
  lastErrorToastMessage = message;
  lastErrorToastAt = now;

  void import('sonner')
    .then(({ toast }) => {
      toast.error(message);
    })
    .catch(() => {
      // ignore toast transport errors
    });
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      },
      ...init
    });
  } catch (err) {
    const detail =
      err instanceof Error ? `Network error: ${err.message}` : String(err);
    notifyApiErrorToast(detail);
    throw new Error(detail);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as {
        detail?: string | string[] | Record<string, unknown>;
      };
      if (typeof body.detail === 'string' && body.detail.trim()) {
        detail = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        detail = body.detail.map(String).join(', ');
      }
    } catch {
      // ignore
    }
    notifyApiErrorToast(detail);
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export function connectGitlabToken(payload: {
  token: string;
  base_url?: string;
}) {
  return apiFetch<{
    user_id: number;
    email: string;
    gitlab_connected: boolean;
  }>('/auth/token', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAuthMe() {
  return apiFetch<{
    user_id: number;
    email: string;
    gitlab_connected: boolean;
  }>('/auth/me');
}

export function listGitlabGroups() {
  return apiFetch<GitlabGroup[]>('/gitlab/groups');
}

export function listGitlabProjects(groupId?: number | null) {
  if (groupId) {
    const query = new URLSearchParams({ group_id: String(groupId) });
    return apiFetch<GitlabProject[]>(`/gitlab/projects?${query.toString()}`);
  }
  return apiFetch<GitlabProject[]>('/gitlab/projects');
}

export function listWorkspaceChangelog(
  workspaceId: number,
  options?: {
    projectLimit?: number;
    contentMaxChars?: number;
    mrLimit?: number;
  }
) {
  const query = new URLSearchParams({ workspace_id: String(workspaceId) });
  if (typeof options?.projectLimit === 'number' && options.projectLimit > 0) {
    query.set('project_limit', String(options.projectLimit));
  }
  if (
    typeof options?.contentMaxChars === 'number' &&
    options.contentMaxChars > 0
  ) {
    query.set('content_max_chars', String(options.contentMaxChars));
  }
  if (typeof options?.mrLimit === 'number' && options.mrLimit > 0) {
    query.set('mr_limit', String(options.mrLimit));
  }

  return apiFetch<WorkspaceChangelogResponse>(
    `/gitlab/projects/workspace/changelog?${query.toString()}`
  );
}

export function listGitlabIssues(params: {
  groupId: number;
  state?: 'opened' | 'closed' | 'all';
  search?: string;
}) {
  const query = new URLSearchParams({
    group_id: String(params.groupId),
    state: params.state || 'opened'
  });
  if (params.search) query.set('search', params.search);
  return apiFetch<GitlabIssuesResponse>(`/gitlab/issues?${query.toString()}`);
}

export function createGitlabIssue(payload: {
  project_id: number;
  title: string;
  description?: string;
  labels?: string[];
  due_date?: string;
}) {
  return apiFetch<{
    id: number | null;
    iid: number | null;
    project_id: number | null;
    title: string | null;
    state: string | null;
    labels: string[];
    web_url: string | null;
    created_at: string | null;
    due_date: string | null;
  }>('/gitlab/issues', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listGitlabProjectEvents(
  projectId: number,
  params?: {
    limit?: number;
    status?: string;
    ref?: string;
    source?: string;
  }
) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.ref) query.set('ref', params.ref);
  if (params?.source) query.set('source', params.source);
  const suffix = query.toString();
  const path = suffix
    ? `/gitlab/projects/${projectId}/events?${suffix}`
    : `/gitlab/projects/${projectId}/events`;
  return apiFetch<GitlabProjectEventsResponse>(path);
}

export function getGitlabProjectsInsights(
  projectIds: number[],
  pipelineLimit = 40
) {
  const query = new URLSearchParams();
  for (const id of projectIds) {
    query.append('project_ids', String(id));
  }
  query.set('pipeline_limit', String(pipelineLimit));
  return apiFetch<GitlabProjectInsightsResponse>(
    `/gitlab/insights/projects?${query.toString()}`
  );
}

export function buildGitlabLiveWebSocketUrl(params: {
  projectIds: number[];
  intervalSeconds: number;
  pipelineLimit: number;
  eventsLimit: number;
}) {
  const httpBase = API_BASE_URL.replace(/\/$/, '');
  const wsBase = httpBase.startsWith('https://')
    ? httpBase.replace(/^https:\/\//, 'wss://')
    : httpBase.replace(/^http:\/\//, 'ws://');

  const query = new URLSearchParams();
  for (const id of params.projectIds) {
    query.append('project_ids', String(id));
  }
  query.set('interval_seconds', String(params.intervalSeconds));
  query.set('pipeline_limit', String(params.pipelineLimit));
  query.set('events_limit', String(params.eventsLimit));
  return `${wsBase}/ws/gitlab/live?${query.toString()}`;
}

export function getRuntimeSettings() {
  return apiFetch<QualityHubRuntimeSettings>('/settings');
}

export function disconnectGitlabToken() {
  return apiFetch<{ status: string }>('/auth/token', {
    method: 'DELETE'
  });
}

export function getPortfolio(params: {
  showClusters: boolean;
  scope?: string;
  workspaceId?: number | null;
}) {
  const query = new URLSearchParams({
    show_clusters: String(params.showClusters)
  });
  if (typeof params.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  return apiFetch<PortfolioResponse>(`/deployments/status?${query.toString()}`);
}

export function getProjectMatrix(projectId: number) {
  return apiFetch<ProjectMatrixResponse>(`/deployments/status/${projectId}`);
}

export function getPipelines(
  scope: 'all' | 'readiness',
  workspaceId?: number | null
) {
  const query = new URLSearchParams({ scope });
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  return apiFetch<PipelinesResponse>(`/pipelines?${query.toString()}`);
}

export function getRiskRadar(weeks = 3, workspaceId?: number | null) {
  const query = new URLSearchParams({
    weeks: String(Math.min(12, Math.max(2, weeks)))
  });
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  return apiFetch<RiskRadarResponse>(`/risk-radar?${query.toString()}`);
}

export function triggerProjectSync() {
  return apiFetch<{ sync_run_id: number; celery_job_id: string }>(
    '/projects/sync',
    {
      method: 'POST',
      body: JSON.stringify({ trigger: 'manual' })
    }
  );
}

export function listProjects(syncFromGitlab = false) {
  const query = syncFromGitlab ? '?sync_from_gitlab=true' : '';
  return apiFetch<
    Array<{
      id: number;
      gitlab_project_id: number;
      path_with_namespace: string;
      default_branch: string | null;
    }>
  >(`/projects${query}`);
}

export function listTeams() {
  return apiFetch<Team[]>('/teams');
}

export function listWorkspaceGroups() {
  return apiFetch<WorkspaceGroup[]>('/user/monitored-groups');
}

export function createWorkspaceGroup(payload: { gitlab_group_id: number }) {
  return apiFetch<WorkspaceGroup>('/user/monitored-groups', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteWorkspaceGroup(workspaceGroupId: number) {
  return apiFetch<{ deleted: boolean }>(
    `/user/monitored-groups/${workspaceGroupId}`,
    {
      method: 'DELETE'
    }
  );
}

export function createTeam(payload: { name: string }) {
  return apiFetch<Team>('/teams', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listTeamMembers(teamId: number) {
  return apiFetch<TeamMember[]>(`/teams/${teamId}/members`);
}

export function addTeamMember(
  teamId: number,
  payload: { user_id: number; role: string }
) {
  return apiFetch<TeamMember>(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listTeamProjectMappings() {
  return apiFetch<TeamProjectMapping[]>('/team-project-mappings');
}

export function createTeamProjectMapping(payload: {
  team_id: number;
  project_id: number;
}) {
  return apiFetch<TeamProjectMapping>('/team-project-mappings', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteTeamProjectMapping(mappingId: number) {
  return apiFetch<{ deleted: boolean }>(`/team-project-mappings/${mappingId}`, {
    method: 'DELETE'
  });
}

export function listWorkspaceViews() {
  return apiFetch<
    Array<{
      id: number;
      name: string;
      visibility: string;
      team_id: number | null;
      definition_json: Record<string, unknown>;
    }>
  >('/workspace/views');
}

export function createWorkspaceView(payload: {
  name: string;
  visibility?: string;
  team_id?: number | null;
  definition_json?: Record<string, unknown>;
}) {
  return apiFetch('/workspace/views', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listWorkspaceNotes(workspaceId: number) {
  const query = new URLSearchParams({ workspace_id: String(workspaceId) });
  return apiFetch<
    Array<{
      id: number;
      workspace_id: number | null;
      visibility: string;
      team_id: number | null;
      scope_type: string;
      project_id: number | null;
      env: string | null;
      cluster_id: number | null;
      content: string;
    }>
  >(`/workspace/notes?${query.toString()}`);
}

export function createWorkspaceNote(payload: {
  workspace_id: number;
  content: string;
  visibility?: string;
  team_id?: number | null;
  scope_type?: string;
  project_id?: number | null;
  env?: string | null;
  cluster_id?: number | null;
}) {
  return apiFetch('/workspace/notes', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateWorkspaceNote(
  itemId: number,
  workspaceId: number,
  payload: {
    content?: string;
    visibility?: string;
    team_id?: number | null;
    scope_type?: string;
    project_id?: number | null;
    env?: string | null;
    cluster_id?: number | null;
  }
) {
  const query = new URLSearchParams({ workspace_id: String(workspaceId) });
  return apiFetch(`/workspace/notes/${itemId}?${query.toString()}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteWorkspaceNote(itemId: number, workspaceId: number) {
  const query = new URLSearchParams({ workspace_id: String(workspaceId) });
  return apiFetch<{ deleted: boolean }>(
    `/workspace/notes/${itemId}?${query.toString()}`,
    {
      method: 'DELETE'
    }
  );
}

export function getWorkspaceNote(itemId: number, workspaceId: number) {
  const query = new URLSearchParams({ workspace_id: String(workspaceId) });
  return apiFetch<{
    id: number;
    workspace_id: number | null;
    visibility: string;
    team_id: number | null;
    scope_type: string;
    project_id: number | null;
    env: string | null;
    cluster_id: number | null;
    content: string;
  }>(`/workspace/notes/${itemId}?${query.toString()}`);
}

export function listWorkspaceWatchlist() {
  return apiFetch<
    Array<{
      id: number;
      visibility: string;
      project_id: number;
      team_id: number | null;
    }>
  >('/workspace/watchlist');
}

export function createWorkspaceWatchlist(payload: {
  project_id: number;
  visibility?: string;
  team_id?: number | null;
}) {
  return apiFetch('/workspace/watchlist', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteWorkspaceWatchlist(itemId: number) {
  return apiFetch<{ deleted: boolean }>(`/workspace/watchlist/${itemId}`, {
    method: 'DELETE'
  });
}

export function listWorkspaceTags() {
  return apiFetch<
    Array<{
      id: number;
      visibility: string;
      team_id: number | null;
      name: string;
      color: string | null;
      links: Array<{
        id: number;
        scope_type: string;
        project_id: number | null;
        env: string | null;
        cluster_id: number | null;
      }>;
    }>
  >('/workspace/tags');
}

export function createWorkspaceTag(payload: {
  name: string;
  color?: string | null;
  visibility?: string;
  team_id?: number | null;
  links?: Array<{
    scope_type: string;
    project_id?: number | null;
    env?: string | null;
    cluster_id?: number | null;
  }>;
}) {
  return apiFetch('/workspace/tags', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getOpsOverview(params?: {
  workspaceId?: number | null;
  weeks?: number;
  days?: number;
  capacityThreshold?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.weeks === 'number') {
    query.set('weeks', String(params.weeks));
  }
  if (typeof params?.days === 'number') {
    query.set('days', String(params.days));
  }
  if (typeof params?.capacityThreshold === 'number') {
    query.set('capacity_threshold', String(params.capacityThreshold));
  }

  const suffix = query.toString();
  const path = suffix ? `/ops/overview?${suffix}` : '/ops/overview';
  return apiFetch<OpsOverviewResponse>(path);
}

export function listOpsProductEvents(params?: {
  workspaceId?: number | null;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.limit === 'number' && params.limit > 0) {
    query.set('limit', String(params.limit));
  }
  const suffix = query.toString();
  const path = suffix ? `/ops/product-events?${suffix}` : '/ops/product-events';
  return apiFetch<OpsProductEvent[]>(path);
}

export function createOpsProductEvent(payload: {
  workspace_id?: number | null;
  scenario: string;
  event_name: OpsProductEventName;
  source?: string;
  metadata_json?: Record<string, unknown>;
}) {
  return apiFetch<OpsProductEvent>('/ops/product-events', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listReleaseGatePolicies(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<ReleaseGatePolicy[]>(
    suffix ? `/ops/release-gates?${suffix}` : '/ops/release-gates'
  );
}

export function createReleaseGatePolicy(payload: {
  name: string;
  workspace_id?: number | null;
  team_id?: number | null;
  project_id?: number | null;
  max_release_risk_score?: number;
  min_release_readiness_pct?: number;
  min_delivery_confidence_pct?: number;
  require_green_build?: boolean;
  block_on_open_incidents?: boolean;
  active?: boolean;
}) {
  return apiFetch<ReleaseGatePolicy>('/ops/release-gates', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteReleaseGatePolicy(policyId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/release-gates/${policyId}`, {
    method: 'DELETE'
  });
}

export function listAlertRules(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<AlertRule[]>(
    suffix ? `/ops/alert-rules?${suffix}` : '/ops/alert-rules'
  );
}

export function createAlertRule(payload: {
  name: string;
  workspace_id?: number | null;
  team_id?: number | null;
  severity?: 'low' | 'medium' | 'high';
  channel?: 'slack' | 'teams' | 'email' | 'webhook';
  condition_type?: string;
  threshold_value?: number;
  escalation_minutes?: number;
  recipients?: string[];
  active?: boolean;
}) {
  return apiFetch<AlertRule>('/ops/alert-rules', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteAlertRule(ruleId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/alert-rules/${ruleId}`, {
    method: 'DELETE'
  });
}

export function listIncidentLinks(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<IncidentLink[]>(
    suffix ? `/ops/incident-links?${suffix}` : '/ops/incident-links'
  );
}

export function createIncidentLink(payload: {
  workspace_id?: number | null;
  project_id: number;
  pipeline_id?: number | null;
  provider?: string;
  external_issue_id: string;
  external_url?: string;
  title?: string;
  status?: 'open' | 'monitoring' | 'resolved';
}) {
  return apiFetch<IncidentLink>('/ops/incident-links', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteIncidentLink(linkId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/incident-links/${linkId}`, {
    method: 'DELETE'
  });
}

export function listWorkspaceTemplates(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<WorkspaceTemplate[]>(
    suffix ? `/ops/workspace-templates?${suffix}` : '/ops/workspace-templates'
  );
}

export function createWorkspaceTemplate(payload: {
  workspace_id?: number | null;
  name: string;
  description?: string;
  definition_json?: Record<string, unknown>;
}) {
  return apiFetch<WorkspaceTemplate>('/ops/workspace-templates', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteWorkspaceTemplate(templateId: number) {
  return apiFetch<{ deleted: boolean }>(
    `/ops/workspace-templates/${templateId}`,
    {
      method: 'DELETE'
    }
  );
}

export function getDoraMetrics(params?: {
  workspaceId?: number | null;
  days?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.days === 'number') {
    query.set('days', String(params.days));
  }
  const suffix = query.toString();
  return apiFetch<DoraMetrics>(
    suffix ? `/ops/dora-metrics?${suffix}` : '/ops/dora-metrics'
  );
}

export function getOwnershipHeatmap(params?: {
  workspaceId?: number | null;
  capacityThreshold?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.capacityThreshold === 'number') {
    query.set('capacity_threshold', String(params.capacityThreshold));
  }
  const suffix = query.toString();
  return apiFetch<OwnershipHeatmap>(
    suffix ? `/ops/ownership-heatmap?${suffix}` : '/ops/ownership-heatmap'
  );
}

export function getWeeklyExecutiveSummary(params?: {
  workspaceId?: number | null;
  weeks?: number;
  days?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.weeks === 'number') {
    query.set('weeks', String(params.weeks));
  }
  if (typeof params?.days === 'number') {
    query.set('days', String(params.days));
  }
  const suffix = query.toString();
  return apiFetch<WeeklyExecutiveSummary>(
    suffix ? `/ops/weekly-summary?${suffix}` : '/ops/weekly-summary'
  );
}

export function simulateRisk(payload: {
  workspace_id?: number | null;
  weeks?: number;
  release_risk_high_above?: number;
  release_risk_medium_above?: number;
  release_readiness_min_pct?: number;
  delivery_confidence_min_pct?: number;
  block_on_open_incidents?: boolean;
}) {
  return apiFetch<RiskSimulationResponse>('/ops/risk-simulation', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAuditEvents(params?: {
  workspaceId?: number | null;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.limit === 'number') {
    query.set('limit', String(params.limit));
  }
  const suffix = query.toString();
  return apiFetch<AuditEvent[]>(
    suffix ? `/ops/audit-log?${suffix}` : '/ops/audit-log'
  );
}

export function listReleaseTrains(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<ReleaseTrainEvent[]>(
    suffix ? `/ops/release-trains?${suffix}` : '/ops/release-trains'
  );
}

export function createReleaseTrain(payload: {
  workspace_id?: number | null;
  project_id?: number | null;
  title: string;
  event_type?: 'release' | 'freeze' | 'maintenance';
  status?: 'planned' | 'in_progress' | 'completed' | 'canceled';
  start_at: string;
  end_at: string;
  notes?: string | null;
}) {
  return apiFetch<ReleaseTrainEvent>('/ops/release-trains', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteReleaseTrain(eventId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/release-trains/${eventId}`, {
    method: 'DELETE'
  });
}

export function listRemediationPlaybooks(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<RemediationPlaybook[]>(
    suffix
      ? `/ops/remediation-playbooks?${suffix}`
      : '/ops/remediation-playbooks'
  );
}

export function createRemediationPlaybook(payload: {
  workspace_id?: number | null;
  team_id?: number | null;
  name: string;
  trigger_type?: string;
  action_type?: string;
  config_json?: Record<string, unknown>;
  active?: boolean;
}) {
  return apiFetch<RemediationPlaybook>('/ops/remediation-playbooks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteRemediationPlaybook(playbookId: number) {
  return apiFetch<{ deleted: boolean }>(
    `/ops/remediation-playbooks/${playbookId}`,
    {
      method: 'DELETE'
    }
  );
}

export function listSLOBudgets(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<ServiceSLOBudget[]>(
    suffix ? `/ops/slo-budgets?${suffix}` : '/ops/slo-budgets'
  );
}

export function createSLOBudget(payload: {
  workspace_id?: number | null;
  project_id: number;
  service_name: string;
  slo_target_pct?: number;
  window_days?: number;
  error_budget_remaining_pct?: number;
  availability_pct?: number;
  burn_rate?: number;
  status?: 'healthy' | 'warning' | 'exhausted';
}) {
  return apiFetch<ServiceSLOBudget>('/ops/slo-budgets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteSLOBudget(sloId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/slo-budgets/${sloId}`, {
    method: 'DELETE'
  });
}

export function listGuardrails(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<RolloutGuardrail[]>(
    suffix ? `/ops/guardrails?${suffix}` : '/ops/guardrails'
  );
}

export function createGuardrail(payload: {
  workspace_id?: number | null;
  project_id: number;
  name: string;
  canary_required?: boolean;
  canary_success_rate_min_pct?: number;
  max_flag_rollout_pct?: number;
  block_if_error_budget_below_pct?: number;
  active?: boolean;
}) {
  return apiFetch<RolloutGuardrail>('/ops/guardrails', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteGuardrail(guardrailId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/guardrails/${guardrailId}`, {
    method: 'DELETE'
  });
}

export function listDependencies(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<ServiceDependency[]>(
    suffix ? `/ops/dependencies?${suffix}` : '/ops/dependencies'
  );
}

export function createDependency(payload: {
  workspace_id?: number | null;
  source_project_id: number;
  target_project_id: number;
  criticality?: 'low' | 'medium' | 'high';
}) {
  return apiFetch<ServiceDependency>('/ops/dependencies', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteDependency(dependencyId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/dependencies/${dependencyId}`, {
    method: 'DELETE'
  });
}

export function listPostmortems(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<Postmortem[]>(
    suffix ? `/ops/postmortems?${suffix}` : '/ops/postmortems'
  );
}

export function createPostmortem(payload: {
  workspace_id?: number | null;
  incident_link_id?: number | null;
  title: string;
  summary: string;
  root_cause?: string | null;
  impact?: string | null;
  action_items?: string[];
  status?: 'draft' | 'published' | 'closed';
}) {
  return apiFetch<Postmortem>('/ops/postmortems', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deletePostmortem(postmortemId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/postmortems/${postmortemId}`, {
    method: 'DELETE'
  });
}

export function listChangeApprovals(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<ChangeApproval[]>(
    suffix ? `/ops/change-approvals?${suffix}` : '/ops/change-approvals'
  );
}

export function createChangeApproval(payload: {
  workspace_id?: number | null;
  project_id?: number | null;
  release_version: string;
  required_roles?: string[];
  requested_by?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
}) {
  return apiFetch<ChangeApproval>('/ops/change-approvals', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteChangeApproval(approvalId: number) {
  return apiFetch<{ deleted: boolean }>(`/ops/change-approvals/${approvalId}`, {
    method: 'DELETE'
  });
}

export function listWebhookAutomations(workspaceId?: number | null) {
  const query = new URLSearchParams();
  if (typeof workspaceId === 'number' && workspaceId > 0) {
    query.set('workspace_id', String(workspaceId));
  }
  const suffix = query.toString();
  return apiFetch<WebhookAutomation[]>(
    suffix ? `/ops/webhook-automations?${suffix}` : '/ops/webhook-automations'
  );
}

export function createWebhookAutomation(payload: {
  workspace_id?: number | null;
  name: string;
  event_type?: string;
  url: string;
  secret_ref?: string | null;
  headers_json?: Record<string, unknown>;
  active?: boolean;
}) {
  return apiFetch<WebhookAutomation>('/ops/webhook-automations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteWebhookAutomation(automationId: number) {
  return apiFetch<{ deleted: boolean }>(
    `/ops/webhook-automations/${automationId}`,
    {
      method: 'DELETE'
    }
  );
}

export function getQualityCost(params?: {
  workspaceId?: number | null;
  days?: number;
  hourlyRateUsd?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.days === 'number') {
    query.set('days', String(params.days));
  }
  if (typeof params?.hourlyRateUsd === 'number') {
    query.set('hourly_rate_usd', String(params.hourlyRateUsd));
  }
  const suffix = query.toString();
  return apiFetch<QualityCostResponse>(
    suffix ? `/ops/quality-cost?${suffix}` : '/ops/quality-cost'
  );
}

export function getPredictiveRisk(params?: {
  workspaceId?: number | null;
  weeks?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.weeks === 'number') {
    query.set('weeks', String(params.weeks));
  }
  const suffix = query.toString();
  return apiFetch<PredictiveRiskResponse>(
    suffix ? `/ops/predictive-risk?${suffix}` : '/ops/predictive-risk'
  );
}

export function getStatusPage(params?: {
  workspaceId?: number | null;
  weeks?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.weeks === 'number') {
    query.set('weeks', String(params.weeks));
  }
  const suffix = query.toString();
  return apiFetch<StatusPageResponse>(
    suffix ? `/ops/status-page?${suffix}` : '/ops/status-page'
  );
}

export function getTeamBenchmarking(params?: {
  workspaceId?: number | null;
  days?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.workspaceId === 'number' && params.workspaceId > 0) {
    query.set('workspace_id', String(params.workspaceId));
  }
  if (typeof params?.days === 'number') {
    query.set('days', String(params.days));
  }
  const suffix = query.toString();
  return apiFetch<TeamBenchmarkingResponse>(
    suffix ? `/ops/team-benchmarking?${suffix}` : '/ops/team-benchmarking'
  );
}
