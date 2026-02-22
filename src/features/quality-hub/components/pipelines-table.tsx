'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listWorkspaceGroups } from '@/features/quality-hub/api/client';
import { usePipelines } from '@/features/quality-hub/api/swr';
import { workspaceSlugFromGroupPath } from '@/features/quality-hub/workspace-context';
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

export function PipelinesTable() {
  const [scope, setScope] = useState<'all' | 'readiness'>('readiness');
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
    workspaceSlug ? ['quality-hub', 'workspace-groups', 'pipelines'] : null,
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

  const { data, error, isLoading } = usePipelines(scope, workspaceId);
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
  const errorMessage =
    workspaceErrorMessage ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load pipelines'
      : null);

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>
          Broken Pipelines
          {matchedWorkspace ? ` (${matchedWorkspace.gitlab_group_path})` : ''}
        </CardTitle>
        <div className='flex gap-2'>
          <Button
            variant={scope === 'readiness' ? 'default' : 'outline'}
            onClick={() => setScope('readiness')}
          >
            Readiness
          </Button>
          <Button
            variant={scope === 'all' ? 'default' : 'outline'}
            onClick={() => setScope('all')}
          >
            All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(isLoading || isResolvingWorkspace) && (
          <p className='text-muted-foreground text-sm'>Loading pipelines...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}
        {!isLoading && !isResolvingWorkspace && !errorMessage && (
          <div className='space-y-2'>
            {items.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                No broken pipelines for this scope.
              </p>
            )}
            {items.map((item) => (
              <div key={item.id} className='rounded-md border p-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>Project {item.project_id}</Badge>
                  <Badge>{item.status}</Badge>
                  <Badge variant='secondary'>{item.deployability_state}</Badge>
                  <span className='text-muted-foreground text-xs'>
                    #{item.gitlab_pipeline_id}
                  </span>
                </div>
                <p className='text-muted-foreground mt-2 text-xs'>
                  ref: {item.ref || '-'} | sha: {item.sha || '-'} | source:{' '}
                  {item.source_type || '-'}
                </p>
                {item.failure_reasons.length > 0 && (
                  <p className='mt-2 text-xs'>
                    Reasons: {item.failure_reasons.join(', ')}
                  </p>
                )}
                {item.missing_signals.length > 0 && (
                  <p className='mt-1 text-xs text-amber-700'>
                    Missing signals: {item.missing_signals.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
