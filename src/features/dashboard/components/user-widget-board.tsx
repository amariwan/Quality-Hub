'use client';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import {
  getGitlabProjectsInsights,
  getPipelines,
  getPortfolio,
  listProjects
} from '@/features/quality-hub/api/client';
import {
  GitlabProjectInsight,
  PipelineItem,
  PortfolioItem
} from '@/features/quality-hub/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis
} from 'recharts';
import { useCallback, useEffect, useMemo, useState } from 'react';

type WidgetType =
  | 'metric'
  | 'notes'
  | 'todo'
  | 'links'
  | 'status'
  | 'query'
  | 'chart';
type WidgetSize = 'sm' | 'md' | 'lg';
type SourceFilter = 'all' | 'custom' | 'default' | 'query' | 'pinned';
type SortMode = 'manual' | 'title' | 'recent';
type ChartKind = 'line' | 'bar' | 'pie';
type ChartSuggestionFilter = 'all' | ChartKind;
type WidgetDataSource =
  | 'metric_projects'
  | 'metric_broken_pipelines'
  | 'metric_portfolio_ready_pct'
  | 'chart_pipeline_status_mix'
  | 'chart_deployability_split'
  | 'chart_failure_reasons'
  | 'chart_environment_health'
  | 'chart_open_mrs_by_project'
  | 'chart_pipeline_outcome'
  | null;

type DashboardWidget = {
  id: string;
  title: string;
  type: WidgetType;
  size: WidgetSize;
  content: string;
  source: 'default' | 'custom';
  chartKind: ChartKind;
  dataSource: WidgetDataSource;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChartRow = { name: string; value: number };

type DashboardLiveData = {
  loading: boolean;
  error: string | null;
  projectsCount: number;
  brokenPipelinesCount: number;
  portfolioReadyPct: number | null;
  pipelineStatusRows: ChartRow[];
  deployabilityRows: ChartRow[];
  failureReasonsRows: ChartRow[];
  environmentHealthRows: ChartRow[];
  openMergeRequestsRows: ChartRow[];
  pipelineOutcomeRows: ChartRow[];
};

const STORAGE_KEY = 'qh.dashboard.widgets.v4';
const LEGACY_STORAGE_KEYS = [
  'qh.dashboard.widgets.v3',
  'qh.dashboard.widgets.v2'
];

const DEFAULT_WIDGETS: Array<
  Omit<DashboardWidget, 'pinned' | 'createdAt' | 'updatedAt'>
> = [
  {
    id: 'w-1',
    title: 'Tracked Projects',
    type: 'metric',
    size: 'sm',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'metric_projects'
  },
  {
    id: 'w-2',
    title: 'Broken Pipelines',
    type: 'metric',
    size: 'sm',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'metric_broken_pipelines'
  },
  {
    id: 'w-3',
    title: 'Portfolio Ready',
    type: 'metric',
    size: 'sm',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'metric_portfolio_ready_pct'
  },
  {
    id: 'w-4',
    title: 'Quick Links',
    type: 'links',
    size: 'md',
    content:
      'Portfolio|/dashboard/portfolio\nPipelines|/dashboard/pipelines\nGroups|/dashboard/groups',
    source: 'default',
    chartKind: 'bar',
    dataSource: null
  },
  {
    id: 'w-5',
    title: 'Pipeline Status Mix',
    type: 'chart',
    size: 'lg',
    content: '',
    source: 'default',
    chartKind: 'pie',
    dataSource: 'chart_pipeline_status_mix'
  },
  {
    id: 'w-6',
    title: 'Deployability Split',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'pie',
    dataSource: 'chart_deployability_split'
  },
  {
    id: 'w-7',
    title: 'Failure Reasons',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_failure_reasons'
  },
  {
    id: 'w-8',
    title: 'Environment Health',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_environment_health'
  },
  {
    id: 'w-9',
    title: 'Open MRs by Project',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_open_mrs_by_project'
  },
  {
    id: 'w-10',
    title: 'Pipeline Outcome',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_pipeline_outcome'
  }
];

const TEMPLATE_WIDGETS: Array<
  Omit<DashboardWidget, 'id' | 'pinned' | 'createdAt' | 'updatedAt'>
> = [
  {
    title: 'Pipeline Status Mix',
    type: 'chart',
    size: 'lg',
    content: '',
    source: 'default',
    chartKind: 'pie',
    dataSource: 'chart_pipeline_status_mix'
  },
  {
    title: 'Deployability Split',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'pie',
    dataSource: 'chart_deployability_split'
  },
  {
    title: 'Failure Reasons',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_failure_reasons'
  },
  {
    title: 'Environment Health',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_environment_health'
  },
  {
    title: 'Open MRs by Project',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_open_mrs_by_project'
  },
  {
    title: 'Pipeline Outcome',
    type: 'chart',
    size: 'md',
    content: '',
    source: 'default',
    chartKind: 'bar',
    dataSource: 'chart_pipeline_outcome'
  }
];

const DATA_SOURCE_LABELS: Record<Exclude<WidgetDataSource, null>, string> = {
  metric_projects: 'Projektbestand',
  metric_broken_pipelines: 'Pipeline Fehler',
  metric_portfolio_ready_pct: 'Portfolio Readiness',
  chart_pipeline_status_mix: 'Status-Verteilung',
  chart_deployability_split: 'Deployability-Verteilung',
  chart_failure_reasons: 'Top Failure Reasons',
  chart_environment_health: 'Umgebungsstatus',
  chart_open_mrs_by_project: 'Open MRs pro Projekt',
  chart_pipeline_outcome: 'Pipeline Ergebnis-Mix'
};

function widgetSizeClass(size: WidgetSize) {
  if (size === 'lg') return 'md:col-span-3';
  if (size === 'md') return 'md:col-span-2';
  return 'md:col-span-1';
}

function statusVariant(
  state: string
): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (state === 'green' || state === 'ok' || state === 'healthy')
    return 'secondary';
  if (state === 'red' || state === 'critical') return 'destructive';
  if (state === 'yellow' || state === 'warning') return 'outline';
  return 'default';
}

