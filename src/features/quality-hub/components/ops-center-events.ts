import { OpsProductEventName } from '@/features/quality-hub/types';

export const OPS_EVENT_TODOS = [
  {
    key: 'live_quality_scoreboard',
    title: 'Live Quality Scoreboard',
    events: ['quality_dashboard_opened', 'quality_score_threshold_breached']
  },
  {
    key: 'sla_risk_fruehwarnung',
    title: 'SLA-Risiko-Fruehwarnung',
    events: ['sla_risk_detected', 'sla_alert_acknowledged']
  },
  {
    key: 'incident_timeline',
    title: 'Incident Timeline (End-to-End)',
    events: ['incident_timeline_opened', 'timeline_event_filtered']
  },
  {
    key: 'root_cause_assistant',
    title: 'Root-Cause-Assistent (KI-gestuetzt)',
    events: ['rca_started', 'rca_hypothesis_confirmed']
  },
  {
    key: 'runbook_automation',
    title: 'Runbook-Automation',
    events: ['runbook_started', 'runbook_step_failed', 'runbook_completed']
  },
  {
    key: 'release_impact_monitor',
    title: 'Release-Impact-Monitor',
    events: ['release_selected', 'post_release_regression_detected']
  },
  {
    key: 'customer_impact_heatmap',
    title: 'Customer-Impact-Heatmap',
    events: ['impact_heatmap_opened', 'high_impact_segment_clicked']
  },
  {
    key: 'duplicate_issue_detection',
    title: 'Duplicate-Issue-Erkennung',
    events: ['possible_duplicate_found', 'duplicate_incident_merged']
  },
  {
    key: 'postmortem_builder',
    title: 'Postmortem-Builder mit Action Items',
    events: ['postmortem_created', 'action_item_assigned', 'action_item_closed']
  },
  {
    key: 'ownership_escalation',
    title: 'Ownership-Eskalation',
    events: ['owner_missing_detected', 'escalation_triggered']
  },
  {
    key: 'quality_debt_backlog',
    title: 'Quality-Debt Backlog',
    events: ['quality_debt_item_created', 'quality_debt_item_resolved']
  },
  {
    key: 'gameday_drill_mode',
    title: 'GameDay/Drill-Modus',
    events: ['drill_started', 'drill_completed', 'drill_score_shared']
  }
] as const satisfies ReadonlyArray<{
  key: string;
  title: string;
  events: readonly OpsProductEventName[];
}>;

export type OpsEventTodoKey = (typeof OPS_EVENT_TODOS)[number]['key'];
export type OpsEventTodoItem = (typeof OPS_EVENT_TODOS)[number];

export const ALL_OPS_PRODUCT_EVENTS = OPS_EVENT_TODOS.flatMap(
  (item) => item.events
);

export const OPS_EVENT_SCENARIO_BY_NAME = Object.fromEntries(
  OPS_EVENT_TODOS.flatMap((item) =>
    item.events.map((eventName) => [eventName, item.key])
  )
) as Record<OpsProductEventName, OpsEventTodoKey>;
