import useSWR from 'swr';
import {
  getOpsOverview,
  getPipelines,
  getPortfolio,
  getProjectMatrix,
  getRiskRadar,
  getRuntimeSettings,
  listTeamMembers,
  listWorkspaceChangelog,
  listTeams,
  listWorkspaceNotes,
  listWorkspaceTags,
  listWorkspaceViews
} from '@/features/quality-hub/api/client';

const normalizeWeeks = (weeks: number) => Math.min(12, Math.max(2, weeks));

export const qualityHubSWRKeys = {
  pipelines: (scope: 'all' | 'readiness', workspaceId: number | null) =>
    ['quality-hub', 'pipelines', scope, workspaceId ?? 'all'] as const,
  portfolio: (showClusters: boolean, workspaceId: number | null) =>
    [
      'quality-hub',
      'portfolio',
      showClusters ? 'clusters' : 'summary',
      workspaceId ?? 'all'
    ] as const,
  projectMatrix: (projectId: number) =>
    ['quality-hub', 'project-matrix', projectId] as const,
  riskRadar: (weeks: number, workspaceId: number | null) =>
    [
      'quality-hub',
      'risk-radar',
      normalizeWeeks(weeks),
      workspaceId ?? 'all'
    ] as const,
  runtimeSettings: () => ['quality-hub', 'runtime-settings'] as const,
  teams: () => ['quality-hub', 'teams'] as const,
  teamMembers: (teamId: number) =>
    ['quality-hub', 'team-members', teamId] as const,
  workspaceViews: () => ['quality-hub', 'workspace-views'] as const,
  workspaceNotes: (workspaceId: number) =>
    ['quality-hub', 'workspace-notes', workspaceId] as const,
  workspaceChangelog: (
    workspaceId: number,
    projectLimit: number,
    contentMaxChars: number,
    mrLimit: number
  ) =>
    [
      'quality-hub',
      'workspace-changelog',
      workspaceId,
      projectLimit,
      contentMaxChars,
      mrLimit
    ] as const,
  workspaceTags: () => ['quality-hub', 'workspace-tags'] as const,
  opsOverview: (workspaceId: number | null, weeks: number, days: number) =>
    ['quality-hub', 'ops-overview', workspaceId ?? 'all', weeks, days] as const
};

export function usePortfolio(
  showClusters: boolean,
  workspaceId?: number | null
) {
  return useSWR(
    workspaceId === undefined
      ? null
      : qualityHubSWRKeys.portfolio(showClusters, workspaceId ?? null),
    () =>
      getPortfolio({
        showClusters,
        scope: 'readiness',
        workspaceId
      })
  );
}

export function usePipelines(
  scope: 'all' | 'readiness',
  workspaceId?: number | null
) {
  return useSWR(
    workspaceId === undefined
      ? null
      : qualityHubSWRKeys.pipelines(scope, workspaceId ?? null),
    () => getPipelines(scope, workspaceId)
  );
}

export function useRiskRadar(weeks: number, workspaceId?: number | null) {
  const normalizedWeeks = normalizeWeeks(weeks);
  return useSWR(
    workspaceId === undefined
      ? null
      : qualityHubSWRKeys.riskRadar(normalizedWeeks, workspaceId ?? null),
    () => getRiskRadar(normalizedWeeks, workspaceId)
  );
}

export function useProjectMatrix(projectId: number | null | undefined) {
  return useSWR(
    projectId ? qualityHubSWRKeys.projectMatrix(projectId) : null,
    () => getProjectMatrix(projectId as number)
  );
}

export function useRuntimeSettings() {
  return useSWR(qualityHubSWRKeys.runtimeSettings(), () =>
    getRuntimeSettings()
  );
}

export function useTeams() {
  return useSWR(qualityHubSWRKeys.teams(), () => listTeams());
}

export function useTeamMembers(teamId: number | null) {
  return useSWR(teamId ? qualityHubSWRKeys.teamMembers(teamId) : null, () =>
    listTeamMembers(teamId as number)
  );
}

export function useWorkspaceViews() {
  return useSWR(qualityHubSWRKeys.workspaceViews(), () => listWorkspaceViews());
}

export function useWorkspaceNotes(workspaceId: number | null) {
  return useSWR(
    workspaceId ? qualityHubSWRKeys.workspaceNotes(workspaceId) : null,
    () => listWorkspaceNotes(workspaceId as number)
  );
}

export function useWorkspaceChangelog(
  workspaceId: number | null,
  options?: {
    projectLimit?: number;
    contentMaxChars?: number;
    mrLimit?: number;
  }
) {
  const projectLimit = options?.projectLimit ?? 30;
  const contentMaxChars = options?.contentMaxChars ?? 12000;
  const mrLimit = options?.mrLimit ?? 40;
  return useSWR(
    workspaceId
      ? qualityHubSWRKeys.workspaceChangelog(
          workspaceId,
          projectLimit,
          contentMaxChars,
          mrLimit
        )
      : null,
    () =>
      listWorkspaceChangelog(workspaceId as number, {
        projectLimit,
        contentMaxChars,
        mrLimit
      })
  );
}

export function useWorkspaceTags() {
  return useSWR(qualityHubSWRKeys.workspaceTags(), () => listWorkspaceTags());
}

export function useOpsOverview(
  params: {
    workspaceId?: number | null;
    weeks?: number;
    days?: number;
  } = {}
) {
  const workspaceId =
    params.workspaceId === undefined ? undefined : (params.workspaceId ?? null);
  const weeks = params.weeks ?? 6;
  const days = params.days ?? 30;

  return useSWR(
    workspaceId === undefined
      ? null
      : qualityHubSWRKeys.opsOverview(workspaceId, weeks, days),
    () =>
      getOpsOverview({
        workspaceId,
        weeks,
        days
      })
  );
}
