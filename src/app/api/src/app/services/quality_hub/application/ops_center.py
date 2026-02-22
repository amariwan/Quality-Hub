from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

SUCCESS_STATUSES = {"success", "passed"}
FAILED_STATUSES = {"failed", "canceled"}


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def now_utc() -> datetime:
    return datetime.now(UTC)


def pipeline_time(pipeline: Any) -> datetime:
    raw = getattr(pipeline, "finished_at", None) or getattr(pipeline, "started_at", None)
    if isinstance(raw, datetime):
        return _to_utc(raw)
    return datetime.fromtimestamp(0, tz=UTC)


def normalize_workspace_path(raw: str | None) -> str | None:
    if raw is None:
        return None
    normalized = raw.strip().strip("/").casefold()
    return normalized or None


def project_belongs_to_workspace(project_path_with_namespace: str | None, workspace_path: str | None) -> bool:
    if workspace_path is None:
        return True
    if not project_path_with_namespace:
        return False

    normalized_project_path = project_path_with_namespace.strip().strip("/").casefold()
    return normalized_project_path == workspace_path or normalized_project_path.startswith(f"{workspace_path}/")


def is_release_candidate_pipeline(pipeline: Any) -> bool:
    ref = (getattr(pipeline, "ref", None) or "").strip()
    source = (getattr(pipeline, "source_type", None) or "").strip().lower()
    return ref == "main" or ref.startswith("release/") or source in {
        "merge_request_event",
        "push",
        "web",
        "api",
        "schedule",
    }


def compute_mttr_hours(pipelines: list[Any]) -> float | None:
    by_project: dict[int, list[Any]] = defaultdict(list)
    for pipeline in pipelines:
        project_id = getattr(pipeline, "project_id", None)
        if not isinstance(project_id, int):
            continue
        by_project[project_id].append(pipeline)

    recoveries: list[float] = []
    for rows in by_project.values():
        ordered = sorted(rows, key=pipeline_time)
        for index, row in enumerate(ordered):
            status = (getattr(row, "status", "") or "").lower()
            if status not in FAILED_STATUSES:
                continue
            failed_at = pipeline_time(row)
            for followup in ordered[index + 1 :]:
                followup_status = (getattr(followup, "status", "") or "").lower()
                if followup_status in SUCCESS_STATUSES:
                    recovered_at = pipeline_time(followup)
                    recoveries.append((recovered_at - failed_at).total_seconds() / 3600)
                    break

    if not recoveries:
        return None
    return round(sum(recoveries) / len(recoveries), 2)


def _classification_for_deployments(per_day: float) -> str:
    if per_day >= 1.0:
        return "elite"
    if per_day >= (1.0 / 7.0):
        return "high"
    if per_day >= (1.0 / 30.0):
        return "medium"
    return "low"


def _classification_for_lead_time(hours: float | None) -> str:
    if hours is None:
        return "low"
    if hours <= 24:
        return "elite"
    if hours <= 168:
        return "high"
    if hours <= 720:
        return "medium"
    return "low"


def _classification_for_failure_rate(pct: float) -> str:
    if pct <= 15:
        return "elite"
    if pct <= 30:
        return "high"
    if pct <= 45:
        return "medium"
    return "low"


def _classification_for_mttr(hours: float | None) -> str:
    if hours is None:
        return "low"
    if hours <= 1:
        return "elite"
    if hours <= 24:
        return "high"
    if hours <= 168:
        return "medium"
    return "low"


def _rank_of_classification(level: str) -> int:
    return {
        "elite": 4,
        "high": 3,
        "medium": 2,
        "low": 1,
    }.get(level, 1)


def _lead_time_hours(pipeline: Any) -> float | None:
    duration = getattr(pipeline, "duration", None)
    if isinstance(duration, (int, float)) and duration >= 0:
        return float(duration) / 3600

    started_at = getattr(pipeline, "started_at", None)
    finished_at = getattr(pipeline, "finished_at", None)
    if isinstance(started_at, datetime) and isinstance(finished_at, datetime):
        delta = _to_utc(finished_at) - _to_utc(started_at)
        if delta.total_seconds() >= 0:
            return delta.total_seconds() / 3600

    return None