function nowIso() {
  return new Date().toISOString();
}

function defaultWidgetsWithMeta() {
  const now = nowIso();
  return DEFAULT_WIDGETS.map((item) => ({
    ...item,
    pinned: false,
    createdAt: now,
    updatedAt: now
  }));
}

function parseWidgetType(value: unknown): WidgetType {
  if (
    value === 'metric' ||
    value === 'notes' ||
    value === 'todo' ||
    value === 'links' ||
    value === 'status' ||
    value === 'query' ||
    value === 'chart'
  ) {
    return value;
  }
  return 'notes';
}

function parseChartKind(value: unknown): ChartKind {
  if (value === 'line' || value === 'bar' || value === 'pie') return value;
  return 'bar';
}

function parseWidgetSize(value: unknown): WidgetSize {
  if (value === 'sm' || value === 'md' || value === 'lg') return value;
  return 'md';
}

function parseWidgetDataSource(value: unknown): WidgetDataSource {
  if (
    value === 'metric_projects' ||
    value === 'metric_broken_pipelines' ||
    value === 'metric_portfolio_ready_pct' ||
    value === 'chart_pipeline_status_mix' ||
    value === 'chart_deployability_split' ||
    value === 'chart_failure_reasons' ||
    value === 'chart_environment_health' ||
    value === 'chart_open_mrs_by_project' ||
    value === 'chart_pipeline_outcome'
  ) {
    return value;
  }
  return null;
}

function normalizeWidgets(input: unknown): DashboardWidget[] {
  if (!Array.isArray(input)) return defaultWidgetsWithMeta();

  const now = nowIso();
  const normalized = input
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Partial<DashboardWidget>;
      const id = String(item.id || `w-norm-${index}`);
      const title = String(item.title || `Widget ${index + 1}`);
      const content = String(item.content || '');
      const source = item.source === 'custom' ? 'custom' : 'default';
      return {
        id,
        title,
        content,
        type: parseWidgetType(item.type),
        size: parseWidgetSize(item.size),
        source,
        chartKind: parseChartKind(item.chartKind),
        dataSource: parseWidgetDataSource(item.dataSource),
        pinned: Boolean(item.pinned),
        createdAt:
          typeof item.createdAt === 'string' && item.createdAt.trim().length > 0
            ? item.createdAt
            : now,
        updatedAt:
          typeof item.updatedAt === 'string' && item.updatedAt.trim().length > 0
            ? item.updatedAt
            : now
      };
    })
    .filter((item): item is DashboardWidget => Boolean(item));

  const unique: DashboardWidget[] = [];
  const seenIds = new Set<string>();

  normalized.forEach((item, index) => {
    let id = item.id.trim();
    if (!id) {
      id = `w-norm-${index}`;
    }
    while (seenIds.has(id)) {
      id = `${id}-dup`;
    }
    seenIds.add(id);
    unique.push(id === item.id ? item : { ...item, id });
  });

  return unique.length > 0 ? unique : defaultWidgetsWithMeta();
}

const LEGACY_DEMO_DEFAULT_TITLES = new Set([
  'Release Health',
  'Open Incidents',
  'Team Focus',
  'Leadership Notes',
  'Delivery Status',
  'Watchlist Pulse',
  'SLO Snapshot',
  'Open MRs Query',
  'Velocity Trend',
  'Incident Mix',
  'Pipeline Success Rate',
  'Alert Volume by Service',
  'Capacity Split'
]);

function syncDefaultWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  const cleaned = widgets.filter(
    (item) =>
      !(item.source === 'default' && LEGACY_DEMO_DEFAULT_TITLES.has(item.title))
  );

  const hasDefaultWidgetByTitle = new Set(
    cleaned
      .filter((item) => item.source === 'default')
      .map((item) => item.title.toLowerCase())
  );

  const usedIds = new Set(cleaned.map((item) => item.id));
  const now = nowIso();
  const missing = DEFAULT_WIDGETS.filter(
    (item) => !hasDefaultWidgetByTitle.has(item.title.toLowerCase())
  ).map((item) => {
    let id = item.id;
    while (usedIds.has(id)) {
      id = `${id}-default`;
    }
    usedIds.add(id);
    return {
      ...item,
      id,
      pinned: false,
      createdAt: now,
      updatedAt: now
    };
  });

  return [...cleaned, ...missing];
}

