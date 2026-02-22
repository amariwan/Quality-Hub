'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listWorkspaceGroups } from '@/features/quality-hub/api/client';
import { useWorkspaceChangelog } from '@/features/quality-hub/api/swr';
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

export function WorkspaceChangelogManager() {
  const [showMissing, setShowMissing] = useState(false);
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
    workspaceSlug ? ['quality-hub', 'workspace-groups', 'changelog'] : null,
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

  const workspaceId = workspaceSlug ? (matchedWorkspace?.id ?? null) : null;
  const isResolvingWorkspace =
    Boolean(workspaceSlug) && isWorkspaceGroupsLoading && !workspaceGroupsError;
  const workspaceErrorMessage = workspaceSlug
    ? workspaceGroupsError
      ? workspaceGroupsError instanceof Error
        ? workspaceGroupsError.message
        : 'Failed to load workspace scope'
      : !isWorkspaceGroupsLoading && !matchedWorkspace
        ? `Workspace "${workspaceSlug}" not found.`
        : null
    : null;

  const { data, error, isLoading, mutate } = useWorkspaceChangelog(
    workspaceId,
    {
      projectLimit: 40,
      contentMaxChars: 12000,
      mrLimit: 60
    }
  );
  const errorMessage =
    workspaceErrorMessage ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load changelog'
      : null);
  const items = data?.items ?? [];
  const visibleItems = showMissing
    ? items
    : items.filter((item) => item.changelog.found || item.changelog.error);
  const missingCount = items.filter((item) => !item.changelog.found).length;

  return (
    <Card>
      <CardHeader className='gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>
            Workspace Change Logs
            {data?.workspace_path ? ` (${data.workspace_path})` : ''}
          </CardTitle>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              onClick={() => setShowMissing((current) => !current)}
            >
              {showMissing ? 'Hide missing' : 'Show missing'}
            </Button>
            <Button variant='outline' onClick={() => void mutate()}>
              Reload
            </Button>
          </div>
        </div>
        <div className='flex flex-wrap gap-2 text-xs'>
          <Badge variant='outline'>Projects: {data?.count ?? 0}</Badge>
          <Badge variant='secondary'>
            With changelog: {data?.found_count ?? 0}
          </Badge>
          <Badge variant='outline'>Missing: {missingCount}</Badge>
          <Badge variant='outline'>
            MRs checked: {data?.mr_rule.checked_merge_requests ?? 0}
          </Badge>
          <Badge
            variant={
              (data?.mr_rule.violations ?? 0) > 0 ? 'destructive' : 'secondary'
            }
          >
            MR rule violations: {data?.mr_rule.violations ?? 0}
          </Badge>
        </div>
        <p className='text-muted-foreground text-xs'>
          Rule: Jede offene MR muss eine Änderung an `change-log*`/`changelog*`
          enthalten.
        </p>
      </CardHeader>
      <CardContent className='space-y-3'>
        {(isLoading || isResolvingWorkspace) && (
          <p className='text-muted-foreground text-sm'>Loading changelogs...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}
        {!isLoading &&
          !isResolvingWorkspace &&
          !errorMessage &&
          visibleItems.length === 0 && (
            <p className='text-muted-foreground text-sm'>
              No changelog files found for this workspace.
            </p>
          )}
        {!isLoading &&
          !isResolvingWorkspace &&
          !errorMessage &&
          visibleItems.map((item) => (
            <div key={item.id} className='space-y-2 rounded-md border p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>
                    {item.path_with_namespace || item.name}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Project ID: {item.id}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  {item.changelog.found ? (
                    <Badge>Found</Badge>
                  ) : item.changelog.error ? (
                    <Badge variant='destructive'>Error</Badge>
                  ) : (
                    <Badge variant='secondary'>Missing</Badge>
                  )}
                </div>
              </div>

              {item.changelog.path && (
                <p className='text-muted-foreground text-xs'>
                  File: {item.changelog.path}
                  {item.changelog.ref ? ` (ref: ${item.changelog.ref})` : ''}
                  {item.changelog.truncated ? ' (truncated)' : ''}
                </p>
              )}
              {item.changelog.error && (
                <p className='text-destructive text-xs'>
                  {item.changelog.error}
                </p>
              )}
              {item.mr_rule.error && (
                <p className='text-destructive text-xs'>{item.mr_rule.error}</p>
              )}
              {!item.mr_rule.error &&
                item.mr_rule.checked_merge_requests > 0 && (
                  <p className='text-muted-foreground text-xs'>
                    MR rule: {item.mr_rule.checked_merge_requests} checked,{' '}
                    {item.mr_rule.violations} violations.
                  </p>
                )}
              {item.mr_rule.items
                .filter((mr) => !mr.has_changelog_change)
                .slice(0, 10)
                .map((mr) => (
                  <div
                    key={`${item.id}-mr-${mr.iid}`}
                    className='rounded border p-2'
                  >
                    <p className='text-sm font-medium'>
                      MR !{mr.iid}: {mr.title}
                    </p>
                    {mr.error && (
                      <p className='text-destructive text-xs'>{mr.error}</p>
                    )}
                    {!mr.error && (
                      <p className='text-muted-foreground text-xs'>
                        Kein Change-Log-Change erkannt.
                      </p>
                    )}
                    {mr.web_url && (
                      <a
                        href={mr.web_url}
                        target='_blank'
                        rel='noreferrer'
                        className='text-primary text-xs underline underline-offset-2'
                      >
                        Open MR in GitLab
                      </a>
                    )}
                  </div>
                ))}
              {item.changelog.content && (
                <pre className='bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap'>
                  {item.changelog.content}
                </pre>
              )}
              {item.changelog.web_url && (
                <a
                  href={item.changelog.web_url}
                  target='_blank'
                  rel='noreferrer'
                  className='text-primary text-xs underline underline-offset-2'
                >
                  Open file in GitLab
                </a>
              )}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
