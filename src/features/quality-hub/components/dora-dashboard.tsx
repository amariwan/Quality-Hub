'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { listWorkspaceGroups } from '@/features/quality-hub/api/client';
import { useDoraMetrics } from '@/features/quality-hub/api/swr';
import { workspaceSlugFromGroupPath } from '@/features/quality-hub/workspace-context';
import {
  IconRocket,
  IconClock,
  IconShieldCheck,
  IconHeartRateMonitor,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconRefresh
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import useSWR from 'swr';

type Classification = 'elite' | 'high' | 'medium' | 'low' | string;

const CLASSIFICATION_SCORE: Record<string, number> = {
  elite: 100,
  high: 75,
  medium: 50,
  low: 25
};

const CLASSIFICATION_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  elite: 'default',
  high: 'secondary',
  medium: 'outline',
  low: 'destructive'
};

const CLASSIFICATION_COLOR: Record<string, string> = {
  elite: 'var(--color-elite)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)'
};

const WINDOW_OPTIONS = [
  { label: '30 d', days: 30 },
  { label: '60 d', days: 60 },
  { label: '90 d', days: 90 }
] as const;

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
  'workspace',
  'dora'
]);

function extractWorkspaceSlugFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'dashboard') return null;
  const candidate = segments[1] || null;
  if (!candidate || DASHBOARD_STATIC_SEGMENTS.has(candidate)) return null;
  return candidate;
}

function classificationScore(c: Classification): number {
  return CLASSIFICATION_SCORE[c] ?? 0;
}

function classificationVariant(
  c: Classification
): 'default' | 'secondary' | 'destructive' | 'outline' {
  return CLASSIFICATION_VARIANT[c] ?? 'outline';
}

function ClassificationBadge({ value }: { value: Classification }) {
  return (
    <Badge variant={classificationVariant(value)} className='capitalize'>
      {value}
    </Badge>
  );
}

function TrendIcon({ classification }: { classification: Classification }) {
  if (classification === 'elite')
    return <IconTrendingUp className='h-4 w-4 text-green-500' />;
  if (classification === 'high')
    return <IconTrendingUp className='h-4 w-4 text-blue-500' />;
  if (classification === 'medium')
    return <IconMinus className='h-4 w-4 text-yellow-500' />;
  return <IconTrendingDown className='h-4 w-4 text-red-500' />;
}

const radarChartConfig = {
  score: {
    label: 'Score',
    color: 'var(--primary)'
  },
  elite: {
    label: 'Elite',
    color: '#22c55e'
  },
  high: {
    label: 'High',
    color: '#3b82f6'
  },
  medium: {
    label: 'Medium',
    color: '#eab308'
  },
  low: {
    label: 'Low',
    color: '#ef4444'
  }
} satisfies ChartConfig;