def compute_dora_metrics(
    pipelines: list[Any],
    *,
    days: int,
    now: datetime | None = None,
) -> dict[str, Any]:
    day_window = max(1, days)
    current = now or now_utc()
    cutoff = current - timedelta(days=day_window)

    release_rows = [
        row
        for row in pipelines
        if pipeline_time(row) >= cutoff and is_release_candidate_pipeline(row)
    ]

    success_rows = [
        row for row in release_rows if ((getattr(row, "status", "") or "").lower() in SUCCESS_STATUSES)
    ]
    failed_rows = [
        row for row in release_rows if ((getattr(row, "status", "") or "").lower() in FAILED_STATUSES)
    ]

    successful_deployments = len(success_rows)
    deployment_per_day = successful_deployments / day_window
    deployment_per_week = deployment_per_day * 7

    lead_times = [lead_time for row in success_rows if (lead_time := _lead_time_hours(row)) is not None]
    avg_lead_time_hours = round(sum(lead_times) / len(lead_times), 2) if lead_times else None

    total_release_events = len(release_rows)
    change_failure_rate_pct = round(
        ((len(failed_rows) / total_release_events) * 100) if total_release_events else 0.0,
        2,
    )

    mttr_hours = compute_mttr_hours(release_rows)

    deployment_class = _classification_for_deployments(deployment_per_day)
    lead_class = _classification_for_lead_time(avg_lead_time_hours)
    failure_class = _classification_for_failure_rate(change_failure_rate_pct)
    mttr_class = _classification_for_mttr(mttr_hours)

    aggregate_score = (
        _rank_of_classification(deployment_class)
        + _rank_of_classification(lead_class)
        + _rank_of_classification(failure_class)
        + _rank_of_classification(mttr_class)
    ) / 4
    overall_classification = (
        "elite"
        if aggregate_score >= 3.6
        else "high"
        if aggregate_score >= 2.8
        else "medium"
        if aggregate_score >= 2.0
        else "low"
    )

    return {
        "window_days": day_window,
        "sample_size": total_release_events,
        "deployment_frequency": {
            "deployments": successful_deployments,
            "per_day": round(deployment_per_day, 3),
            "per_week": round(deployment_per_week, 2),
            "classification": deployment_class,
        },
        "lead_time_hours": {
            "value": avg_lead_time_hours,
            "classification": lead_class,
        },
        "change_failure_rate": {
            "pct": change_failure_rate_pct,
            "classification": failure_class,
        },
        "mttr_hours": {
            "value": mttr_hours,
            "classification": mttr_class,
        },
        "overall_classification": overall_classification,
        "calculation_note": "Lead time is approximated from pipeline duration/start-finish timestamps.",
    }


def _project_label(path_with_namespace: str | None, project_id: int) -> str:
    if not path_with_namespace:
        return f"Project {project_id}"
    return path_with_namespace


