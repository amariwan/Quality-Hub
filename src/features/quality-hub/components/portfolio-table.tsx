'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EnvStatusChip } from '@/features/quality-hub/components/env-status-chips';
import {
  listWorkspaceGroups,
  triggerProjectSync
} from '@/features/quality-hub/api/client';
import { usePortfolio } from '@/features/quality-hub/api/swr';
import { workspaceSlugFromGroupPath } from '@/features/quality-hub/workspace-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

const DASHBOARD_STATIC_SEGMENTS = new Set([
  'dashboard',
  'risk-radar',
  'release-readiness',
  'portfolio',
  'pipelines',
  'gitlab',
  'groups',
  'projects',
  'product',
  'profile',
  'workspaces',
  'overview',
  'kanban',
  'workspace'
]);

function extractWorkspaceSlugFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'dashboard') return null;
  const candidate = segments[1] || null;
  if (!candidate || DASHBOARD_STATIC_SEGMENTS.has(candidate)) return null;
  return candidate;
}

export function PortfolioTable() {
  const [showClusters, setShowClusters] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const pathname = usePathname();
  const workspaceSlug = useMemo(
    () => extractWorkspaceSlugFromPathname(pathname || ''),
    [pathname]
  );
  const {
    data: workspaceGroups,
    error: workspaceGroupsError,
    isLoading: isWorkspaceGroupsLoading
  } = useSWR(
    workspaceSlug ? ['quality-hub', 'workspace-groups', 'portfolio'] : null,
    () => listWorkspaceGroups()
  );
  const matchedWorkspace = useMemo(() => {
    if (!workspaceSlug || !workspaceGroups?.length) return null;
    return (
      workspaceGroups.find(
        (group) =>
          workspaceSlugFromGroupPath(group.gitlab_group_path) === workspaceSlug
      ) || null
    );
  }, [workspaceGroups, workspaceSlug]);
  const workspaceId = workspaceSlug ? matchedWorkspace?.id : null;
  const isResolvingWorkspace =
    Boolean(workspaceSlug) && isWorkspaceGroupsLoading && !workspaceGroupsError;

  const { data, error, isLoading, mutate } = usePortfolio(
    showClusters,
    workspaceId
  );
  const items = data?.items ?? [];
  const workspaceErrorMessage = workspaceSlug
    ? workspaceGroupsError
      ? workspaceGroupsError instanceof Error
        ? workspaceGroupsError.message
        : 'Failed to load workspace scope'
      : !isWorkspaceGroupsLoading && !matchedWorkspace
        ? `Workspace "${workspaceSlug}" not found.`
        : null
    : null;
  const displayError =
    actionError ||
    workspaceErrorMessage ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load portfolio'
      : null);

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>
          Release Readiness Portfolio
          {matchedWorkspace ? ` (${matchedWorkspace.gitlab_group_path})` : ''}
        </CardTitle>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => {
              setActionError(null);
              setShowClusters((current) => !current);
            }}
          >
            {showClusters ? 'Hide clusters' : 'Show clusters'}
          </Button>
          <Button
            onClick={async () => {
              try {
                setSyncing(true);
                setActionError(null);
                await triggerProjectSync();
                await mutate();
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Failed to sync projects'
                );
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync projects'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(isLoading || isResolvingWorkspace) && (
          <p className='text-muted-foreground text-sm'>Loading portfolio...</p>
        )}
        {displayError && (
          <p className='text-destructive text-sm'>{displayError}</p>
        )}
        {!isLoading && !isResolvingWorkspace && !displayError && (
          <div className='space-y-3'>
            {items.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                No deployments yet. Register clusters and mappings first.
              </p>
            )}
            {items.map((item) => (
              <div key={item.project_id} className='rounded-md border p-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='font-medium'>
                    <Link
                      href={`/dashboard/projects/${item.project_id}`}
                      className='hover:underline'
                    >
                      {item.project || `Project ${item.project_id}`}
                    </Link>
                  </h3>
                  <span className='text-muted-foreground text-xs'>
                    ID: {item.project_id}
                  </span>
                </div>
                <Separator className='my-2' />
                <div className='flex flex-wrap gap-2'>
                  {item.environments.map((env) => (
                    <div
                      key={`${item.project_id}-${env.env}`}
                      className='space-y-2'
                    >
                      <EnvStatusChip label={env.env} status={env.status} />
                      {showClusters && env.clusters.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                          {env.clusters.map((cluster) => (
                            <EnvStatusChip
                              key={`${cluster.cluster_id}-${env.env}`}
                              label={
                                cluster.cluster ||
                                `Cluster ${cluster.cluster_id}`
                              }
                              status={cluster.status}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