function loadInitialWidgets(): DashboardWidget[] {
  if (typeof window === 'undefined') return defaultWidgetsWithMeta();

  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeWidgets(parsed);
      return syncDefaultWidgets(normalized);
    } catch {
      continue;
    }
  }

  return defaultWidgetsWithMeta();
}

function widgetMatchesFilter(widget: DashboardWidget, filter: SourceFilter) {
  if (filter === 'all') return true;
  if (filter === 'custom') return widget.source === 'custom';
  if (filter === 'default') return widget.source === 'default';
  if (filter === 'query') return widget.type === 'query';
  if (filter === 'pinned') return widget.pinned;
  return true;
}

function parseChartRows(content: string): ChartRow[] {
  const rows = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nameRaw, valueRaw] = line.split('|');
      const name = (nameRaw || '').trim();
      const value = Number((valueRaw || '').trim());
      return { name, value };
    })
    .filter((row) => row.name.length > 0 && Number.isFinite(row.value));

  return rows;
}

function metricContentForWidget(
  widget: DashboardWidget,
  liveData: DashboardLiveData
): { headline: string; detail?: string } {
  if (widget.dataSource === 'metric_projects') {
    return {
      headline: String(liveData.projectsCount),
      detail: 'Projects with current data'
    };
  }
  if (widget.dataSource === 'metric_broken_pipelines') {
    return {
      headline: String(liveData.brokenPipelinesCount),
      detail: 'Current broken pipelines'
    };
  }
  if (widget.dataSource === 'metric_portfolio_ready_pct') {
    if (liveData.portfolioReadyPct === null) {
      return {
        headline: liveData.loading ? 'Loading...' : 'N/A',
        detail: 'No portfolio environments available'
      };
    }
    return {
      headline: `${liveData.portfolioReadyPct.toFixed(1)}%`,
      detail: 'Ready environments'
    };
  }
  return {
    headline: widget.content.split('\n')[0] || '--',
    detail: widget.content.split('\n')[1] || undefined
  };
}

function chartRowsForWidget(
  widget: DashboardWidget,
  liveData: DashboardLiveData
): ChartRow[] {
  if (widget.dataSource === 'chart_pipeline_status_mix')
    return liveData.pipelineStatusRows;
  if (widget.dataSource === 'chart_deployability_split')
    return liveData.deployabilityRows;
  if (widget.dataSource === 'chart_failure_reasons')
    return liveData.failureReasonsRows;
  if (widget.dataSource === 'chart_environment_health')
    return liveData.environmentHealthRows;
  if (widget.dataSource === 'chart_open_mrs_by_project')
    return liveData.openMergeRequestsRows;
  if (widget.dataSource === 'chart_pipeline_outcome')
    return liveData.pipelineOutcomeRows;
  return parseChartRows(widget.content);
}

const EMPTY_LIVE_DATA: DashboardLiveData = {
  loading: false,
  error: null,
  projectsCount: 0,
  brokenPipelinesCount: 0,
  portfolioReadyPct: null,
  pipelineStatusRows: [],
  deployabilityRows: [],
  failureReasonsRows: [],
  environmentHealthRows: [],
  openMergeRequestsRows: [],
  pipelineOutcomeRows: []
};

function countToRows(
  values: string[],
  formatLabel?: (value: string) => string
): ChartRow[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const key = raw.trim().toLowerCase() || 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({
      name: formatLabel ? formatLabel(name) : name,
      value
    }))
    .sort((a, b) => b.value - a.value);
}