export function DoraDashboard() {
  const [days, setDays] = useState<number>(30);
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
    workspaceSlug ? ['quality-hub', 'workspace-groups', 'dora'] : null,
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

  const { data, error, isLoading, mutate } = useDoraMetrics({
    workspaceId,
    days
  });

  const errorMessage =
    workspaceErrorMessage ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load DORA metrics'
      : null);

  const radarData = useMemo(() => {
    if (!data) return null;
    return [
      {
        metric: 'Deployment Frequency',
        score: classificationScore(data.deployment_frequency.classification)
      },
      {
        metric: 'Lead Time',
        score: classificationScore(data.lead_time_hours.classification)
      },
      {
        metric: 'Change Failure Rate',
        score: classificationScore(data.change_failure_rate.classification)
      },
      {
        metric: 'MTTR',
        score: classificationScore(data.mttr_hours.classification)
      }
    ];
  }, [data]);

  const isReady = !isResolvingWorkspace && data;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='space-y-1'>
          <p className='text-muted-foreground text-sm'>
            Four key engineering excellence metrics based on deployment &
            incident data.
          </p>
          {data && (
            <p className='text-muted-foreground text-xs'>
              Sample size: {data.sample_size} events · Window:{' '}
              {data.window_days} days
            </p>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {/* Window selector */}
          <div className='flex gap-1'>
            {WINDOW_OPTIONS.map((opt) => (
              <Button
                key={opt.days}
                size='sm'
                variant={days === opt.days ? 'default' : 'outline'}
                onClick={() => setDays(opt.days)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => void mutate()}
            disabled={isLoading}
          >
            <IconRefresh
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className='bg-destructive/10 text-destructive rounded-md p-3 text-sm'>
          {errorMessage}
        </div>
      )}

      {/* Loading */}
      {(isLoading || isResolvingWorkspace) && !data && (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className='animate-pulse'>
              <CardHeader className='pb-2'>
                <div className='bg-muted h-4 w-32 rounded' />
              </CardHeader>
              <CardContent>
                <div className='bg-muted mb-2 h-8 w-24 rounded' />
                <div className='bg-muted h-3 w-16 rounded' />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {isReady && (
        <>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {/* Deployment Frequency */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Deployment Frequency
                </CardTitle>
                <IconRocket className='text-muted-foreground h-4 w-4' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {data.deployment_frequency.deployments}
                </div>
                <p className='text-muted-foreground text-xs'>deployments</p>
                <div className='mt-2 flex items-center gap-2'>
                  <TrendIcon
                    classification={data.deployment_frequency.classification}
                  />
                  <span className='text-muted-foreground text-xs'>
                    {data.deployment_frequency.per_day.toFixed(2)}/day ·{' '}
                    {data.deployment_frequency.per_week.toFixed(2)}/week
                  </span>
                </div>
                <div className='mt-2'>
                  <ClassificationBadge
                    value={data.deployment_frequency.classification}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lead Time */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Lead Time for Changes
                </CardTitle>
                <IconClock className='text-muted-foreground h-4 w-4' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {data.lead_time_hours.value === null
                    ? '–'
                    : `${data.lead_time_hours.value} h`}
                </div>
                <p className='text-muted-foreground text-xs'>
                  commit → production
                </p>
                <div className='mt-2 flex items-center gap-2'>
                  <TrendIcon
                    classification={data.lead_time_hours.classification}
                  />
                  <span className='text-muted-foreground text-xs'>
                    elite: &lt;1 h · high: &lt;24 h
                  </span>
                </div>
                <div className='mt-2'>
                  <ClassificationBadge
                    value={data.lead_time_hours.classification}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Change Failure Rate */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Change Failure Rate
                </CardTitle>
                <IconShieldCheck className='text-muted-foreground h-4 w-4' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {data.change_failure_rate.pct.toFixed(1)} %
                </div>
                <p className='text-muted-foreground text-xs'>
                  failed deployments
                </p>
                <div className='mt-2 flex items-center gap-2'>
                  <TrendIcon
                    classification={data.change_failure_rate.classification}
                  />
                  <span className='text-muted-foreground text-xs'>
                    elite: &lt;5 % · high: &lt;10 %
                  </span>
                </div>
                <div className='mt-2'>
                  <ClassificationBadge
                    value={data.change_failure_rate.classification}
                  />
                </div>
              </CardContent>
            </Card>

            {/* MTTR */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>MTTR</CardTitle>
                <IconHeartRateMonitor className='text-muted-foreground h-4 w-4' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {data.mttr_hours.value === null
                    ? '–'
                    : `${data.mttr_hours.value} h`}
                </div>
                <p className='text-muted-foreground text-xs'>
                  mean time to recovery
                </p>
                <div className='mt-2 flex items-center gap-2'>
                  <TrendIcon classification={data.mttr_hours.classification} />
                  <span className='text-muted-foreground text-xs'>
                    elite: &lt;1 h · high: &lt;24 h
                  </span>
                </div>
                <div className='mt-2'>
                  <ClassificationBadge value={data.mttr_hours.classification} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall + Radar */}
          <div className='grid gap-4 md:grid-cols-2'>
            {/* Overall classification */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Classification</CardTitle>
                <CardDescription>{data.calculation_note}</CardDescription>
              </CardHeader>
              <CardContent className='flex flex-col items-center justify-center gap-4 py-6'>
                <span
                  className='text-5xl font-extrabold capitalize'
                  style={{
                    color:
                      CLASSIFICATION_COLOR[data.overall_classification] ??
                      'inherit'
                  }}
                >
                  {data.overall_classification}
                </span>
                <Badge
                  variant={classificationVariant(data.overall_classification)}
                  className='text-base capitalize'
                >
                  DORA {data.overall_classification}
                </Badge>
              </CardContent>
            </Card>

            {/* Radar chart */}
            <Card>
              <CardHeader>
                <CardTitle>Metric Scores</CardTitle>
                <CardDescription>
                  Classification mapped to 0–100 (elite=100, low=25)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={radarChartConfig}
                  className='mx-auto aspect-square max-h-65'
                >
                  <RadarChart data={radarData ?? []}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey='metric' tick={{ fontSize: 11 }} />
                    <Radar
                      dataKey='score'
                      fill='var(--primary)'
                      fillOpacity={0.25}
                      stroke='var(--primary)'
                      strokeWidth={2}
                      dot
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </RadarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Classification reference table */}
          <Card>
            <CardHeader>
              <CardTitle>DORA Classification Thresholds</CardTitle>
              <CardDescription>
                Reference values used to classify each metric (DORA 2023 report)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>
                      <Badge variant='default'>Elite</Badge>
                    </TableHead>
                    <TableHead>
                      <Badge variant='secondary'>High</Badge>
                    </TableHead>
                    <TableHead>
                      <Badge variant='outline'>Medium</Badge>
                    </TableHead>
                    <TableHead>
                      <Badge variant='destructive'>Low</Badge>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className='font-medium'>
                      Deployment Frequency
                    </TableCell>
                    <TableCell>On-demand / multiple per day</TableCell>
                    <TableCell>1×/week – 1×/month</TableCell>
                    <TableCell>1×/month – 1×/6 months</TableCell>
                    <TableCell>&lt; 1× / 6 months</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>
                      Lead Time for Changes
                    </TableCell>
                    <TableCell>&lt; 1 hour</TableCell>
                    <TableCell>1 h – 1 day</TableCell>
                    <TableCell>1 day – 1 week</TableCell>
                    <TableCell>&gt; 1 week</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>
                      Change Failure Rate
                    </TableCell>
                    <TableCell>0 – 5 %</TableCell>
                    <TableCell>5 – 10 %</TableCell>
                    <TableCell>10 – 15 %</TableCell>
                    <TableCell>&gt; 15 %</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>MTTR</TableCell>
                    <TableCell>&lt; 1 hour</TableCell>
                    <TableCell>1 h – 1 day</TableCell>
                    <TableCell>1 day – 1 week</TableCell>
                    <TableCell>&gt; 1 week</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
