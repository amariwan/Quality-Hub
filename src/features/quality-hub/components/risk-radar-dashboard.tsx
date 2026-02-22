'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { listWorkspaceGroups } from '@/features/quality-hub/api/client';
import { useRiskRadar } from '@/features/quality-hub/api/swr';
import { workspaceSlugFromGroupPath } from '@/features/quality-hub/workspace-context';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

function levelVariant(level: 'low' | 'medium' | 'high') {
  if (level === 'low') return 'default';
  if (level === 'medium') return 'secondary';
  return 'destructive';
}

function statusLabel(status: 'green' | 'yellow' | 'red') {
  if (status === 'green') return 'Stable';
  if (status === 'yellow') return 'Watch';
  return 'Critical';
}

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

export function RiskRadarDashboard() {
  const [weeks, setWeeks] = useState(3);
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
    workspaceSlug ? ['quality-hub', 'workspace-groups', 'risk-radar'] : null,
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
  const workspaceErrorMessage = workspaceSlug
    ? workspaceGroupsError
      ? workspaceGroupsError instanceof Error
        ? workspaceGroupsError.message
        : 'Failed to load workspace scope'
      : !isWorkspaceGroupsLoading && !matchedWorkspace
        ? `Workspace "${workspaceSlug}" not found.`
        : null
    : null;

  const { data, error, isLoading } = useRiskRadar(weeks, workspaceId);
  const errorMessage =
    workspaceErrorMessage ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load risk radar'
      : null);

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-4'>
          <CardTitle>
            Management Risk Radar
            {matchedWorkspace ? ` (${matchedWorkspace.gitlab_group_path})` : ''}
          </CardTitle>
          <div className='flex gap-2'>
            <Button
              variant={weeks === 3 ? 'default' : 'outline'}
              onClick={() => setWeeks(3)}
            >
              Last 3 weeks
            </Button>
            <Button
              variant={weeks === 6 ? 'default' : 'outline'}
              onClick={() => setWeeks(6)}
            >
              Last 6 weeks
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(isLoading || isResolvingWorkspace) && (
            <p className='text-muted-foreground text-sm'>
              Loading risk radar...
            </p>
          )}
          {errorMessage && (
            <p className='text-destructive text-sm'>{errorMessage}</p>
          )}
          {!isLoading && !isResolvingWorkspace && !errorMessage && data && (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>Projects</p>
                <p className='text-xl font-semibold'>
                  {data.summary.project_count}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>
                  High Release Risk
                </p>
                <p className='text-xl font-semibold'>
                  {data.summary.high_risk_projects}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>Regressions</p>
                <p className='text-xl font-semibold'>
                  {data.summary.regression_events}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>
                  Delivery Confidence
                </p>
                <p className='text-xl font-semibold'>
                  {data.summary.delivery_confidence_avg_pct.toFixed(1)}%
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>
                  Release Readiness
                </p>
                <p className='text-xl font-semibold'>
                  {data.summary.release_readiness_avg_pct.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && !isResolvingWorkspace && !errorMessage && data && (
        <div className='grid gap-6 xl:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Release Risk by Project</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.release_risk.projects.slice(0, 10).map((item) => (
                <div
                  key={`risk-${item.project_id}`}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <span className='text-sm'>{item.project}</span>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground text-xs'>
                      {item.score.toFixed(1)}
                    </span>
                    <Badge variant={levelVariant(item.level)}>
                      {item.label}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Confidence</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.delivery_confidence.slice(0, 10).map((item) => (
                <div
                  key={`dc-${item.project_id}`}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm'>{item.project}</p>
                    <p className='text-muted-foreground text-xs'>
                      MTTR:{' '}
                      {item.mttr_hours === null ? '-' : `${item.mttr_hours}h`} |
                      Flakiness Score: {item.flakiness_score_pct.toFixed(1)}%
                    </p>
                  </div>
                  <span className='text-sm font-medium'>
                    {item.value_pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Trend</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.quality_trend.map((item) => (
                <div
                  key={`qt-${item.week}`}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <span className='text-sm'>{item.week}</span>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground text-xs'>
                      {item.score.toFixed(1)}
                    </span>
                    <Badge variant='outline'>{item.label}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regressions</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.regressions.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No regressions detected.
                </p>
              )}
              {data.regressions.slice(0, 10).map((item, index) => (
                <div key={`rg-${index}`} className='rounded border p-2'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>{item.project}</p>
                    <Badge
                      variant={
                        item.severity === 'high' ? 'destructive' : 'secondary'
                      }
                    >
                      {item.severity}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground text-xs'>{item.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Quality Indicator</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.team_quality_indicator.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No teams configured.
                </p>
              )}
              {data.team_quality_indicator.map((item) => (
                <div
                  key={`team-${item.team}`}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <span className='text-sm'>{item.team}</span>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground text-xs'>
                      {item.project_count} projects
                    </span>
                    <Badge variant='outline'>
                      {statusLabel(item.stability)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Status</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.project_status.slice(0, 12).map((item) => (
                <div key={`ps-${item.project}`} className='rounded border p-2'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>{item.project}</p>
                    <Badge variant='outline'>{item.label}</Badge>
                  </div>
                  <p className='text-muted-foreground text-xs'>{item.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sprint Quality Summary</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-muted-foreground text-xs'>
                Window: {data.sprint_quality_summary.window_start} to{' '}
                {data.sprint_quality_summary.window_end}
              </p>
              <div className='grid gap-2 md:grid-cols-3'>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>
                    Build Stability
                  </p>
                  <p className='font-medium'>
                    {data.sprint_quality_summary.build_stability_pct.toFixed(1)}
                    %
                  </p>
                </div>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>
                    Regression Events
                  </p>
                  <p className='font-medium'>
                    {data.sprint_quality_summary.regression_events}
                  </p>
                </div>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>Release Risk</p>
                  <p className='font-medium'>
                    {data.sprint_quality_summary.release_risk.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Executive Notifications</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.executive_notifications.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No active notifications.
                </p>
              )}
              {data.executive_notifications.slice(0, 12).map((item, index) => (
                <div key={`en-${index}`} className='rounded border p-2'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>{item.title}</p>
                    <Badge
                      variant={
                        item.severity === 'high'
                          ? 'destructive'
                          : item.severity === 'medium'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {item.severity}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    {item.message}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Merge Impact Events</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.merge_impact_events.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No merge impact events.
                </p>
              )}
              {data.merge_impact_events.slice(0, 10).map((item) => (
                <div
                  key={`mi-${item.merge_pipeline_id}`}
                  className='rounded border p-2'
                >
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>
                      {item.project} ({item.target_branch || '-'})
                    </p>
                    <Badge variant='outline'>{item.impact}</Badge>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    Readiness {item.release_readiness_before.toFixed(1)}% -{'>'}{' '}
                    {item.release_readiness_after.toFixed(1)}% (
                    {item.delta > 0 ? '+' : ''}
                    {item.delta.toFixed(1)})
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && !isResolvingWorkspace && !errorMessage && data && (
        <Card>
          <CardHeader>
            <CardTitle>Change Log and Release Notes</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid gap-2 md:grid-cols-4'>
              <div className='rounded border p-2'>
                <p className='text-muted-foreground text-xs'>Delta Features</p>
                <p className='font-medium'>
                  {data.release_notes.comparison.new_features}
                </p>
              </div>
              <div className='rounded border p-2'>
                <p className='text-muted-foreground text-xs'>Delta Bugfixes</p>
                <p className='font-medium'>
                  {data.release_notes.comparison.bugfixes}
                </p>
              </div>
              <div className='rounded border p-2'>
                <p className='text-muted-foreground text-xs'>Delta Security</p>
                <p className='font-medium'>
                  {data.release_notes.comparison.security_fixes}
                </p>
              </div>
              <div className='rounded border p-2'>
                <p className='text-muted-foreground text-xs'>Known Risks</p>
                <p className='font-medium'>
                  {data.release_notes.comparison.known_risks}
                </p>
              </div>
            </div>

            <Separator />

            <div className='space-y-2'>
              {data.release_notes.feed.slice(0, 12).map((item, index) => (
                <div key={`rn-${index}`} className='rounded border p-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline'>{item.version}</Badge>
                    <Badge variant='outline'>{item.target_branch}</Badge>
                    <Badge variant='secondary'>{item.category_label}</Badge>
                    <Badge variant={levelVariant(item.risk.level)}>
                      {item.risk.label}
                    </Badge>
                  </div>
                  <p className='mt-2 text-sm'>
                    {item.project} | {item.date} | status: {item.status}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Why relevant: {item.why_relevant}
                  </p>
                  {item.known_issues.length > 0 && (
                    <p className='text-muted-foreground text-xs'>
                      Known issues: {item.known_issues.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
