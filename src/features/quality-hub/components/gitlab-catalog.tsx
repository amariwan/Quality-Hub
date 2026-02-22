'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  buildGitlabLiveWebSocketUrl,
  createWorkspaceWatchlist,
  deleteWorkspaceWatchlist,
  getGitlabProjectsInsights,
  listProjects,
  listGitlabGroups,
  listGitlabProjectEvents,
  listGitlabProjects,
  listWorkspaceWatchlist,
  triggerProjectSync
} from '@/features/quality-hub/api/client';
import {
  GitlabGroup,
  GitlabProjectInsight,
  GitlabProject,
  GitlabProjectEvent
} from '@/features/quality-hub/types';
import { readActiveWorkspaceContext } from '@/features/quality-hub/workspace-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type EventFeedItem = GitlabProjectEvent & { project_id: number };

export function GitlabCatalog() {
  const [groups, setGroups] = useState<GitlabGroup[]>([]);
  const [projects, setProjects] = useState<GitlabProject[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeWorkspaceGroupId, setActiveWorkspaceGroupId] = useState<
    number | null
  >(null);
  const [activeWorkspaceGroupPath, setActiveWorkspaceGroupPath] = useState<
    string | null
  >(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventFeedItem[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [eventRef, setEventRef] = useState('');
  const [eventSource, setEventSource] = useState('');
  const [eventLimit, setEventLimit] = useState(50);
  const [feedMode, setFeedMode] = useState<'single' | 'selected'>('single');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [liveIntervalSeconds, setLiveIntervalSeconds] = useState(10);
  const [liveEventsLimit, setLiveEventsLimit] = useState(20);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveReconnectAttempt, setLiveReconnectAttempt] = useState(0);
  const [liveNextRetryAt, setLiveNextRetryAt] = useState<number | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [highAttentionAlerts, setHighAttentionAlerts] = useState<
    GitlabProjectInsight[]
  >([]);
  const [notificationsHighEnabled, setNotificationsHighEnabled] =
    useState(true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] =
    useState(false);
  const lastHighAlertSignatureRef = useRef<string>('');
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [watchlistItemIdByGitlabId, setWatchlistItemIdByGitlabId] = useState<
    Map<number, number>
  >(new Map());
  const [watchlistBusyProjectId, setWatchlistBusyProjectId] = useState<
    number | null
  >(null);
  const [insights, setInsights] = useState<GitlabProjectInsight[]>([]);
  const [insightsTotals, setInsightsTotals] = useState<{
    projects: number;
    open_merge_requests: number;
    pipelines_sampled: number;
    failed_pipelines: number;
    failure_rate_pct: number;
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsPipelineLimit, setInsightsPipelineLimit] = useState(40);
  const [error, setError] = useState<string | null>(null);

  const scopeStorageKey = (scope: string, key: string) =>
    `qh.scope.${scope}.${key}`;

  const projectNameById = useMemo(
    () => new Map(projects.map((item) => [item.id, item.name])),
    [projects]
  );

  const loadGroups = useCallback(async () => {
    const data = await listGitlabGroups();
    setGroups(data);
  }, []);

  const loadProjects = useCallback(async (groupId?: number | null) => {
    const data = await listGitlabProjects(groupId ?? null);
    setProjects(data);
  }, []);

  const loadWatchlistIndex = useCallback(async () => {
    const [workspaceProjects, watchlistItems] = await Promise.all([
      listProjects(),
      listWorkspaceWatchlist()
    ]);

    const gitlabIdByLocalId = new Map(
      workspaceProjects.map((project) => [
        project.id,
        project.gitlab_project_id
      ])
    );

    const next = new Map<number, number>();
    for (const item of watchlistItems) {
      const gitlabProjectId = gitlabIdByLocalId.get(item.project_id);
      if (!gitlabProjectId) continue;
      next.set(gitlabProjectId, item.id);
    }
    setWatchlistItemIdByGitlabId(next);
  }, []);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      await Promise.all([
        loadGroups(),
        loadProjects(selectedGroupId),
        loadWatchlistIndex()
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load GitLab data'
      );
    } finally {
      setLoading(false);
    }
  }, [loadGroups, loadProjects, loadWatchlistIndex, selectedGroupId]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    setSelectedProjectIds((prev) =>
      prev.filter((id) => projects.some((project) => project.id === id))
    );
    setActiveProjectId((prev) => {
      if (prev && projects.some((project) => project.id === prev)) return prev;
      return projects[0]?.id ?? null;
    });
  }, [projects]);

  const loadEventsSingle = useCallback(async () => {
    if (activeProjectId === null) {
      setEvents([]);
      return;
    }
    const data = await listGitlabProjectEvents(activeProjectId, {
      limit: eventLimit,
      status: eventStatus || undefined,
      ref: eventRef || undefined,
      source: eventSource || undefined
    });
    setEvents(
      data.items.map((item) => ({ ...item, project_id: activeProjectId }))
    );
  }, [activeProjectId, eventLimit, eventRef, eventSource, eventStatus]);

  const loadEventsSelected = useCallback(async () => {
    if (selectedProjectIds.length === 0) {
      setEvents([]);
      return;
    }
    const responses = await Promise.all(
      selectedProjectIds.map(async (projectId) => {
        const response = await listGitlabProjectEvents(projectId, {
          limit: Math.max(
            10,
            Math.floor(eventLimit / Math.max(1, selectedProjectIds.length))
          ),
          status: eventStatus || undefined,
          ref: eventRef || undefined,
          source: eventSource || undefined
        });
        return response.items.map((item) => ({
          ...item,
          project_id: projectId
        }));
      })
    );
    const merged = responses
      .flat()
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, eventLimit);
    setEvents(merged);
  }, [eventLimit, eventRef, eventSource, eventStatus, selectedProjectIds]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      setError(null);
      if (feedMode === 'single') {
        await loadEventsSingle();
      } else {
        await loadEventsSelected();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load project events'
      );
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [feedMode, loadEventsSelected, loadEventsSingle]);

  useEffect(() => {
    if (liveMode) return;
    void loadEvents();
  }, [liveMode, loadEvents]);

  useEffect(() => {
    if (!autoRefresh || liveMode) return;
    const intervalId = setInterval(() => {
      void loadEvents();
    }, 15000);
    return () => clearInterval(intervalId);
  }, [autoRefresh, liveMode, loadEvents]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const context = readActiveWorkspaceContext();
    if (context.gitlabGroupId) {
      setSelectedGroupId(context.gitlabGroupId);
      setActiveWorkspaceGroupId(context.gitlabGroupId);
      setActiveWorkspaceGroupPath(context.gitlabGroupPath);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const context = readActiveWorkspaceContext();
    const effectiveScopeGroupId =
      selectedGroupId ?? context.gitlabGroupId ?? null;
    const scope = effectiveScopeGroupId
      ? `group:${effectiveScopeGroupId}`
      : 'global';
    const getSetting = (key: string) =>
      window.localStorage.getItem(scopeStorageKey(scope, key)) ||
      window.localStorage.getItem(`qh.${key}`);

    const storedLive = getSetting('gitlab.live.enabled');
    const storedInterval = getSetting('gitlab.live.interval');
    const storedEventsLimit = getSetting('gitlab.live.events_limit');
    const storedFeedMode = getSetting('gitlab.feed.mode');
    const storedAutoRefresh = getSetting('gitlab.events.auto_refresh');
    const storedEventLimit = getSetting('gitlab.events.limit');
    const storedInsightsLimit = getSetting('gitlab.insights.limit');
    const storedNotifyHigh = getSetting('gitlab.notifications.high_enabled');
    const storedDesktopNotify = getSetting(
      'gitlab.notifications.desktop_enabled'
    );

    if (storedLive === 'true') setLiveMode(true);
    if (storedLive === 'false') setLiveMode(false);
    if (storedInterval) setLiveIntervalSeconds(Number(storedInterval) || 10);
    if (storedEventsLimit) setLiveEventsLimit(Number(storedEventsLimit) || 20);
    if (storedFeedMode === 'selected' || storedFeedMode === 'single')
      setFeedMode(storedFeedMode);
    if (storedAutoRefresh === 'true') setAutoRefresh(true);
    if (storedAutoRefresh === 'false') setAutoRefresh(false);
    if (storedEventLimit) setEventLimit(Number(storedEventLimit) || 50);
    if (storedInsightsLimit)
      setInsightsPipelineLimit(Number(storedInsightsLimit) || 40);
    if (storedNotifyHigh === 'false') setNotificationsHighEnabled(false);
    if (storedNotifyHigh === 'true') setNotificationsHighEnabled(true);
    if (storedDesktopNotify === 'true') setDesktopNotificationsEnabled(true);
    if (storedDesktopNotify === 'false') setDesktopNotificationsEnabled(false);
  }, [selectedGroupId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const context = readActiveWorkspaceContext();
    const effectiveScopeGroupId =
      selectedGroupId ?? context.gitlabGroupId ?? null;
    const scope = effectiveScopeGroupId
      ? `group:${effectiveScopeGroupId}`
      : 'global';
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.live.enabled'),
      String(liveMode)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.live.interval'),
      String(liveIntervalSeconds)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.live.events_limit'),
      String(liveEventsLimit)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.feed.mode'),
      feedMode
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.events.auto_refresh'),
      String(autoRefresh)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.events.limit'),
      String(eventLimit)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.insights.limit'),
      String(insightsPipelineLimit)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.notifications.high_enabled'),
      String(notificationsHighEnabled)
    );
    window.localStorage.setItem(
      scopeStorageKey(scope, 'gitlab.notifications.desktop_enabled'),
      String(desktopNotificationsEnabled)
    );
  }, [
    autoRefresh,
    desktopNotificationsEnabled,
    eventLimit,
    feedMode,
    insightsPipelineLimit,
    liveEventsLimit,
    liveIntervalSeconds,
    liveMode,
    notificationsHighEnabled,
    selectedGroupId
  ]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (!projectFilter.trim()) return true;
      const value = projectFilter.trim().toLowerCase();
      return (
        project.name.toLowerCase().includes(value) ||
        (project.path_with_namespace || '').toLowerCase().includes(value)
      );
    });
  }, [projectFilter, projects]);

  const effectiveProjectIds = useMemo(() => {
    if (selectedProjectIds.length > 0) return selectedProjectIds;
    if (activeProjectId) return [activeProjectId];
    return filteredProjects.slice(0, 20).map((project) => project.id);
  }, [activeProjectId, filteredProjects, selectedProjectIds]);

  const watchedGitlabProjectIds = useMemo(() => {
    return new Set(watchlistItemIdByGitlabId.keys());
  }, [watchlistItemIdByGitlabId]);

  useEffect(() => {
    if (!liveMode) {
      setLiveConnected(false);
      setLiveError(null);
      setLiveReconnectAttempt(0);
      setLiveNextRetryAt(null);
      return;
    }
    if (effectiveProjectIds.length === 0) {
      setLiveConnected(false);
      setLiveError('No project selected for live mode');
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    let attempts = 0;

    const connect = () => {
      if (cancelled) return;
      const url = buildGitlabLiveWebSocketUrl({
        projectIds: effectiveProjectIds,
        intervalSeconds: liveIntervalSeconds,
        pipelineLimit: insightsPipelineLimit,
        eventsLimit: liveEventsLimit
      });
      socket = new WebSocket(url);
      setLiveConnected(false);

      socket.onopen = () => {
        attempts = 0;
        setLiveReconnectAttempt(0);
        setLiveNextRetryAt(null);
        setLiveConnected(true);
        setLiveError(null);
      };

      socket.onclose = () => {
        setLiveConnected(false);
        if (cancelled || !liveMode) return;
        const delayMs = Math.min(30000, 1000 * 2 ** attempts);
        attempts += 1;
        setLiveReconnectAttempt(attempts);
        setLiveNextRetryAt(Date.now() + delayMs);
        reconnectTimer = setTimeout(connect, delayMs);
      };

      socket.onerror = () => {
        setLiveError('Live socket error');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            detail?: string;
            totals?: {
              projects: number;
              open_merge_requests: number;
              pipelines_sampled: number;
              failed_pipelines: number;
              failure_rate_pct: number;
            };
            items?: Array<{
              project_id: number;
              open_merge_requests: number;
              pipelines_sampled: number;
              failed_pipelines: number;
              failure_rate_pct: number;
              latest_pipeline_status: string | null;
              latest_pipeline_updated_at: string | null;
              latest_events: Array<GitlabProjectEvent>;
            }>;
          };

          if (payload.type === 'error') {
            setLiveError(payload.detail || 'Live stream error');
            return;
          }
          if (payload.type !== 'snapshot' || !payload.items || !payload.totals)
            return;

          setLastSnapshotAt(Date.now());
          setInsightsTotals(payload.totals);
          const mappedInsights: GitlabProjectInsight[] = payload.items.map(
            (item) => {
              const sampled = item.pipelines_sampled;
              const failed = item.failed_pipelines;
              const running = item.latest_events.filter(
                (row) => row.status === 'running'
              ).length;
              const success = item.latest_events.filter(
                (row) => row.status === 'success'
              ).length;
              const attention: 'low' | 'medium' | 'high' =
                item.latest_pipeline_status === 'failed' ||
                item.failure_rate_pct >= 50 ||
                item.open_merge_requests >= 20
                  ? 'high'
                  : item.failure_rate_pct >= 20 ||
                      item.open_merge_requests >= 10
                    ? 'medium'
                    : 'low';
              return {
                project_id: item.project_id,
                open_merge_requests: item.open_merge_requests,
                pipelines_sampled: sampled,
                failed_pipelines: failed,
                success_pipelines: success,
                running_pipelines: running,
                failure_rate_pct: item.failure_rate_pct,
                latest_pipeline_status: item.latest_pipeline_status,
                latest_pipeline_updated_at: item.latest_pipeline_updated_at,
                attention_level: attention
              };
            }
          );
          setInsights(mappedInsights);

          const highAlerts = mappedInsights.filter(
            (item) => item.attention_level === 'high'
          );
          setHighAttentionAlerts(highAlerts);
          const signature = highAlerts
            .map((item) => `${item.project_id}:${item.failure_rate_pct}`)
            .sort()
            .join('|');
          if (
            notificationsHighEnabled &&
            signature &&
            signature !== lastHighAlertSignatureRef.current
          ) {
            lastHighAlertSignatureRef.current = signature;
            const msg = `High attention projects: ${highAlerts.map((item) => item.project_id).join(', ')}`;
            setLiveError(msg);
            if (
              desktopNotificationsEnabled &&
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification('Quality-Hub Alert', { body: msg });
            }
          }

          const liveEvents: EventFeedItem[] = payload.items
            .flatMap((item) =>
              item.latest_events.map((row) => ({
                ...row,
                project_id: item.project_id
              }))
            )
            .sort((a, b) =>
              (b.updated_at || '').localeCompare(a.updated_at || '')
            )
            .slice(0, eventLimit);
          setEvents(liveEvents);
        } catch {
          setLiveError('Invalid live payload');
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [
    desktopNotificationsEnabled,
    effectiveProjectIds,
    eventLimit,
    insightsPipelineLimit,
    liveEventsLimit,
    liveIntervalSeconds,
    liveMode,
    notificationsHighEnabled
  ]);

  useEffect(() => {
    if (!liveMode) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveMode]);

  const eventStats = useMemo(() => {
    const stats: Record<string, number> = { total: events.length };
    for (const event of events) {
      const key = event.status || 'unknown';
      stats[key] = (stats[key] || 0) + 1;
    }
    return stats;
  }, [events]);

  const snapshotAgeSeconds = useMemo(() => {
    if (!lastSnapshotAt) return null;
    return Math.max(0, Math.floor((nowTick - lastSnapshotAt) / 1000));
  }, [lastSnapshotAt, nowTick]);

  const toggleProjectSelection = (projectId: number, checked: boolean) => {
    setSelectedProjectIds((prev) => {
      if (checked) {
        if (prev.includes(projectId)) return prev;
        return [...prev, projectId];
      }
      return prev.filter((id) => id !== projectId);
    });
  };

  const selectFilteredProjects = () => {
    setSelectedProjectIds(filteredProjects.map((project) => project.id));
  };

  const loadInsights = useCallback(async () => {
    const projectIds =
      selectedProjectIds.length > 0
        ? selectedProjectIds
        : activeProjectId
          ? [activeProjectId]
          : filteredProjects.slice(0, 20).map((project) => project.id);
    if (projectIds.length === 0) {
      setInsights([]);
      setInsightsTotals(null);
      setInsightsError('No projects available for insights');
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = await getGitlabProjectsInsights(
        projectIds,
        insightsPipelineLimit
      );
      const sorted = [...data.items].sort((a, b) => {
        const levelRank = { high: 3, medium: 2, low: 1 };
        const byAttention =
          levelRank[b.attention_level] - levelRank[a.attention_level];
        if (byAttention !== 0) return byAttention;
        return b.failure_rate_pct - a.failure_rate_pct;
      });
      setInsights(sorted);
      setInsightsTotals(data.totals);
    } catch (err) {
      setInsights([]);
      setInsightsTotals(null);
      setInsightsError(
        err instanceof Error
          ? err.message
          : 'Failed to load leadership insights'
      );
    } finally {
      setInsightsLoading(false);
    }
  }, [
    activeProjectId,
    filteredProjects,
    insightsPipelineLimit,
    selectedProjectIds
  ]);

  const toggleWatchlist = async (projectId: number) => {
    setWatchlistBusyProjectId(projectId);
    setError(null);
    try {
      const existingItemId = watchlistItemIdByGitlabId.get(projectId);
      if (existingItemId) {
        await deleteWorkspaceWatchlist(existingItemId);
      } else {
        await createWorkspaceWatchlist({ project_id: projectId });
      }
      await loadWatchlistIndex();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update watchlist'
      );
    } finally {
      setWatchlistBusyProjectId(null);
    }
  };

  return (
    <Card>
      <CardHeader className='gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>GitLab Catalog</CardTitle>
          <Button
            variant='outline'
            onClick={() => void refreshCatalog()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Reload'}
          </Button>
        </div>
        <p className='text-muted-foreground text-sm'>
          Mehr Features: Projekt-Auswahl, Multi-Projekt-Feed, Event-Filter,
          Live-Refresh und Status-Statistiken.
        </p>
        {activeWorkspaceGroupId && (
          <p className='text-muted-foreground text-xs'>
            Workspace scope default:{' '}
            {activeWorkspaceGroupPath || `group #${activeWorkspaceGroupId}`}
          </p>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        {error && <p className='text-destructive text-sm'>{error}</p>}

        <div className='grid gap-4 lg:grid-cols-[320px_1fr]'>
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Groups</h3>
            <Button
              className='w-full justify-start'
              variant={selectedGroupId === null ? 'default' : 'outline'}
              onClick={() => setSelectedGroupId(null)}
            >
              All groups
            </Button>
            <div className='max-h-105 space-y-2 overflow-auto pr-1'>
              {groups.map((group) => (
                <Button
                  key={group.id}
                  className='h-auto w-full justify-start text-left whitespace-normal'
                  variant={selectedGroupId === group.id ? 'default' : 'outline'}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <span className='font-medium'>{group.name}</span>
                  <span className='text-muted-foreground ml-2 text-xs'>
                    {group.full_path}
                  </span>
                </Button>
              ))}
              {groups.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  Keine Gruppen gefunden.
                </p>
              )}
            </div>
          </div>

          <div className='space-y-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <Input
                placeholder='Filter projects by name or path...'
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              />
              {selectedGroupId !== null && (
                <Badge variant='secondary'>Group #{selectedGroupId}</Badge>
              )}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline'>
                Selected: {selectedProjectIds.length}
              </Badge>
              <Badge variant='secondary'>
                Watched: {watchedGitlabProjectIds.size}
              </Badge>
              <Button
                size='sm'
                variant='outline'
                onClick={selectFilteredProjects}
              >
                Select filtered
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setSelectedProjectIds([])}
              >
                Clear selection
              </Button>
              <Button
                size='sm'
                variant='secondary'
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  setSyncMessage(null);
                  try {
                    const data = await triggerProjectSync();
                    setSyncMessage(`Sync queued (run ${data.sync_run_id})`);
                  } catch (err) {
                    setSyncMessage(
                      err instanceof Error
                        ? err.message
                        : 'Failed to queue sync'
                    );
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? 'Syncing...' : 'Sync to Workspace'}
              </Button>
            </div>
            {syncMessage && (
              <p className='text-muted-foreground text-xs'>{syncMessage}</p>
            )}

            <div className='max-h-65 space-y-2 overflow-auto pr-1'>
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'
                >
                  <div className='flex min-w-0 items-center gap-2'>
                    <Checkbox
                      checked={selectedProjectIds.includes(project.id)}
                      onCheckedChange={(checked) =>
                        toggleProjectSelection(project.id, checked === true)
                      }
                    />
                    <Button
                      className='min-w-0 justify-start px-0 text-left'
                      variant='ghost'
                      size='sm'
                      onClick={() => setActiveProjectId(project.id)}
                    >
                      <p className='truncate text-sm font-medium'>
                        {project.name}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {project.path_with_namespace || `project-${project.id}`}
                      </p>
                    </Button>
                  </div>
                  <div className='flex items-center gap-2'>
                    {activeProjectId === project.id && (
                      <Badge variant='secondary'>Active</Badge>
                    )}
                    {watchedGitlabProjectIds.has(project.id) && (
                      <Badge variant='outline'>Watchlist</Badge>
                    )}
                    {project.default_branch && (
                      <Badge variant='outline'>{project.default_branch}</Badge>
                    )}
                    <Button
                      size='sm'
                      variant={
                        watchedGitlabProjectIds.has(project.id)
                          ? 'destructive'
                          : 'secondary'
                      }
                      disabled={watchlistBusyProjectId === project.id}
                      onClick={() => void toggleWatchlist(project.id)}
                    >
                      {watchlistBusyProjectId === project.id
                        ? 'Working...'
                        : watchedGitlabProjectIds.has(project.id)
                          ? 'Remove watch'
                          : 'Add watch'}
                    </Button>
                    {project.web_url && (
                      <a
                        className='text-sm underline'
                        href={project.web_url}
                        target='_blank'
                        rel='noreferrer'
                      >
                        Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {filteredProjects.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  Keine Projekte gefunden.
                </p>
              )}
            </div>

            <div className='space-y-3 rounded-md border p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h3 className='text-sm font-medium'>Live Settings</h3>
                <div className='flex items-center gap-2'>
                  <span className='text-muted-foreground text-xs'>
                    WebSocket live
                  </span>
                  <Switch checked={liveMode} onCheckedChange={setLiveMode} />
                </div>
              </div>
              <div className='grid gap-2 md:grid-cols-3'>
                <Input
                  type='number'
                  min={3}
                  max={60}
                  value={liveIntervalSeconds}
                  onChange={(event) =>
                    setLiveIntervalSeconds(Number(event.target.value) || 10)
                  }
                  placeholder='Live interval sec'
                />
                <Input
                  type='number'
                  min={5}
                  max={100}
                  value={liveEventsLimit}
                  onChange={(event) =>
                    setLiveEventsLimit(Number(event.target.value) || 20)
                  }
                  placeholder='Live events per project'
                />
                <div className='flex items-center gap-2'>
                  <Badge variant={liveConnected ? 'secondary' : 'outline'}>
                    {liveConnected ? 'Live connected' : 'Live disconnected'}
                  </Badge>
                  {liveError && (
                    <span className='text-destructive text-xs'>
                      {liveError}
                    </span>
                  )}
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline'>
                  snapshot age:{' '}
                  {snapshotAgeSeconds === null
                    ? 'n/a'
                    : `${snapshotAgeSeconds}s`}
                </Badge>
                <Badge variant='outline'>
                  reconnect attempt: {liveReconnectAttempt}
                </Badge>
                {liveNextRetryAt && !liveConnected && (
                  <Badge variant='outline'>
                    next retry in{' '}
                    {Math.max(0, Math.ceil((liveNextRetryAt - nowTick) / 1000))}
                    s
                  </Badge>
                )}
                <Badge
                  variant={notificationsHighEnabled ? 'secondary' : 'outline'}
                >
                  high alerts {notificationsHighEnabled ? 'on' : 'off'}
                </Badge>
              </div>
              {highAttentionAlerts.length > 0 && (
                <div className='space-y-1 rounded-md border p-2'>
                  <p className='text-xs font-medium'>High attention now</p>
                  <div className='flex flex-wrap gap-1'>
                    {highAttentionAlerts.map((item) => (
                      <Badge key={item.project_id} variant='destructive'>
                        #{item.project_id} ({item.failure_rate_pct}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h3 className='text-sm font-medium'>Events</h3>
                <div className='flex items-center gap-2'>
                  <span className='text-muted-foreground text-xs'>
                    Auto refresh
                  </span>
                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                  />
                </div>
              </div>

              <div className='grid gap-2 md:grid-cols-5'>
                <Select
                  value={feedMode}
                  onValueChange={(value) =>
                    setFeedMode(value as 'single' | 'selected')
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Feed mode' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='single'>Single project</SelectItem>
                    <SelectItem value='selected'>
                      Selected projects feed
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={eventStatus || 'all'}
                  onValueChange={(value) =>
                    setEventStatus(value === 'all' ? '' : value)
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='All status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All status</SelectItem>
                    <SelectItem value='success'>success</SelectItem>
                    <SelectItem value='failed'>failed</SelectItem>
                    <SelectItem value='running'>running</SelectItem>
                    <SelectItem value='pending'>pending</SelectItem>
                    <SelectItem value='canceled'>canceled</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder='ref (optional)'
                  value={eventRef}
                  onChange={(event) => setEventRef(event.target.value)}
                />
                <Input
                  placeholder='source (optional)'
                  value={eventSource}
                  onChange={(event) => setEventSource(event.target.value)}
                />
                <Input
                  placeholder='limit'
                  type='number'
                  min={1}
                  max={200}
                  value={eventLimit}
                  onChange={(event) =>
                    setEventLimit(Number(event.target.value) || 50)
                  }
                />
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                {Object.entries(eventStats).map(([key, value]) => (
                  <Badge key={key} variant='outline'>
                    {key}: {value}
                  </Badge>
                ))}
                <Button
                  size='sm'
                  variant='outline'
                  disabled={eventsLoading}
                  onClick={() => void loadEvents()}
                >
                  {eventsLoading ? 'Loading...' : 'Reload events'}
                </Button>
              </div>

              <div className='max-h-70 space-y-2 overflow-auto pr-1'>
                {events.map((event) => (
                  <div
                    key={`${event.project_id}-${event.id}-${event.sha || 'na'}-${event.updated_at || 'na'}`}
                    className='rounded border p-2 text-xs'
                  >
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='secondary'>#{event.project_id}</Badge>
                      <span className='font-medium'>
                        {projectNameById.get(event.project_id) ||
                          'Unknown project'}
                      </span>
                      <Badge variant='outline'>
                        {event.status || 'unknown'}
                      </Badge>
                      {event.ref && <span>ref: {event.ref}</span>}
                      {event.source && <span>source: {event.source}</span>}
                    </div>
                    <div className='text-muted-foreground mt-1'>
                      {event.sha ? `sha ${event.sha.slice(0, 8)}` : 'sha n/a'}
                      {event.updated_at ? ` | ${event.updated_at}` : ''}
                    </div>
                    {event.web_url && (
                      <a
                        className='mt-1 inline-block underline'
                        href={event.web_url}
                        target='_blank'
                        rel='noreferrer'
                      >
                        Open event
                      </a>
                    )}
                  </div>
                ))}
                {!eventsLoading && events.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    Keine Events gefunden.
                  </p>
                )}
              </div>
            </div>

            <div className='space-y-3 rounded-md border p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h3 className='text-sm font-medium'>Leadership Insights</h3>
                <div className='flex items-center gap-2'>
                  <Input
                    className='w-28'
                    type='number'
                    min={10}
                    max={200}
                    value={insightsPipelineLimit}
                    onChange={(event) =>
                      setInsightsPipelineLimit(Number(event.target.value) || 40)
                    }
                  />
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={insightsLoading}
                    onClick={() => void loadInsights()}
                  >
                    {insightsLoading ? 'Loading...' : 'Load insights'}
                  </Button>
                </div>
              </div>
              <p className='text-muted-foreground text-xs'>
                Nutzt ausgewählte Projekte. Falls nichts selektiert ist, wird
                aktives Projekt bzw. die gefilterte Liste genutzt.
              </p>
              {insightsError && (
                <p className='text-destructive text-sm'>{insightsError}</p>
              )}

              {insightsTotals && (
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>
                    projects: {insightsTotals.projects}
                  </Badge>
                  <Badge variant='outline'>
                    open MRs: {insightsTotals.open_merge_requests}
                  </Badge>
                  <Badge variant='outline'>
                    sampled pipelines: {insightsTotals.pipelines_sampled}
                  </Badge>
                  <Badge variant='outline'>
                    failed: {insightsTotals.failed_pipelines}
                  </Badge>
                  <Badge variant='secondary'>
                    failure rate: {insightsTotals.failure_rate_pct}%
                  </Badge>
                </div>
              )}

              <div className='max-h-70 space-y-2 overflow-auto pr-1'>
                {insights.map((item) => (
                  <div
                    key={item.project_id}
                    className='rounded border p-2 text-xs'
                  >
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='secondary'>#{item.project_id}</Badge>
                      <span className='font-medium'>
                        {projectNameById.get(item.project_id) ||
                          'Unknown project'}
                      </span>
                      <Badge
                        variant={
                          item.attention_level === 'high'
                            ? 'destructive'
                            : item.attention_level === 'medium'
                              ? 'outline'
                              : 'secondary'
                        }
                      >
                        {item.attention_level}
                      </Badge>
                      <Badge variant='outline'>
                        MRs: {item.open_merge_requests}
                      </Badge>
                      <Badge variant='outline'>
                        fail rate: {item.failure_rate_pct}%
                      </Badge>
                      <Badge variant='outline'>
                        latest: {item.latest_pipeline_status || 'n/a'}
                      </Badge>
                    </div>
                    <div className='text-muted-foreground mt-1'>
                      sampled {item.pipelines_sampled} | failed{' '}
                      {item.failed_pipelines} | success {item.success_pipelines}{' '}
                      | running {item.running_pipelines}
                      {item.latest_pipeline_updated_at
                        ? ` | latest update ${item.latest_pipeline_updated_at}`
                        : ''}
                    </div>
                  </div>
                ))}
                {!insightsLoading && insights.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    No insights loaded yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