def build_ownership_heatmap(
    *,
    projects: list[Any],
    teams: list[Any],
    team_project_mappings: list[Any],
    capacity_threshold: int,
) -> dict[str, Any]:
    team_by_id = {
        int(team.id): team
        for team in teams
        if isinstance(getattr(team, "id", None), int)
    }
    project_by_id = {
        int(project.id): project
        for project in projects
        if isinstance(getattr(project, "id", None), int)
    }

    team_to_project_ids: dict[int, set[int]] = defaultdict(set)
    project_to_team_ids: dict[int, set[int]] = defaultdict(set)
    for mapping in team_project_mappings:
        team_id = getattr(mapping, "team_id", None)
        project_id = getattr(mapping, "project_id", None)
        if not isinstance(team_id, int) or not isinstance(project_id, int):
            continue
        if team_id not in team_by_id or project_id not in project_by_id:
            continue
        team_to_project_ids[team_id].add(project_id)
        project_to_team_ids[project_id].add(team_id)

    team_rows: list[dict[str, Any]] = []
    for team_id, team in team_by_id.items():
        project_count = len(team_to_project_ids.get(team_id, set()))
        if project_count == 0:
            status = "idle"
        elif project_count > capacity_threshold:
            status = "overloaded"
        else:
            status = "balanced"

        team_rows.append(
            {
                "team_id": team_id,
                "team": getattr(team, "name", f"Team {team_id}"),
                "project_count": project_count,
                "status": status,
                "capacity_threshold": capacity_threshold,
            }
        )

    project_rows: list[dict[str, Any]] = []
    unowned_projects: list[dict[str, Any]] = []
    for project_id, project in project_by_id.items():
        owner_team_ids = sorted(project_to_team_ids.get(project_id, set()))
        owner_names = [
            getattr(team_by_id[team_id], "name", f"Team {team_id}")
            for team_id in owner_team_ids
            if team_id in team_by_id
        ]
        project_label = _project_label(getattr(project, "path_with_namespace", None), project_id)
        row = {
            "project_id": project_id,
            "project": project_label,
            "owners_count": len(owner_names),
            "owners": owner_names,
        }
        project_rows.append(row)
        if not owner_names:
            unowned_projects.append(row)

    overloaded_teams = [row for row in team_rows if row["status"] == "overloaded"]

    return {
        "summary": {
            "projects_total": len(project_rows),
            "teams_total": len(team_rows),
            "unowned_projects": len(unowned_projects),
            "overloaded_teams": len(overloaded_teams),
        },
        "teams": sorted(team_rows, key=lambda row: (-row["project_count"], str(row["team"]))),
        "projects": sorted(project_rows, key=lambda row: (row["owners_count"], str(row["project"]))),
        "unowned_projects": unowned_projects,
    }


def simulate_risk_decisions(  # noqa: PLR0913
    *,
    projects: list[dict[str, Any]],
    incident_count_by_project: dict[int, int],
    release_risk_high_above: float,
    release_risk_medium_above: float,
    release_readiness_min_pct: float,
    delivery_confidence_min_pct: float,
    block_on_open_incidents: bool,
) -> dict[str, Any]:
    decisions: list[dict[str, Any]] = []

    for project in projects:
        project_id_raw = project.get("project_id")
        if not isinstance(project_id_raw, int):
            continue
        project_id = project_id_raw

        risk = float(project.get("release_risk", {}).get("score", 0.0))
        readiness = float(project.get("release_readiness_pct", 0.0))
        confidence = float(project.get("delivery_confidence_pct", 0.0))
        open_incidents = int(incident_count_by_project.get(project_id, 0))

        blocking_reasons: list[str] = []
        warning_reasons: list[str] = []

        if risk >= release_risk_high_above:
            blocking_reasons.append("risk_high")
        elif risk >= release_risk_medium_above:
            warning_reasons.append("risk_medium")

        if readiness < release_readiness_min_pct:
            blocking_reasons.append("readiness_low")
        if confidence < delivery_confidence_min_pct:
            blocking_reasons.append("confidence_low")
        if block_on_open_incidents and open_incidents > 0:
            blocking_reasons.append("open_incidents")

        status = "pass"
        if blocking_reasons:
            status = "blocked"
        elif warning_reasons:
            status = "warning"

        decisions.append(
            {
                "project_id": project_id,
                "project": project.get("project"),
                "status": status,
                "release_risk_score": round(risk, 1),
                "release_readiness_pct": round(readiness, 1),
                "delivery_confidence_pct": round(confidence, 1),
                "open_incidents": open_incidents,
                "blocking_reasons": blocking_reasons,
                "warning_reasons": warning_reasons,
            }
        )

    blocked_count = sum(1 for row in decisions if row["status"] == "blocked")
    warning_count = sum(1 for row in decisions if row["status"] == "warning")
    pass_count = sum(1 for row in decisions if row["status"] == "pass")
    total = len(decisions)

    return {
        "thresholds": {
            "release_risk_high_above": release_risk_high_above,
            "release_risk_medium_above": release_risk_medium_above,
            "release_readiness_min_pct": release_readiness_min_pct,
            "delivery_confidence_min_pct": delivery_confidence_min_pct,
            "block_on_open_incidents": block_on_open_incidents,
        },
        "summary": {
            "projects_total": total,
            "blocked": blocked_count,
            "warning": warning_count,
            "pass": pass_count,
            "simulated_release_success_rate_pct": round(((pass_count / total) * 100) if total else 0.0, 1),
        },
        "decisions": sorted(decisions, key=lambda row: ({"blocked": 0, "warning": 1, "pass": 2}.get(row["status"], 3), str(row["project"]))),
    }


