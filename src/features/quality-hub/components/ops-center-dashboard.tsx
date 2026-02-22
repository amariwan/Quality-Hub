'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createAlertRule,
  createChangeApproval,
  createDependency,
  createGuardrail,
  createIncidentLink,
  createPostmortem,
  createReleaseGatePolicy,
  createReleaseTrain,
  createRemediationPlaybook,
  createSLOBudget,
  createWebhookAutomation,
  createWorkspaceTemplate,
  deleteAlertRule,
  deleteChangeApproval,
  deleteDependency,
  deleteGuardrail,
  deleteIncidentLink,
  deletePostmortem,
  deleteReleaseGatePolicy,
  deleteReleaseTrain,
  deleteRemediationPlaybook,
  deleteSLOBudget,
  deleteWebhookAutomation,
  deleteWorkspaceTemplate,
  listWorkspaceGroups,
  simulateRisk
} from '@/features/quality-hub/api/client';
import { useOpsOverview } from '@/features/quality-hub/api/swr';
import { RiskSimulationResponse } from '@/features/quality-hub/types';
import { workspaceSlugFromGroupPath } from '@/features/quality-hub/workspace-context';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  ALL_OPS_PRODUCT_EVENTS,
  OPS_EVENT_SCENARIO_BY_NAME
} from './ops-center-events';
import { useOpsProductEvents } from './use-ops-product-events';

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

