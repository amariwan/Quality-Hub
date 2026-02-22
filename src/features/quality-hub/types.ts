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