def build_weekly_executive_summary(
    *,
    radar_payload: dict[str, Any],
    dora_metrics: dict[str, Any],
    open_incidents: int,
    active_release_policies: int,
) -> dict[str, Any]:
    summary = radar_payload.get("summary", {})
    high_risk_projects = int(summary.get("high_risk_projects", 0) or 0)
    regression_events = int(summary.get("regression_events", 0) or 0)
    quality_trend = radar_payload.get("quality_trend", [])

    trend_direction = "stable"
    if len(quality_trend) >= 2:
        previous = float(quality_trend[-2].get("score", 0.0))
        current = float(quality_trend[-1].get("score", 0.0))
        if current >= previous + 5:
            trend_direction = "improving"
        elif current <= previous - 5:
            trend_direction = "declining"

    top_risks = [
        item
        for item in radar_payload.get("release_risk", {}).get("projects", [])
        if isinstance(item, dict)
    ]
    top_risks = sorted(top_risks, key=lambda item: float(item.get("score", 0.0)), reverse=True)[:5]

    highlights = [
        f"{summary.get('project_count', 0)} Projekte im Scope",
        f"{high_risk_projects} Hochrisiko-Projekte",
        f"{regression_events} Regressionen im aktuellen Fenster",
        f"DORA Klassifizierung: {dora_metrics.get('overall_classification', 'low')}",
        f"Trend: {trend_direction}",
    ]

    recommendations: list[str] = []
    if high_risk_projects > 0:
        recommendations.append("Release Gate fuer Hochrisiko-Projekte aktivieren oder verschaerfen.")
    if regression_events > 0:
        recommendations.append("Regressions-Cluster priorisieren und Incident-Links pro betroffenem Projekt pflegen.")
    if open_incidents > 0:
        recommendations.append("Offene Incidents in der kommenden Release-Runde als Blocking-Kriterium behandeln.")
    if active_release_policies == 0:
        recommendations.append("Mindestens eine Release-Gate-Policy pro Workspace anlegen.")

    if not recommendations:
        recommendations.append("Aktuelle Qualitaetslage stabil. Fokus auf Automatisierung und schnellere Recovery-Zeiten.")

    return {
        "generated_at": now_utc().isoformat(),
        "headline": f"{high_risk_projects} Hochrisiko-Projekte | DORA {dora_metrics.get('overall_classification', 'low').upper()}",
        "highlights": highlights,
        "top_risks": [
            {
                "project_id": item.get("project_id"),
                "project": item.get("project"),
                "score": item.get("score"),
                "level": item.get("level"),
            }
            for item in top_risks
        ],
        "recommendations": recommendations,
        "kpis": {
            "delivery_confidence_avg_pct": summary.get("delivery_confidence_avg_pct", 0),
            "release_readiness_avg_pct": summary.get("release_readiness_avg_pct", 0),
            "open_incidents": open_incidents,
            "active_release_policies": active_release_policies,
        },
    }