function buildLiveDataSnapshot(args: {
  pipelines: PipelineItem[];
  portfolioItems: PortfolioItem[];
  insights: GitlabProjectInsight[];
  gitlabProjectPathById: Map<number, string>;
}): Omit<DashboardLiveData, 'loading' | 'error'> {
  const pipelineStatusRows = countToRows(
    args.pipelines.map((item) => item.status || 'unknown'),
    (value) => value.toUpperCase()
  );

  const deployabilityRows = countToRows(
    args.pipelines.map((item) => item.deployability_state || 'unknown'),
    (value) => value.replaceAll('_', ' ')
  );

  const failureReasonMap = new Map<string, number>();
  for (const item of args.pipelines) {
    for (const reason of item.failure_reasons) {
      const key = reason.trim().toLowerCase();
      if (!key) continue;
      failureReasonMap.set(key, (failureReasonMap.get(key) ?? 0) + 1);
    }
  }
  const failureReasonsRows = Array.from(failureReasonMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const environmentRows = countToRows(
    args.portfolioItems.flatMap((item) =>
      item.environments.map((env) => env.status || 'unknown')
    ),
    (value) => value.toUpperCase()
  );

  const totalEnvs = environmentRows.reduce((acc, row) => acc + row.value, 0);
  const readyEnvs =
    environmentRows.find((row) => row.name.toLowerCase() === 'ready')?.value ??
    0;
  const portfolioReadyPct =
    totalEnvs > 0 ? (readyEnvs / totalEnvs) * 100 : null;

  const openMergeRequestsRows = [...args.insights]
    .filter((item) => item.open_merge_requests > 0)
    .sort((a, b) => b.open_merge_requests - a.open_merge_requests)
    .slice(0, 8)
    .map((item) => ({
      name:
        args.gitlabProjectPathById.get(item.project_id) ||
        `Project ${item.project_id}`,
      value: item.open_merge_requests
    }));

  const failed = args.insights.reduce(
    (acc, item) => acc + item.failed_pipelines,
    0
  );
  const success = args.insights.reduce(
    (acc, item) => acc + item.success_pipelines,
    0
  );
  const running = args.insights.reduce(
    (acc, item) => acc + item.running_pipelines,
    0
  );
  const pipelineOutcomeRows = [
    { name: 'SUCCESS', value: success },
    { name: 'FAILED', value: failed },
    { name: 'RUNNING', value: running }
  ].filter((row) => row.value > 0);

  return {
    projectsCount: Math.max(args.portfolioItems.length, args.insights.length),
    brokenPipelinesCount: args.pipelines.length,
    portfolioReadyPct,
    pipelineStatusRows,
    deployabilityRows,
    failureReasonsRows,
    environmentHealthRows: environmentRows,
    openMergeRequestsRows,
    pipelineOutcomeRows
  };
}

function renderWidgetContent(
  widget: DashboardWidget,
  liveData: DashboardLiveData
) {
  if (widget.type === 'metric') {
    const metric = metricContentForWidget(widget, liveData);
    return (
      <div className='space-y-2'>
        <p className='text-3xl font-semibold'>{metric.headline}</p>
        {metric.detail && (
          <p className='text-muted-foreground text-sm'>{metric.detail}</p>
        )}
      </div>
    );
  }

  if (widget.type === 'notes') {
    return (
      <p className='text-sm whitespace-pre-line'>
        {widget.content || 'No notes yet.'}
      </p>
    );
  }

  if (widget.type === 'todo') {
    return (
      <ul className='list-disc space-y-1 pl-5 text-sm'>
        {(widget.content || '')
          .split('\n')
          .map((row) => row.trim())
          .filter(Boolean)
          .map((row) => (
            <li key={row}>{row}</li>
          ))}
      </ul>
    );
  }

  if (widget.type === 'links') {
    return (
      <div className='space-y-1 text-sm'>
        {(widget.content || '')
          .split('\n')
          .map((row) => row.trim())
          .filter(Boolean)
          .map((row) => {
            const [labelRaw, urlRaw] = row.split('|');
            const label = (labelRaw || 'Open').trim();
            const url = (urlRaw || labelRaw || '').trim();
            const isExternal =
              url.startsWith('http://') || url.startsWith('https://');
            return (
              <a
                key={row}
                className='block underline'
                href={url || '#'}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer' : undefined}
              >
                {label}
              </a>
            );
          })}
      </div>
    );
  }

  if (widget.type === 'status') {
    return (
      <div className='space-y-2'>
        <Badge
          variant={statusVariant(
            (widget.content.split('\n')[0] || '').trim().toLowerCase()
          )}
        >
          {(widget.content.split('\n')[0] || 'unknown').toUpperCase()}
        </Badge>
        {widget.content.split('\n')[1] && (
          <p className='text-muted-foreground text-sm'>
            {widget.content.split('\n')[1]}
          </p>
        )}
      </div>
    );
  }

  if (widget.type === 'chart') {
    const chartData = chartRowsForWidget(widget, liveData);
    const chartConfig = {
      value: {
        label: 'Value',
        color: 'var(--primary)'
      }
    };

    if (chartData.length === 0) {
      return (
        <p className='text-muted-foreground text-sm'>
          {liveData.loading && widget.dataSource
            ? 'Loading live data...'
            : 'No chart data available.'}
        </p>
      );
    }

    return (
      <ChartContainer config={chartConfig} className='h-[220px] w-full min-w-0'>
        {widget.chartKind === 'line' ? (
          <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='name' tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type='monotone'
              dataKey='value'
              stroke='var(--color-value)'
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : widget.chartKind === 'pie' ? (
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey='value'
              nameKey='name'
              innerRadius={40}
            />
          </PieChart>
        ) : (
          <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='name' tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey='value'
              fill='var(--color-value)'
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )}
      </ChartContainer>
    );
  }

  return (
    <pre className='bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap'>
      {widget.content || 'No query yet.'}
    </pre>
  );
}

type SortableWidgetCardProps = {
  widget: DashboardWidget;
  liveData: DashboardLiveData;
  index: number;
  total: number;
  allowReorder: boolean;
  isSettingsOpen: boolean;
  onToggleSettings: (id: string) => void;
  onMoveWidget: (id: string, direction: -1 | 1) => void;
  onRemoveWidget: (id: string) => void;
  onResizeWidget: (id: string, size: WidgetSize) => void;
  onDuplicateWidget: (id: string) => void;
  onTogglePin: (id: string) => void;
  onOpenEdit: (id: string) => void;
};

function SortableWidgetCard({
  widget,
  liveData,
  index,
  total,
  allowReorder,
  isSettingsOpen,
  onToggleSettings,
  onMoveWidget,
  onRemoveWidget,
  onResizeWidget,
  onDuplicateWidget,
  onTogglePin,
  onOpenEdit
}: SortableWidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: widget.id,
    disabled: !allowReorder
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <Card
      ref={setNodeRef}
      className={widgetSizeClass(widget.size)}
      style={style}
    >
      <CardHeader className='gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>{widget.title}</CardTitle>
          <div className='flex items-center gap-2'>
            {widget.pinned && <Badge variant='secondary'>Pinned</Badge>}
            <Badge variant='outline'>{widget.type}</Badge>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant={widget.source === 'custom' ? 'secondary' : 'outline'}>
            {widget.source}
          </Badge>
          <Button
            size='sm'
            variant={isSettingsOpen ? 'default' : 'outline'}
            onClick={() => onToggleSettings(widget.id)}
          >
            Edit
          </Button>
          {isSettingsOpen && (
            <>
              <Button
                size='sm'
                variant='outline'
                disabled={!allowReorder}
                {...attributes}
                {...listeners}
              >
                Drag
              </Button>
              <Button
                size='sm'
                variant={widget.pinned ? 'default' : 'outline'}
                onClick={() => onTogglePin(widget.id)}
              >
                Pin
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => onDuplicateWidget(widget.id)}
              >
                Duplicate
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => onOpenEdit(widget.id)}
              >
                Open Editor
              </Button>
              <Button
                size='sm'
                variant={widget.size === 'sm' ? 'default' : 'outline'}
                onClick={() => onResizeWidget(widget.id, 'sm')}
              >
                S
              </Button>
              <Button
                size='sm'
                variant={widget.size === 'md' ? 'default' : 'outline'}
                onClick={() => onResizeWidget(widget.id, 'md')}
              >
                M
              </Button>
              <Button
                size='sm'
                variant={widget.size === 'lg' ? 'default' : 'outline'}
                onClick={() => onResizeWidget(widget.id, 'lg')}
              >
                L
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={!allowReorder || index === 0}
                onClick={() => onMoveWidget(widget.id, -1)}
              >
                Up
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={!allowReorder || index === total - 1}
                onClick={() => onMoveWidget(widget.id, 1)}
              >
                Down
              </Button>
              <Button
                size='sm'
                variant='destructive'
                onClick={() => onRemoveWidget(widget.id)}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>{renderWidgetContent(widget, liveData)}</CardContent>
    </Card>
  );
}

export function UserWidgetBoard() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [widgets, setWidgets] = useState<DashboardWidget[]>(() =>
    defaultWidgetsWithMeta()
  );

  const [history, setHistory] = useState<DashboardWidget[][]>([]);
  const [idCounter, setIdCounter] = useState(2000);
  const [isInitialized, setIsInitialized] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<WidgetType>('notes');
  const [size, setSize] = useState<WidgetSize>('md');
  const [chartKind, setChartKind] = useState<ChartKind>('bar');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      new URLSearchParams(window.location.search).get('widgetStudio') === '1'
    );
  });

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartSuggestionFilter, setChartSuggestionFilter] =
    useState<ChartSuggestionFilter>('all');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<WidgetType>('notes');
  const [editSize, setEditSize] = useState<WidgetSize>('md');
  const [editChartKind, setEditChartKind] = useState<ChartKind>('bar');
  const [editContent, setEditContent] = useState('');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [pendingRemoveWidgetId, setPendingRemoveWidgetId] = useState<
    string | null
  >(null);
  const [liveData, setLiveData] = useState<DashboardLiveData>({
    ...EMPTY_LIVE_DATA,
    loading: true
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const loaded = loadInitialWidgets();
      setWidgets(loaded);
      setIdCounter(loaded.length + 2000);
      setIsInitialized(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isInitialized || widgets.length === 0) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [isInitialized, widgets]);

  const stats = useMemo(() => {
    return {
      total: widgets.length,
      custom: widgets.filter((item) => item.source === 'custom').length,
      queries: widgets.filter((item) => item.type === 'query').length,
      pinned: widgets.filter((item) => item.pinned).length
    };
  }, [widgets]);

  const queryWidgets = useMemo(
    () =>
      widgets.filter(
        (item) => item.type === 'query' && item.source === 'custom'
      ),
    [widgets]
  );
  const filteredTemplates = useMemo(
    () =>
      TEMPLATE_WIDGETS.filter((template) =>
        chartSuggestionFilter === 'all'
          ? true
          : template.chartKind === chartSuggestionFilter
      ),
    [chartSuggestionFilter]
  );

  const loadLiveData = useCallback(async () => {
    setLiveData((prev) => ({ ...prev, loading: true, error: null }));
    const errors: string[] = [];

    const [pipelinesResult, portfolioResult, projectsResult] =
      await Promise.allSettled([
        getPipelines('all'),
        getPortfolio({ showClusters: false, scope: 'readiness' }),
        listProjects()
      ]);

    const pipelines =
      pipelinesResult.status === 'fulfilled' ? pipelinesResult.value.items : [];
    if (pipelinesResult.status === 'rejected') {
      errors.push(
        `pipelines: ${pipelinesResult.reason instanceof Error ? pipelinesResult.reason.message : String(pipelinesResult.reason)}`
      );
    }

    const portfolioItems =
      portfolioResult.status === 'fulfilled' ? portfolioResult.value.items : [];
    if (portfolioResult.status === 'rejected') {
      errors.push(
        `portfolio: ${portfolioResult.reason instanceof Error ? portfolioResult.reason.message : String(portfolioResult.reason)}`
      );
    }

    const projectRows =
      projectsResult.status === 'fulfilled' ? projectsResult.value : [];
    if (projectsResult.status === 'rejected') {
      errors.push(
        `projects: ${projectsResult.reason instanceof Error ? projectsResult.reason.message : String(projectsResult.reason)}`
      );
    }

    const gitlabProjectPathById = new Map(
      projectRows.map((project) => [
        project.gitlab_project_id,
        project.path_with_namespace || `Project ${project.gitlab_project_id}`
      ])
    );

    let insights: GitlabProjectInsight[] = [];
    if (projectRows.length > 0) {
      // spreading a Set requires ES2015+ or downlevelIteration, which isn't enabled in our tsconfig (target is es5).
      // convert via Array.from to avoid compiler errors.
      const projectIds = Array.from(
        new Set(projectRows.map((project) => project.gitlab_project_id))
      );
      try {
        const insightsResponse = await getGitlabProjectsInsights(
          projectIds,
          40
        );
        insights = insightsResponse.items;
      } catch (err) {
        errors.push(
          `insights: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const snapshot = buildLiveDataSnapshot({
      pipelines,
      portfolioItems,
      insights,
      gitlabProjectPathById
    });

    setLiveData({
      ...snapshot,
      loading: false,
      error: errors.length > 0 ? errors.join(' | ') : null
    });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLiveData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadLiveData]);

  const visibleWidgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = widgets.filter((widget) =>
      widgetMatchesFilter(widget, sourceFilter)
    );

    if (q) {
      filtered = filtered.filter((widget) =>
        `${widget.title}\n${widget.content}\n${widget.type}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (sortMode === 'title') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    if (sortMode === 'recent') {
      return [...filtered].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
    }

    return filtered;
  }, [widgets, searchQuery, sourceFilter, sortMode]);

  const allowManualReorder =
    sortMode === 'manual' &&
    sourceFilter === 'all' &&
    searchQuery.trim().length === 0;

  const mutateWidgets = (
    updater: (prev: DashboardWidget[]) => DashboardWidget[]
  ) => {
    setWidgets((prev) => {
      const next = updater(prev);
      if (next !== prev) {
        setHistory((historyPrev) => [prev, ...historyPrev].slice(0, 20));
      }
      return next;
    });
  };

  const addTemplate = (
    template: Omit<DashboardWidget, 'id' | 'pinned' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = `w-${idCounter}`;
    const now = nowIso();
    setIdCounter((prev) => prev + 1);

    const newWidget: DashboardWidget = {
      ...template,
      id,
      source: 'custom',
      chartKind: template.chartKind,
      pinned: false,
      createdAt: now,
      updatedAt: now
    };

    mutateWidgets((prev) => [newWidget, ...prev]);
  };

  const createCustomWidget = () => {
    if (!title.trim()) {
      setError('Please enter a widget title.');
      return;
    }

    const id = `w-${idCounter}`;
    const now = nowIso();
    setIdCounter((prev) => prev + 1);

    const newWidget: DashboardWidget = {
      id,
      title: title.trim(),
      type,
      size,
      content: content.trim(),
      source: 'custom',
      chartKind,
      dataSource: null,
      pinned: false,
      createdAt: now,
      updatedAt: now
    };

    mutateWidgets((prev) => [newWidget, ...prev]);
    setTitle('');
    setContent('');
    setType('notes');
    setSize('md');
    setChartKind('bar');
    setError(null);
  };

  const removeWidget = (id: string) => {
    mutateWidgets((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmRemoveWidget = () => {
    if (!pendingRemoveWidgetId) return;
    removeWidget(pendingRemoveWidgetId);
    setPendingRemoveWidgetId(null);
  };

  const moveWidget = (id: string, direction: -1 | 1) => {
    if (!allowManualReorder) return;

    mutateWidgets((prev) => {
      const next = [...prev];
      const index = next.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const resizeWidget = (id: string, nextSize: WidgetSize) => {
    mutateWidgets((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, size: nextSize, updatedAt: nowIso() } : item
      )
    );
  };

  const duplicateWidget = (id: string) => {
    const target = widgets.find((item) => item.id === id);
    if (!target) return;

    const now = nowIso();
    const nextId = `w-${idCounter}`;
    setIdCounter((prev) => prev + 1);

    const duplicate: DashboardWidget = {
      ...target,
      id: nextId,
      title: `${target.title} (Copy)`,
      source: 'custom',
      pinned: false,
      createdAt: now,
      updatedAt: now
    };

    mutateWidgets((prev) => [duplicate, ...prev]);
  };

  const togglePin = (id: string) => {
    mutateWidgets((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, pinned: !item.pinned, updatedAt: nowIso() }
          : item
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!allowManualReorder) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    mutateWidgets((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === String(active.id));
      const newIndex = prev.findIndex((item) => item.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const resetWidgets = () => {
    mutateWidgets(() => defaultWidgetsWithMeta());
    setError(null);
  };

  const openEditDialog = (id: string) => {
    const current = widgets.find((item) => item.id === id);
    if (!current) return;

    setEditingWidgetId(id);
    setEditTitle(current.title);
    setEditType(current.type);
    setEditSize(current.size);
    setEditChartKind(current.chartKind);
    setEditContent(current.content);
    setIsEditOpen(true);
  };

  const saveEditWidget = () => {
    if (!editingWidgetId) return;
    if (!editTitle.trim()) {
      setError('Please enter a widget title.');
      return;
    }

    mutateWidgets((prev) =>
      prev.map((item) =>
        item.id === editingWidgetId
          ? {
              ...item,
              title: editTitle.trim(),
              type: editType,
              size: editSize,
              chartKind: editChartKind,
              dataSource: item.source === 'default' ? item.dataSource : null,
              content: editContent.trim(),
              updatedAt: nowIso()
            }
          : item
      )
    );

    setIsEditOpen(false);
    setEditingWidgetId(null);
    setError(null);
  };

  const undoLast = () => {
    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;
      const [last, ...rest] = prevHistory;
      setWidgets(last);
      return rest;
    });
  };

  const exportWidgets = () => {
    const payload = JSON.stringify(widgets, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-widgets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importWidgetsFromText = () => {
    try {
      const parsed = JSON.parse(importPayload) as unknown;
      const normalized = normalizeWidgets(parsed);
      mutateWidgets(() => normalized);
      setIdCounter(normalized.length + 2000);
      setImportPayload('');
      setIsImportOpen(false);
      setError(null);
    } catch {
      setError('Import failed. Please provide valid widget JSON.');
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-end gap-2'>
        <Button
          variant='outline'
          onClick={() => {
            void loadLiveData();
          }}
          disabled={liveData.loading}
        >
          {liveData.loading ? 'Loading live data...' : 'Refresh live data'}
        </Button>
        <Input
          className='w-full md:w-64'
          placeholder='Search widgets...'
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <Select
          value={sourceFilter}
          onValueChange={(value) => setSourceFilter(value as SourceFilter)}
        >
          <SelectTrigger className='w-full md:w-40'>
            <SelectValue placeholder='Filter' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>all</SelectItem>
            <SelectItem value='custom'>custom</SelectItem>
            <SelectItem value='default'>default</SelectItem>
            <SelectItem value='query'>query</SelectItem>
            <SelectItem value='pinned'>pinned</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortMode}
          onValueChange={(value) => setSortMode(value as SortMode)}
        >
          <SelectTrigger className='w-full md:w-40'>
            <SelectValue placeholder='Sort' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='manual'>manual</SelectItem>
            <SelectItem value='title'>title</SelectItem>
            <SelectItem value='recent'>recent</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={isStudioOpen} onOpenChange={setIsStudioOpen}>
          <DialogTrigger asChild>
            <Button variant='outline'>Edit Widget</Button>
          </DialogTrigger>
          <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-3xl'>
            <DialogHeader>
              <DialogTitle>Widget Studio</DialogTitle>
              <DialogDescription>
                Erstelle, verwalte, importiere und exportiere deine
                Dashboard-Widgets.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline'>Total: {stats.total}</Badge>
                <Badge variant='secondary'>Custom: {stats.custom}</Badge>
                <Badge variant='outline'>Queries: {stats.queries}</Badge>
                <Badge variant='outline'>Pinned: {stats.pinned}</Badge>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={undoLast}
                  disabled={history.length === 0}
                >
                  Undo
                </Button>
                <Button size='sm' variant='outline' onClick={exportWidgets}>
                  Export JSON
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setIsImportOpen(true)}
                >
                  Import JSON
                </Button>
                <Button size='sm' variant='outline' onClick={resetWidgets}>
                  Reset defaults
                </Button>
              </div>

              <div className='grid gap-2 md:grid-cols-6'>
                <Input
                  placeholder='Widget title'
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as WidgetType)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='notes'>notes</SelectItem>
                    <SelectItem value='metric'>metric</SelectItem>
                    <SelectItem value='todo'>todo</SelectItem>
                    <SelectItem value='links'>links</SelectItem>
                    <SelectItem value='status'>status</SelectItem>
                    <SelectItem value='query'>query</SelectItem>
                    <SelectItem value='chart'>chart</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={size}
                  onValueChange={(value) => setSize(value as WidgetSize)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Size' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='sm'>small</SelectItem>
                    <SelectItem value='md'>medium</SelectItem>
                    <SelectItem value='lg'>large</SelectItem>
                  </SelectContent>
                </Select>
                {type === 'chart' && (
                  <Select
                    value={chartKind}
                    onValueChange={(value) => setChartKind(value as ChartKind)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Chart kind' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='line'>line</SelectItem>
                      <SelectItem value='bar'>bar</SelectItem>
                      <SelectItem value='pie'>pie</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={createCustomWidget}>Create widget</Button>
                <Button variant='outline' onClick={() => setContent('')}>
                  Clear content
                </Button>
              </div>

              <Textarea
                rows={4}
                placeholder='Widget content. Todo/links: one line each. Links: Label|URL. Chart: Label|Number pro Zeile.'
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />

              {error && <p className='text-destructive text-sm'>{error}</p>}

              <div className='space-y-3'>
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>
                    Chart- und Diagramm-Vorschlaege
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Diese Vorschlaege nutzen echte Live-Daten aus Portfolio,
                    Pipelines und GitLab Insights.
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Select
                    value={chartSuggestionFilter}
                    onValueChange={(value) =>
                      setChartSuggestionFilter(value as ChartSuggestionFilter)
                    }
                  >
                    <SelectTrigger className='w-full md:w-44'>
                      <SelectValue placeholder='Chart-Filter' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>all</SelectItem>
                      <SelectItem value='bar'>bar</SelectItem>
                      <SelectItem value='line'>line</SelectItem>
                      <SelectItem value='pie'>pie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2 md:grid-cols-2'>
                  {filteredTemplates.map((template) => (
                    <Button
                      key={template.title}
                      variant='secondary'
                      className='h-auto items-start justify-between p-3 text-left'
                      onClick={() => addTemplate(template)}
                    >
                      <span className='space-y-1'>
                        <span className='block text-sm font-medium'>
                          {template.title}
                        </span>
                        <span className='text-muted-foreground block text-xs'>
                          {template.dataSource
                            ? DATA_SOURCE_LABELS[template.dataSource]
                            : 'Live data'}
                        </span>
                      </span>
                      <Badge variant='outline'>{template.chartKind}</Badge>
                    </Button>
                  ))}
                </div>
                {filteredTemplates.length === 0 && (
                  <p className='text-muted-foreground text-xs'>
                    Keine Vorschlaege fuer den gewaehlten Chart-Typ.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {liveData.error && (
        <p className='text-destructive text-sm'>
          Live data warning: {liveData.error}
        </p>
      )}

      {!allowManualReorder && (
        <p className='text-muted-foreground text-sm'>
          Manual Drag/Up/Down ist nur im Modus{' '}
          <code>manual + all + ohne Search</code> aktiv.
        </p>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Edit Widget</DialogTitle>
            <DialogDescription>
              Passe Titel, Typ, Größe und Inhalt des ausgewählten Widgets an.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <Input
              placeholder='Widget title'
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
            />
            <div className='grid gap-2 md:grid-cols-3'>
              <Select
                value={editType}
                onValueChange={(value) => setEditType(value as WidgetType)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='notes'>notes</SelectItem>
                  <SelectItem value='metric'>metric</SelectItem>
                  <SelectItem value='todo'>todo</SelectItem>
                  <SelectItem value='links'>links</SelectItem>
                  <SelectItem value='status'>status</SelectItem>
                  <SelectItem value='query'>query</SelectItem>
                  <SelectItem value='chart'>chart</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={editSize}
                onValueChange={(value) => setEditSize(value as WidgetSize)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Size' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='sm'>small</SelectItem>
                  <SelectItem value='md'>medium</SelectItem>
                  <SelectItem value='lg'>large</SelectItem>
                </SelectContent>
              </Select>
              {editType === 'chart' && (
                <Select
                  value={editChartKind}
                  onValueChange={(value) =>
                    setEditChartKind(value as ChartKind)
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Chart kind' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='line'>line</SelectItem>
                    <SelectItem value='bar'>bar</SelectItem>
                    <SelectItem value='pie'>pie</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Textarea
              rows={8}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
            />
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveEditWidget}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Import Widgets</DialogTitle>
            <DialogDescription>
              Fuege hier exportiertes JSON ein, um dein Layout zu laden.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <Textarea
              rows={12}
              placeholder='[ { "id": "w-1", "title": "..." } ]'
              value={importPayload}
              onChange={(event) => setImportPayload(event.target.value)}
            />
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setIsImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={importWidgetsFromText}>Import</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className='gap-2'>
          <CardTitle>My Queries</CardTitle>
          <p className='text-muted-foreground text-sm'>
            Hier siehst du alle selbst erstellten Query-Widgets.
          </p>
        </CardHeader>
        <CardContent className='space-y-2'>
          {queryWidgets.length === 0 && (
            <p className='text-muted-foreground text-sm'>
              Noch keine eigenen Queries vorhanden. Erstelle ein Widget mit Typ{' '}
              <code>query</code>.
            </p>
          )}
          {queryWidgets.map((widget) => (
            <div key={`query-${widget.id}`} className='rounded-md border p-3'>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <p className='text-sm font-medium'>{widget.title}</p>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={async () => {
                    await navigator.clipboard.writeText(widget.content);
                  }}
                >
                  Copy
                </Button>
              </div>
              <pre className='text-muted-foreground mt-2 overflow-auto text-xs whitespace-pre-wrap'>
                {widget.content}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map((widget) => widget.id)}
          strategy={rectSortingStrategy}
        >
          <div className='grid gap-4 md:grid-cols-3'>
            {visibleWidgets.map((widget, index) => (
              <SortableWidgetCard
                key={widget.id}
                widget={widget}
                liveData={liveData}
                index={index}
                total={visibleWidgets.length}
                allowReorder={allowManualReorder}
                isSettingsOpen={settingsWidgetId === widget.id}
                onToggleSettings={(id) =>
                  setSettingsWidgetId((prev) => (prev === id ? null : id))
                }
                onMoveWidget={moveWidget}
                onRemoveWidget={setPendingRemoveWidgetId}
                onResizeWidget={resizeWidget}
                onDuplicateWidget={duplicateWidget}
                onTogglePin={togglePin}
                onOpenEdit={openEditDialog}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog
        open={Boolean(pendingRemoveWidgetId)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveWidgetId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Widget</DialogTitle>
            <DialogDescription>
              Willst du dieses Widget wirklich entfernen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setPendingRemoveWidgetId(null)}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={confirmRemoveWidget}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
