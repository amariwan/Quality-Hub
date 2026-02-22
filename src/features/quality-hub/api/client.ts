import {
  GitlabGroup,
  GitlabProjectInsightsResponse,
  GitlabProjectEventsResponse,
  GitlabProject,
  QualityHubRuntimeSettings,
  PipelinesResponse,
  PortfolioResponse,
  ProjectMatrixResponse,
  Team,
  TeamMember,
  WorkspaceGroup
} from '@/features/quality-hub/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/v1';

export function getApiBaseUrl() {
  return API_BASE_URL;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      },
      ...init
    });

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: string };
        detail = body.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    return response.json() as Promise<T>;
  } catch (err) {
    // fetch throws a TypeError on network failure; wrap in Error so callers
    // always receive an Error instance with a useful message.
    if (err instanceof Error) {
      throw new Error(`Network error: ${err.message}`);
    }
    throw new Error(String(err));
  }
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
}) {
  const query = new URLSearchParams({
    show_clusters: String(params.showClusters)
  });
  return apiFetch<PortfolioResponse>(`/deployments/status?${query.toString()}`);
}

export function getProjectMatrix(projectId: number) {
  return apiFetch<ProjectMatrixResponse>(`/deployments/status/${projectId}`);
}

export function getPipelines(scope: 'all' | 'readiness') {
  return apiFetch<PipelinesResponse>(`/pipelines?scope=${scope}`);
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

export function listWorkspaceNotes() {
  return apiFetch<
    Array<{
      id: number;
      visibility: string;
      scope_type: string;
      project_id: number | null;
      env: string | null;
      cluster_id: number | null;
      content: string;
    }>
  >('/workspace/notes');
}

export function createWorkspaceNote(payload: {
  content: string;
  visibility?: string;
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