export function OpsCenterDashboard() {
  const pathname = usePathname();
  const workspaceSlug = useMemo(
    () => extractWorkspaceSlugFromPathname(pathname || ''),
    [pathname]
  );

  const [weeks, setWeeks] = useState(6);
  const [days, setDays] = useState(30);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newPolicyName, setNewPolicyName] = useState('Default Release Gate');
  const [newPolicyRisk, setNewPolicyRisk] = useState('60');
  const [newPolicyReadiness, setNewPolicyReadiness] = useState('75');
  const [newPolicyConfidence, setNewPolicyConfidence] = useState('70');

  const [newAlertName, setNewAlertName] = useState('Release Risk Escalation');
  const [newAlertThreshold, setNewAlertThreshold] = useState('60');
  const [newAlertRecipients, setNewAlertRecipients] =
    useState('#quality-alerts');

  const [newIncidentProjectId, setNewIncidentProjectId] = useState('');
  const [newIncidentIssueId, setNewIncidentIssueId] = useState('');
  const [newIncidentTitle, setNewIncidentTitle] = useState('');

  const [newTemplateName, setNewTemplateName] = useState('Workspace Default');
  const [newTemplateDescription, setNewTemplateDescription] = useState(
    'Base template with release gate + alerts'
  );
  const [newTemplateDefinition, setNewTemplateDefinition] = useState(
    JSON.stringify(
      {
        release_gate_policy: 'default',
        alert_profile: 'strict',
        dashboards: ['risk-radar', 'ops-center']
      },
      null,
      2
    )
  );

  const [simRiskHigh, setSimRiskHigh] = useState('60');
  const [simRiskMedium, setSimRiskMedium] = useState('40');
  const [simReadinessMin, setSimReadinessMin] = useState('75');
  const [simConfidenceMin, setSimConfidenceMin] = useState('70');
  const [simulationResult, setSimulationResult] =
    useState<RiskSimulationResponse | null>(null);

  const [newReleaseTrainTitle, setNewReleaseTrainTitle] =
    useState('Weekly Train');
  const [newReleaseTrainProjectId, setNewReleaseTrainProjectId] = useState('');
  const [newReleaseTrainStartAt, setNewReleaseTrainStartAt] = useState('');
  const [newReleaseTrainEndAt, setNewReleaseTrainEndAt] = useState('');

  const [newPlaybookName, setNewPlaybookName] = useState('Auto Escalation');
  const [newPlaybookTeamId, setNewPlaybookTeamId] = useState('');

  const [newSLOProjectId, setNewSLOProjectId] = useState('');
  const [newSLOServiceName, setNewSLOServiceName] = useState('api-gateway');
  const [newSLOTarget, setNewSLOTarget] = useState('99.9');

  const [newGuardrailProjectId, setNewGuardrailProjectId] = useState('');
  const [newGuardrailName, setNewGuardrailName] = useState(
    'Default Canary Guardrail'
  );

  const [newDependencySourceProjectId, setNewDependencySourceProjectId] =
    useState('');
  const [newDependencyTargetProjectId, setNewDependencyTargetProjectId] =
    useState('');
  const [newDependencyCriticality, setNewDependencyCriticality] =
    useState('medium');

  const [newPostmortemTitle, setNewPostmortemTitle] = useState('');
  const [newPostmortemSummary, setNewPostmortemSummary] = useState('');

  const [newApprovalVersion, setNewApprovalVersion] = useState('v1.0.0');
  const [newApprovalProjectId, setNewApprovalProjectId] = useState('');
  const [newApprovalRoles, setNewApprovalRoles] = useState('qa, sre');
  const [newApprovalRequestedBy, setNewApprovalRequestedBy] = useState('');

  const [newWebhookName, setNewWebhookName] = useState(
    'Release Blocked Webhook'
  );
  const [newWebhookEventType, setNewWebhookEventType] =
    useState('release_blocked');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  const {
    data: workspaceGroups,
    error: workspaceGroupsError,
    isLoading: isWorkspaceGroupsLoading
  } = useSWR(
    workspaceSlug ? ['quality-hub', 'workspace-groups', 'ops-center'] : null,
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

  const { data, error, isLoading, mutate } = useOpsOverview({
    workspaceId,
    weeks,
    days
  });
  const { data: productEvents = [], mutate: mutateProductEvents } = useSWR(
    workspaceId === undefined
      ? null
      : ['quality-hub', 'ops-product-events', workspaceId ?? 'all'],
    () => listOpsProductEvents({ workspaceId, limit: 500 })
  );

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
    actionError ||
    workspaceErrorMessage ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load ops center'
      : null);

  const runMutationAction = async (fn: () => Promise<unknown>) => {
    try {
      setWorking(true);
      setActionError(null);
      await fn();
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setWorking(false);
    }
  };

  const trackProductEvent = useCallback(
    async (
      scenario: string,
      eventName: OpsProductEventName,
      metadataJson: Record<string, unknown> = {}
    ) => {
      await createOpsProductEvent({
        workspace_id: workspaceId,
        scenario,
        event_name: eventName,
        metadata_json: metadataJson
      });
      await mutateProductEvents();
    },
    [workspaceId, mutateProductEvents]
  );

  const runEventAction = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      setEventActionWorking(true);
      setEventActionError(null);
      await fn();
    } catch (err) {
      setEventActionError(
        err instanceof Error ? err.message : 'Failed to track event'
      );
    } finally {
      setEventActionWorking(false);
    }
  }, []);

  const trackProductEventSafely = useCallback(
    (
      scenario: string,
      eventName: OpsProductEventName,
      metadataJson: Record<string, unknown> = {}
    ) => {
      void trackProductEvent(scenario, eventName, metadataJson).catch(() => {
        // ignore telemetry write errors during background tracking
      });
    },
    [trackProductEvent]
  );

  const emitOpsEvent = useCallback(
    (
      eventName: OpsProductEventName,
      metadataJson: Record<string, unknown> = {}
    ) => {
      trackProductEventSafely(
        OPS_EVENT_SCENARIO_BY_NAME[eventName],
        eventName,
        metadataJson
      );
    },
    [trackProductEventSafely]
  );

  const emitOpsEventOnce = useCallback(
    (
      guardKey: string,
      eventName: OpsProductEventName,
      metadataJson: Record<string, unknown> = {}
    ) => {
      if (autoTrackedRef.current[guardKey]) return;
      autoTrackedRef.current[guardKey] = true;
      emitOpsEvent(eventName, metadataJson);
    },
    [emitOpsEvent]
  );

  const parseDateTimeInput = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${label} is required`);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${label} must be a valid datetime`);
    }
    return parsed.toISOString();
  };

  const preview = simulationResult || data?.risk_simulation_preview || null;
  const openIncidentCount = useMemo(
    () =>
      data
        ? data.incident_links.filter((item) => item.status !== 'resolved')
            .length
        : 0,
    [data]
  );
  const highRiskProjectCount =
    data?.trend_regressions.summary.high_risk_projects ?? 0;
  const unownedProjectCount =
    data?.ownership_heatmap.summary.unowned_projects ?? 0;
  const regressionCount = data?.trend_regressions.regressions.length ?? 0;
  const latestProductEventByName = useMemo(() => {
    const mapped = new Map<string, OpsProductEvent>();
    for (const item of productEvents) {
      if (!mapped.has(item.event_name)) {
        mapped.set(item.event_name, item);
      }
    }
    return mapped;
  }, [productEvents]);
  const todoProgress = useMemo(
    () =>
      OPS_EVENT_TODOS.map((todo) => {
        const trackedCount = todo.events.filter((eventName) =>
          latestProductEventByName.has(eventName)
        ).length;
        return {
          ...todo,
          trackedCount,
          total: todo.events.length,
          done: trackedCount === todo.events.length
        };
      }),
    [latestProductEventByName]
  );

  useEffect(() => {
    autoTrackedRef.current = {};
  }, [workspaceId]);

  useEffect(() => {
    if (!data) return;
    emitOpsEventOnce('dashboard_opened', 'quality_dashboard_opened', {
      weeks,
      days
    });
  }, [data, days, emitOpsEventOnce, weeks]);

  useEffect(() => {
    if (!data || highRiskProjectCount <= 0) return;
    emitOpsEventOnce(
      'quality_score_threshold_breached',
      'quality_score_threshold_breached',
      {
        high_risk_projects: highRiskProjectCount
      }
    );
  }, [data, emitOpsEventOnce, highRiskProjectCount]);

  useEffect(() => {
    if (!data) return;
    emitOpsEventOnce('incident_timeline_opened', 'incident_timeline_opened', {
      open_incidents: openIncidentCount
    });
  }, [data, emitOpsEventOnce, openIncidentCount]);

  useEffect(() => {
    if (!data) return;
    emitOpsEventOnce('impact_heatmap_opened', 'impact_heatmap_opened', {
      unowned_projects: unownedProjectCount,
      overloaded_teams: data.ownership_heatmap.summary.overloaded_teams
    });
  }, [data, emitOpsEventOnce, unownedProjectCount]);

  useEffect(() => {
    if (!data || regressionCount <= 0) return;
    emitOpsEventOnce(
      'post_release_regression_detected',
      'post_release_regression_detected',
      {
        regressions: regressionCount
      }
    );
  }, [data, emitOpsEventOnce, regressionCount]);

  useEffect(() => {
    if (!data || unownedProjectCount <= 0) return;
    emitOpsEventOnce('owner_missing_detected', 'owner_missing_detected', {
      unowned_projects: unownedProjectCount
    });
  }, [data, emitOpsEventOnce, unownedProjectCount]);

  useEffect(() => {
    if (!data || openIncidentCount <= 0 || highRiskProjectCount <= 0) return;
    emitOpsEventOnce('escalation_triggered', 'escalation_triggered', {
      open_incidents: openIncidentCount,
      high_risk_projects: highRiskProjectCount
    });
  }, [data, emitOpsEventOnce, highRiskProjectCount, openIncidentCount]);

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-3'>
          <CardTitle>
            Ops Center
            {matchedWorkspace ? ` (${matchedWorkspace.gitlab_group_path})` : ''}
          </CardTitle>
          <div className='flex items-center gap-2'>
            <Input
              className='w-24'
              value={String(weeks)}
              onChange={(event) => setWeeks(Number(event.target.value) || 6)}
            />
            <Input
              className='w-24'
              value={String(days)}
              onChange={(event) => setDays(Number(event.target.value) || 30)}
            />
            <Button
              variant='outline'
              onClick={() => {
                void mutate();
                emitOpsEvent('timeline_event_filtered', { weeks, days });
              }}
            >
              Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {(isLoading || (workspaceSlug && isWorkspaceGroupsLoading)) && (
            <p className='text-muted-foreground text-sm'>
              Loading ops center...
            </p>
          )}
          {errorMessage && (
            <p className='text-destructive text-sm'>{errorMessage}</p>
          )}
          {!isLoading && !errorMessage && data && (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>Projects</p>
                <p className='text-xl font-semibold'>
                  {data.trend_regressions.summary.project_count ?? 0}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>High Risk</p>
                <p className='text-xl font-semibold'>{highRiskProjectCount}</p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>Open Incidents</p>
                <p className='text-xl font-semibold'>{openIncidentCount}</p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>Active Gates</p>
                <p className='text-xl font-semibold'>
                  {
                    data.release_gate_policies.filter((row) => row.active)
                      .length
                  }
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground text-xs'>DORA</p>
                <p className='text-xl font-semibold uppercase'>
                  {data.dora_metrics.overall_classification}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && !errorMessage && data && (
        <div className='grid gap-6 xl:grid-cols-2'>
          <Card className='xl:col-span-2'>
            <CardHeader>
              <CardTitle>Todo: Ops Event Tracking</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {eventActionError && (
                <p className='text-destructive text-sm'>{eventActionError}</p>
              )}
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  disabled={eventActionWorking}
                  onClick={() =>
                    void runEventAction(async () => {
                      await Promise.all(
                        ALL_OPS_PRODUCT_EVENTS.map((eventName) => {
                          return trackProductEvent(
                            OPS_EVENT_SCENARIO_BY_NAME[eventName],
                            eventName,
                            {
                              trigger: 'bulk_todo'
                            }
                          );
                        })
                      );
                    })
                  }
                >
                  Track All
                </Button>
                <span className='text-muted-foreground text-xs'>
                  {productEvents.length} tracked events
                </span>
              </div>

              <div className='grid gap-3 md:grid-cols-2'>
                {todoProgress.map((todo) => (
                  <div key={todo.key} className='rounded border p-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <p className='text-sm font-medium'>{todo.title}</p>
                      <Badge variant={todo.done ? 'default' : 'outline'}>
                        {todo.trackedCount}/{todo.total}
                      </Badge>
                    </div>
                    <div className='mt-2 space-y-2'>
                      {todo.events.map((eventName) => {
                        const lastEvent =
                          latestProductEventByName.get(eventName);
                        return (
                          <div
                            key={eventName}
                            className='flex items-center justify-between gap-3 rounded border p-2'
                          >
                            <div>
                              <p className='text-sm font-medium'>{eventName}</p>
                              <p className='text-muted-foreground text-xs'>
                                {lastEvent?.created_at
                                  ? `Last: ${lastEvent.created_at}`
                                  : 'Noch nicht getrackt'}
                              </p>
                            </div>
                            <Button
                              variant='outline'
                              size='sm'
                              disabled={eventActionWorking}
                              onClick={() =>
                                void runEventAction(async () => {
                                  await trackProductEvent(todo.key, eventName, {
                                    trigger: 'manual_todo'
                                  });
                                })
                              }
                            >
                              Track
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>Recent Product Events</p>
                {productEvents.slice(0, 12).map((event) => (
                  <div
                    key={event.id}
                    className='text-muted-foreground flex items-center justify-between rounded border p-2 text-xs'
                  >
                    <span>
                      {event.event_name} | {event.scenario}
                    </span>
                    <span>{event.created_at || '-'}</span>
                  </div>
                ))}
                {productEvents.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    No product events tracked yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>1. Release Gate Policies</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Policy name'
                  value={newPolicyName}
                  onChange={(event) => setNewPolicyName(event.target.value)}
                />
                <Button
                  disabled={working}
                  onClick={() =>
                    void runMutationAction(async () => {
                      await createReleaseGatePolicy({
                        name: newPolicyName.trim() || 'Release Gate',
                        workspace_id: workspaceId,
                        max_release_risk_score: Number(newPolicyRisk) || 60,
                        min_release_readiness_pct:
                          Number(newPolicyReadiness) || 75,
                        min_delivery_confidence_pct:
                          Number(newPolicyConfidence) || 70
                      });
                    })
                  }
                >
                  Add Gate
                </Button>
              </div>
              <div className='grid gap-2 md:grid-cols-3'>
                <Input
                  placeholder='Max risk'
                  value={newPolicyRisk}
                  onChange={(event) => setNewPolicyRisk(event.target.value)}
                />
                <Input
                  placeholder='Min readiness'
                  value={newPolicyReadiness}
                  onChange={(event) =>
                    setNewPolicyReadiness(event.target.value)
                  }
                />
                <Input
                  placeholder='Min confidence'
                  value={newPolicyConfidence}
                  onChange={(event) =>
                    setNewPolicyConfidence(event.target.value)
                  }
                />
              </div>

              {data.release_gate_policies.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No release gates yet.
                </p>
              )}
              {data.release_gate_policies.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      risk &lt;= {item.max_release_risk_score} | readiness &gt;={' '}
                      {item.min_release_readiness_pct} | confidence &gt;={' '}
                      {item.min_delivery_confidence_pct}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant={item.active ? 'default' : 'secondary'}>
                      {item.active ? 'active' : 'inactive'}
                    </Badge>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={working}
                      onClick={() =>
                        void runMutationAction(async () => {
                          await deleteReleaseGatePolicy(item.id);
                        })
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Alerting & Escalation</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Alert name'
                  value={newAlertName}
                  onChange={(event) => setNewAlertName(event.target.value)}
                />
                <Button
                  disabled={working}
                  onClick={() =>
                    void runMutationAction(async () => {
                      await createAlertRule({
                        name: newAlertName.trim() || 'Release Alert',
                        workspace_id: workspaceId,
                        threshold_value: Number(newAlertThreshold) || 60,
                        recipients: newAlertRecipients
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean)
                      });
                    })
                  }
                >
                  Add Alert Rule
                </Button>
              </div>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Threshold'
                  value={newAlertThreshold}
                  onChange={(event) => setNewAlertThreshold(event.target.value)}
                />
                <Input
                  placeholder='Recipients (#channel,mail@...)'
                  value={newAlertRecipients}
                  onChange={(event) =>
                    setNewAlertRecipients(event.target.value)
                  }
                />
              </div>

              {data.alert_rules.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No alert rules yet.
                </p>
              )}
              {data.alert_rules.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.channel} | {item.condition_type}{' '}
                      {item.threshold_value} | escalation{' '}
                      {item.escalation_minutes}m
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteAlertRule(item.id);
                        emitOpsEvent('sla_alert_acknowledged', {
                          alert_rule_id: item.id,
                          alert_rule_name: item.name
                        });
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Trend & Regression Analysis</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.trend_regressions.quality_trend.map((trend) => (
                <div
                  key={trend.week}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <span className='text-sm'>{trend.week}</span>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground text-xs'>
                      {trend.score.toFixed(1)}
                    </span>
                    <Badge variant='outline'>{trend.label}</Badge>
                  </div>
                </div>
              ))}
              {data.trend_regressions.regressions.length === 0 && (
                <p className='text-muted-foreground text-sm'>No regressions.</p>
              )}
              {data.trend_regressions.regressions
                .slice(0, 6)
                .map((item, index) => (
                  <div
                    key={`${item.project_id}-${index}`}
                    className='rounded border p-2'
                  >
                    <p className='text-sm font-medium'>{item.project}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.reason}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. DORA Metrics</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='grid gap-2 md:grid-cols-2'>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>
                    Deployment Frequency
                  </p>
                  <p className='text-sm font-semibold'>
                    {data.dora_metrics.deployment_frequency.deployments}{' '}
                    deployments
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {data.dora_metrics.deployment_frequency.per_week.toFixed(2)}{' '}
                    / week
                  </p>
                </div>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>Lead Time</p>
                  <p className='text-sm font-semibold'>
                    {data.dora_metrics.lead_time_hours.value === null
                      ? '-'
                      : `${data.dora_metrics.lead_time_hours.value} h`}
                  </p>
                </div>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>
                    Change Failure Rate
                  </p>
                  <p className='text-sm font-semibold'>
                    {data.dora_metrics.change_failure_rate.pct.toFixed(1)}%
                  </p>
                </div>
                <div className='rounded border p-2'>
                  <p className='text-muted-foreground text-xs'>MTTR</p>
                  <p className='text-sm font-semibold'>
                    {data.dora_metrics.mttr_hours.value === null
                      ? '-'
                      : `${data.dora_metrics.mttr_hours.value} h`}
                  </p>
                </div>
              </div>
              <Badge>{data.dora_metrics.overall_classification}</Badge>
              <p className='text-muted-foreground text-xs'>
                {data.dora_metrics.calculation_note}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Weekly Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <p className='text-sm font-medium'>
                {data.weekly_summary.headline}
              </p>
              {data.weekly_summary.highlights.map((item) => (
                <p key={item} className='text-muted-foreground text-sm'>
                  {item}
                </p>
              ))}
              <div className='space-y-1'>
                {data.weekly_summary.recommendations.map((item, index) => (
                  <p key={`recommend-${index}`} className='text-sm'>
                    - {item}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Incident Linking</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Project ID'
                  value={newIncidentProjectId}
                  onChange={(event) =>
                    setNewIncidentProjectId(event.target.value)
                  }
                />
                <Input
                  placeholder='Issue ID (e.g. INC-123)'
                  value={newIncidentIssueId}
                  onChange={(event) =>
                    setNewIncidentIssueId(event.target.value)
                  }
                />
                <Input
                  placeholder='Title'
                  value={newIncidentTitle}
                  onChange={(event) => setNewIncidentTitle(event.target.value)}
                />
                <Button
                  disabled={working}
                  onClick={() =>
                    void runMutationAction(async () => {
                      const projectId = Number(newIncidentProjectId);
                      const issueId = newIncidentIssueId.trim();
                      if (!projectId || !issueId) {
                        throw new Error('Project ID and Issue ID are required');
                      }
                      const duplicateIncident = data.incident_links.find(
                        (item) =>
                          item.external_issue_id.toLowerCase() ===
                          issueId.toLowerCase()
                      );
                      if (duplicateIncident) {
                        emitOpsEvent('possible_duplicate_found', {
                          external_issue_id: issueId,
                          duplicate_incident_id: duplicateIncident.id
                        });
                      }
                      await createIncidentLink({
                        workspace_id: workspaceId,
                        project_id: projectId,
                        external_issue_id: issueId,
                        title: newIncidentTitle.trim() || undefined,
                        status: 'open'
                      });
                      setNewIncidentIssueId('');
                      setNewIncidentTitle('');
                    })
                  }
                >
                  Link Incident
                </Button>
              </div>

              {data.incident_links.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No incident links yet.
                </p>
              )}
              {data.incident_links.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>
                      {item.external_issue_id} -{' '}
                      {item.project || `Project ${item.project_id}`}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {item.title || '-'} | {item.status}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteIncidentLink(item.id);
                        emitOpsEvent('duplicate_incident_merged', {
                          incident_id: item.id,
                          external_issue_id: item.external_issue_id
                        });
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Ownership Heatmap</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='grid gap-2 md:grid-cols-4'>
                <div className='rounded border p-2 text-sm'>
                  Projects: {data.ownership_heatmap.summary.projects_total}
                </div>
                <div className='rounded border p-2 text-sm'>
                  Teams: {data.ownership_heatmap.summary.teams_total}
                </div>
                <div className='rounded border p-2 text-sm'>
                  Unowned: {data.ownership_heatmap.summary.unowned_projects}
                </div>
                <div className='rounded border p-2 text-sm'>
                  Overloaded: {data.ownership_heatmap.summary.overloaded_teams}
                </div>
              </div>
              {data.ownership_heatmap.teams.slice(0, 8).map((team) => (
                <button
                  type='button'
                  key={team.team_id}
                  className='hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between rounded border p-2 text-left'
                  onClick={() =>
                    emitOpsEvent('high_impact_segment_clicked', {
                      team_id: team.team_id,
                      team: team.team,
                      status: team.status,
                      project_count: team.project_count
                    })
                  }
                >
                  <span className='text-sm'>{team.team}</span>
                  <Badge variant='outline'>
                    {team.project_count} projects | {team.status}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Risk Simulation</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Risk high threshold'
                  value={simRiskHigh}
                  onChange={(event) => setSimRiskHigh(event.target.value)}
                />
                <Input
                  placeholder='Risk medium threshold'
                  value={simRiskMedium}
                  onChange={(event) => setSimRiskMedium(event.target.value)}
                />
                <Input
                  placeholder='Readiness min'
                  value={simReadinessMin}
                  onChange={(event) => setSimReadinessMin(event.target.value)}
                />
                <Input
                  placeholder='Confidence min'
                  value={simConfidenceMin}
                  onChange={(event) => setSimConfidenceMin(event.target.value)}
                />
              </div>
              <Button
                disabled={working}
                onClick={async () => {
                  try {
                    setWorking(true);
                    setActionError(null);
                    const result = await simulateRisk({
                      workspace_id: workspaceId,
                      weeks,
                      release_risk_high_above: Number(simRiskHigh) || 60,
                      release_risk_medium_above: Number(simRiskMedium) || 40,
                      release_readiness_min_pct: Number(simReadinessMin) || 75,
                      delivery_confidence_min_pct:
                        Number(simConfidenceMin) || 70,
                      block_on_open_incidents: true
                    });
                    setSimulationResult(result);
                    if (
                      result.summary.blocked > 0 ||
                      result.summary.warning > 0
                    ) {
                      emitOpsEvent('sla_risk_detected', {
                        blocked: result.summary.blocked,
                        warning: result.summary.warning,
                        projects_total: result.summary.projects_total
                      });
                    }
                  } catch (err) {
                    setActionError(
                      err instanceof Error ? err.message : 'Simulation failed'
                    );
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                Run Simulation
              </Button>

              {preview && (
                <div className='grid gap-2 md:grid-cols-4'>
                  <div className='rounded border p-2 text-sm'>
                    Total: {preview.summary.projects_total}
                  </div>
                  <div className='rounded border p-2 text-sm'>
                    Blocked: {preview.summary.blocked}
                  </div>
                  <div className='rounded border p-2 text-sm'>
                    Warning: {preview.summary.warning}
                  </div>
                  <div className='rounded border p-2 text-sm'>
                    Pass: {preview.summary.pass}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Audit Log + Compliance Export</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center gap-2'>
                <Button variant='outline' asChild>
                  <a
                    href={`${
                      process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'http://localhost:8000/v1'
                    }/ops/audit-log/export${
                      workspaceId ? `?workspace_id=${workspaceId}` : ''
                    }`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Export CSV
                  </a>
                </Button>
              </div>
              {data.audit_log.slice(0, 8).map((event) => (
                <div key={event.id} className='rounded border p-2'>
                  <p className='text-sm font-medium'>
                    {event.action} {event.resource_type}
                    {event.resource_id ? ` #${event.resource_id}` : ''}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {event.created_at || '-'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Workspace Templates</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Input
                placeholder='Template name'
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
              />
              <Input
                placeholder='Description'
                value={newTemplateDescription}
                onChange={(event) =>
                  setNewTemplateDescription(event.target.value)
                }
              />
              <Textarea
                rows={6}
                value={newTemplateDefinition}
                onChange={(event) =>
                  setNewTemplateDefinition(event.target.value)
                }
              />
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    let parsed: Record<string, unknown> = {};
                    try {
                      parsed = JSON.parse(newTemplateDefinition) as Record<
                        string,
                        unknown
                      >;
                    } catch {
                      throw new Error('Template definition must be valid JSON');
                    }
                    await createWorkspaceTemplate({
                      workspace_id: workspaceId,
                      name: newTemplateName.trim() || 'Template',
                      description: newTemplateDescription,
                      definition_json: parsed
                    });
                  })
                }
              >
                Save Template
              </Button>

              {data.workspace_templates.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No workspace templates yet.
                </p>
              )}
              {data.workspace_templates.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.description || 'No description'}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteWorkspaceTemplate(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>11. Release Trains</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Title'
                  value={newReleaseTrainTitle}
                  onChange={(event) =>
                    setNewReleaseTrainTitle(event.target.value)
                  }
                />
                <Input
                  placeholder='Project ID (optional)'
                  value={newReleaseTrainProjectId}
                  onChange={(event) =>
                    setNewReleaseTrainProjectId(event.target.value)
                  }
                />
                <Input
                  placeholder='Start datetime (ISO)'
                  value={newReleaseTrainStartAt}
                  onChange={(event) =>
                    setNewReleaseTrainStartAt(event.target.value)
                  }
                />
                <Input
                  placeholder='End datetime (ISO)'
                  value={newReleaseTrainEndAt}
                  onChange={(event) =>
                    setNewReleaseTrainEndAt(event.target.value)
                  }
                />
              </div>
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    const startAt = parseDateTimeInput(
                      newReleaseTrainStartAt,
                      'Start datetime'
                    );
                    const endAt = parseDateTimeInput(
                      newReleaseTrainEndAt,
                      'End datetime'
                    );
                    await createReleaseTrain({
                      workspace_id: workspaceId,
                      project_id: Number(newReleaseTrainProjectId) || undefined,
                      title: newReleaseTrainTitle.trim() || 'Release Train',
                      event_type: 'release',
                      status: 'planned',
                      start_at: startAt,
                      end_at: endAt
                    });
                    emitOpsEvent('release_selected', {
                      title: newReleaseTrainTitle.trim() || 'Release Train',
                      project_id: Number(newReleaseTrainProjectId) || null
                    });
                  })
                }
              >
                Add Release Train
              </Button>
              {data.release_trains.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No release train events yet.
                </p>
              )}
              {data.release_trains.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.title}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.status} | {item.start_at || '-'} {'->'}{' '}
                      {item.end_at || '-'}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteReleaseTrain(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>12. Remediation Playbooks</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Playbook name'
                  value={newPlaybookName}
                  onChange={(event) => setNewPlaybookName(event.target.value)}
                />
                <Input
                  placeholder='Team ID (optional)'
                  value={newPlaybookTeamId}
                  onChange={(event) => setNewPlaybookTeamId(event.target.value)}
                />
              </div>
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    const playbookName =
                      newPlaybookName.trim() || 'Remediation';
                    emitOpsEvent('runbook_started', {
                      playbook_name: playbookName
                    });
                    try {
                      await createRemediationPlaybook({
                        workspace_id: workspaceId,
                        team_id: Number(newPlaybookTeamId) || undefined,
                        name: playbookName,
                        trigger_type: 'alert_rule',
                        action_type: 'notify',
                        config_json: { channel: '#quality-alerts' }
                      });
                      emitOpsEvent('runbook_completed', {
                        playbook_name: playbookName
                      });
                    } catch (err) {
                      emitOpsEvent('runbook_step_failed', {
                        playbook_name: playbookName
                      });
                      throw err;
                    }
                  })
                }
              >
                Add Playbook
              </Button>
              {data.remediation_playbooks.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No playbooks yet.
                </p>
              )}
              {data.remediation_playbooks.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      trigger: {item.trigger_type} | action: {item.action_type}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteRemediationPlaybook(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>13. SLO Budgets</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-3'>
                <Input
                  placeholder='Project ID'
                  value={newSLOProjectId}
                  onChange={(event) => setNewSLOProjectId(event.target.value)}
                />
                <Input
                  placeholder='Service name'
                  value={newSLOServiceName}
                  onChange={(event) => setNewSLOServiceName(event.target.value)}
                />
                <Input
                  placeholder='SLO target %'
                  value={newSLOTarget}
                  onChange={(event) => setNewSLOTarget(event.target.value)}
                />
              </div>
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    const projectId = Number(newSLOProjectId);
                    if (!projectId) {
                      throw new Error('Project ID is required');
                    }
                    await createSLOBudget({
                      workspace_id: workspaceId,
                      project_id: projectId,
                      service_name: newSLOServiceName.trim() || 'service',
                      slo_target_pct: Number(newSLOTarget) || 99.9
                    });
                  })
                }
              >
                Add SLO Budget
              </Button>
              {data.slo_budgets.length === 0 && (
                <p className='text-muted-foreground text-sm'>No SLOs yet.</p>
              )}
              {data.slo_budgets.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.service_name}</p>
                    <p className='text-muted-foreground text-xs'>
                      target {item.slo_target_pct}% | budget left{' '}
                      {item.error_budget_remaining_pct}% | {item.status}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteSLOBudget(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>14. Rollout Guardrails</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Project ID'
                  value={newGuardrailProjectId}
                  onChange={(event) =>
                    setNewGuardrailProjectId(event.target.value)
                  }
                />
                <Input
                  placeholder='Guardrail name'
                  value={newGuardrailName}
                  onChange={(event) => setNewGuardrailName(event.target.value)}
                />
              </div>
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    const projectId = Number(newGuardrailProjectId);
                    if (!projectId) {
                      throw new Error('Project ID is required');
                    }
                    await createGuardrail({
                      workspace_id: workspaceId,
                      project_id: projectId,
                      name: newGuardrailName.trim() || 'Guardrail',
                      canary_required: true
                    });
                  })
                }
              >
                Add Guardrail
              </Button>
              {data.guardrails.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No guardrails yet.
                </p>
              )}
              {data.guardrails.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      canary min {item.canary_success_rate_min_pct}% | max
                      rollout {item.max_flag_rollout_pct}%
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteGuardrail(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>15. Service Dependencies</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-3'>
                <Input
                  placeholder='Source Project ID'
                  value={newDependencySourceProjectId}
                  onChange={(event) =>
                    setNewDependencySourceProjectId(event.target.value)
                  }
                />
                <Input
                  placeholder='Target Project ID'
                  value={newDependencyTargetProjectId}
                  onChange={(event) =>
                    setNewDependencyTargetProjectId(event.target.value)
                  }
                />
                <Input
                  placeholder='Criticality (low|medium|high)'
                  value={newDependencyCriticality}
                  onChange={(event) =>
                    setNewDependencyCriticality(event.target.value)
                  }
                />
              </div>
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    const sourceProjectId = Number(
                      newDependencySourceProjectId
                    );
                    const targetProjectId = Number(
                      newDependencyTargetProjectId
                    );
                    if (!sourceProjectId || !targetProjectId) {
                      throw new Error(
                        'Source and target project IDs are required'
                      );
                    }
                    await createDependency({
                      workspace_id: workspaceId,
                      source_project_id: sourceProjectId,
                      target_project_id: targetProjectId,
                      criticality:
                        (newDependencyCriticality as
                          | 'low'
                          | 'medium'
                          | 'high') || 'medium'
                    });
                    emitOpsEvent('quality_debt_item_created', {
                      source_project_id: sourceProjectId,
                      target_project_id: targetProjectId,
                      criticality: newDependencyCriticality
                    });
                  })
                }
              >
                Add Dependency
              </Button>
              {data.dependencies.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No dependencies yet.
                </p>
              )}
              {data.dependencies.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>
                      {item.source_project ||
                        `Project ${item.source_project_id}`}{' '}
                      {'->'}{' '}
                      {item.target_project ||
                        `Project ${item.target_project_id}`}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      criticality: {item.criticality}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteDependency(item.id);
                        emitOpsEvent('quality_debt_item_resolved', {
                          dependency_id: item.id
                        });
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>16. Postmortems</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Input
                placeholder='Postmortem title'
                value={newPostmortemTitle}
                onChange={(event) => setNewPostmortemTitle(event.target.value)}
                onFocus={() =>
                  emitOpsEventOnce('rca_started', 'rca_started', {
                    trigger: 'postmortem_title_focus'
                  })
                }
              />
              <Textarea
                rows={4}
                placeholder='Summary'
                value={newPostmortemSummary}
                onChange={(event) =>
                  setNewPostmortemSummary(event.target.value)
                }
              />
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    if (
                      !newPostmortemTitle.trim() ||
                      !newPostmortemSummary.trim()
                    ) {
                      throw new Error('Title and summary are required');
                    }
                    await createPostmortem({
                      workspace_id: workspaceId,
                      title: newPostmortemTitle.trim(),
                      summary: newPostmortemSummary.trim(),
                      status: 'draft'
                    });
                    emitOpsEvent('postmortem_created', {
                      title: newPostmortemTitle.trim()
                    });
                    emitOpsEvent('rca_hypothesis_confirmed', {
                      title: newPostmortemTitle.trim()
                    });
                    emitOpsEvent('action_item_assigned', {
                      postmortem_title: newPostmortemTitle.trim(),
                      inferred_action_items: 1
                    });
                  })
                }
              >
                Add Postmortem
              </Button>
              {data.postmortems.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No postmortems yet.
                </p>
              )}
              {data.postmortems.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.title}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.status} | {item.summary.slice(0, 120)}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deletePostmortem(item.id);
                        emitOpsEvent('action_item_closed', {
                          postmortem_id: item.id
                        });
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>17. Change Approvals</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-2 md:grid-cols-2'>
                <Input
                  placeholder='Release version'
                  value={newApprovalVersion}
                  onChange={(event) =>
                    setNewApprovalVersion(event.target.value)
                  }
                />
                <Input
                  placeholder='Project ID (optional)'
                  value={newApprovalProjectId}
                  onChange={(event) =>
                    setNewApprovalProjectId(event.target.value)
                  }
                />
                <Input
                  placeholder='Required roles (comma separated)'
                  value={newApprovalRoles}
                  onChange={(event) => setNewApprovalRoles(event.target.value)}
                />
                <Input
                  placeholder='Requested by'
                  value={newApprovalRequestedBy}
                  onChange={(event) =>
                    setNewApprovalRequestedBy(event.target.value)
                  }
                />
              </div>
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    if (!newApprovalVersion.trim()) {
                      throw new Error('Release version is required');
                    }
                    await createChangeApproval({
                      workspace_id: workspaceId,
                      project_id: Number(newApprovalProjectId) || undefined,
                      release_version: newApprovalVersion.trim(),
                      required_roles: newApprovalRoles
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                      requested_by: newApprovalRequestedBy.trim() || undefined,
                      status: 'pending'
                    });
                  })
                }
              >
                Request Approval
              </Button>
              {data.change_approvals.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No change approvals yet.
                </p>
              )}
              {data.change_approvals.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>
                      {item.release_version}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {item.status} | roles:{' '}
                      {item.required_roles.join(', ') || '-'}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteChangeApproval(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>18. Webhook Automations</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Input
                placeholder='Automation name'
                value={newWebhookName}
                onChange={(event) => setNewWebhookName(event.target.value)}
              />
              <Input
                placeholder='Event type'
                value={newWebhookEventType}
                onChange={(event) => setNewWebhookEventType(event.target.value)}
              />
              <Input
                placeholder='Webhook URL'
                value={newWebhookUrl}
                onChange={(event) => setNewWebhookUrl(event.target.value)}
              />
              <Button
                disabled={working}
                onClick={() =>
                  void runMutationAction(async () => {
                    if (!newWebhookUrl.trim()) {
                      throw new Error('Webhook URL is required');
                    }
                    await createWebhookAutomation({
                      workspace_id: workspaceId,
                      name: newWebhookName.trim() || 'Webhook Automation',
                      event_type:
                        newWebhookEventType.trim() || 'release_blocked',
                      url: newWebhookUrl.trim(),
                      active: true
                    });
                  })
                }
              >
                Add Webhook
              </Button>
              {data.webhook_automations.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No webhooks yet.
                </p>
              )}
              {data.webhook_automations.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.event_type} | last status:{' '}
                      {item.last_status || 'never'}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={working}
                    onClick={() =>
                      void runMutationAction(async () => {
                        await deleteWebhookAutomation(item.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>19. Quality Cost</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='grid gap-2 md:grid-cols-2'>
                <div className='rounded border p-2 text-sm'>
                  Incidents: {data.quality_cost.summary.incidents_total}
                </div>
                <div className='rounded border p-2 text-sm'>
                  Failed Pipelines: {data.quality_cost.summary.failed_pipelines}
                </div>
                <div className='rounded border p-2 text-sm'>
                  Estimated Hours:{' '}
                  {data.quality_cost.summary.estimated_quality_hours}
                </div>
                <div className='rounded border p-2 text-sm'>
                  Estimated Cost: $
                  {data.quality_cost.summary.estimated_quality_cost_usd}
                </div>
              </div>
              <p className='text-muted-foreground text-xs'>
                Breakdown: recovery{' '}
                {data.quality_cost.breakdown_hours.incident_recovery}h | rework{' '}
                {data.quality_cost.breakdown_hours.failure_rework}h |
                coordination {data.quality_cost.breakdown_hours.coordination}h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>20. Predictive Risk</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.predictive_risk.items.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No predictive items.
                </p>
              )}
              {data.predictive_risk.items.slice(0, 8).map((item) => (
                <div
                  key={item.project_id}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{item.project}</p>
                    <p className='text-muted-foreground text-xs'>
                      current {item.current_release_risk_score} | projected{' '}
                      {item.projected_risk_score}
                    </p>
                  </div>
                  <Badge variant='outline'>{item.projected_level}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>21. Status Page Preview</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center gap-2'>
                <Badge>{data.status_page.overall_status}</Badge>
                <span className='text-muted-foreground text-sm'>
                  open incidents: {data.status_page.open_incidents}
                </span>
              </div>
              <p className='text-sm'>{data.status_page.message}</p>
              {data.status_page.services.slice(0, 6).map((service, index) => (
                <div
                  key={`${service.service}-${index}`}
                  className='rounded border p-2'
                >
                  <p className='text-sm font-medium'>
                    {service.service || 'Unknown Service'}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {service.status || '-'} | {service.reason || '-'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>22. Team Benchmarking</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {data.team_benchmarking.items.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No team benchmark data.
                </p>
              )}
              {data.team_benchmarking.items.map((item) => (
                <div
                  key={item.team}
                  className='flex items-center justify-between rounded border p-2'
                >
                  <div>
                    <p className='text-sm font-medium'>
                      #{item.rank} {item.team}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      score {item.score} | {item.dora_classification} |
                      readiness {item.readiness_avg_pct}%
                    </p>
                  </div>
                  <Badge variant='outline'>{item.project_count} projects</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
