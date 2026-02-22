from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

SUCCESS_STATUSES = {"success", "passed"}
FAILED_STATUSES = {"failed", "canceled"}


@dataclass(slots=True)
class RadarPipeline:
    id: int
    project_id: int
    gitlab_pipeline_id: int
    status: str
    ref: str | None
    sha: str | None
    source_type: str | None
    started_at: datetime | None
    finished_at: datetime | None
    duration: float | None


@dataclass(slots=True)
class RadarProject:
    id: int
    path_with_namespace: str


@dataclass(slots=True)
class RadarReport:
    pipeline_id: int
    report_type: str
    summary_json: dict[str, Any]


@dataclass(slots=True)
class RadarMergeRequest:
    project_id: int
    iid: int | None
    title: str
    labels: list[str]
    target_branch: str | None
    merged_at: datetime | None
    merge_commit_sha: str | None
    web_url: str | None


@dataclass(slots=True)
class RadarTeamProjectMapping:
    team_name: str
    project_id: int


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _safe_score(value: float) -> float:
    return max(0.0, min(100.0, round(value, 1)))


def _quality_status(score: float) -> str:
    if score >= 80:
        return "green"
    if score >= 60:
        return "yellow"
    return "red"


def _risk_level(risk_score: float) -> str:
    if risk_score <= 29:
        return "low"
    if risk_score <= 59:
        return "medium"
    return "high"


def _status_code(status: str) -> str:
    return {
        "green": "GREEN",
        "yellow": "YELLOW",
        "red": "RED",
        "low": "GREEN",
        "medium": "YELLOW",
        "high": "RED",
    }.get(status, "YELLOW")


def _pipeline_time(pipeline: RadarPipeline) -> datetime:
    return pipeline.finished_at or pipeline.started_at or datetime.fromtimestamp(0, tz=UTC)


def _week_start(ts: datetime) -> date:
    d = ts.date()
    return d - timedelta(days=d.weekday())


def _kw_label(day: date) -> str:
    return f"KW{day.isocalendar().week}"


def _merged_report_summary(reports: list[RadarReport]) -> dict[str, float | bool]:
    tests_total = 0
    tests_failed = 0
    critical_findings = 0
    build_artifact_present = False

    for report in reports:
        summary = report.summary_json or {}
        tests_total += int(summary.get("tests_total", 0) or 0)
        tests_failed += int(summary.get("tests_failed", 0) or 0)
        critical_findings += int(summary.get("critical_findings", 0) or 0)
        if summary.get("build_artifact_present") is True:
            build_artifact_present = True

    return {
        "tests_total": tests_total,
        "tests_failed": tests_failed,
        "critical_findings": critical_findings,
        "build_artifact_present": build_artifact_present,
    }


def _build_stability(pipelines: list[RadarPipeline]) -> float:
    if not pipelines:
        return 0.0
    success = sum(1 for p in pipelines if (p.status or "").lower() in SUCCESS_STATUSES)
    return _safe_score((success / len(pipelines)) * 100)


def _test_success_rate(pipelines: list[RadarPipeline], reports_by_pipeline: dict[int, list[RadarReport]]) -> float:
    tests_total = 0
    tests_failed = 0
    for pipeline in pipelines:
        summary = _merged_report_summary(reports_by_pipeline.get(pipeline.id, []))
        tests_total += int(summary["tests_total"])
        tests_failed += int(summary["tests_failed"])

    if tests_total <= 0:
        return _build_stability(pipelines)

    return _safe_score(((tests_total - tests_failed) / tests_total) * 100)


def _security_score(pipelines: list[RadarPipeline], reports_by_pipeline: dict[int, list[RadarReport]]) -> float:
    critical = 0
    saw_signal = False

    for pipeline in pipelines:
        for report in reports_by_pipeline.get(pipeline.id, []):
            if report.report_type.lower() != "sarif":
                continue
            saw_signal = True
            critical += int(report.summary_json.get("critical_findings", 0) or 0)

    if not saw_signal:
        return 100.0
    return _safe_score(100 - (critical * 20))


def _mttr_hours(pipelines: list[RadarPipeline]) -> float | None:
    ordered = sorted(pipelines, key=_pipeline_time)
    recoveries: list[float] = []

    for idx, pipeline in enumerate(ordered):
        if (pipeline.status or "").lower() not in FAILED_STATUSES:
            continue
        failed_at = _pipeline_time(pipeline)
        for followup in ordered[idx + 1 :]:
            if (followup.status or "").lower() in SUCCESS_STATUSES:
                recovered_at = _pipeline_time(followup)
                recoveries.append((recovered_at - failed_at).total_seconds() / 3600)
                break

    if not recoveries:
        return None
    return sum(recoveries) / len(recoveries)


def _mttr_score(mttr_hours: float | None) -> float:
    if mttr_hours is None:
        return 100.0
    if mttr_hours >= 72:
        return 0.0
    return _safe_score(100 - ((mttr_hours / 72) * 100))


def _flakiness_score(pipelines: list[RadarPipeline], reports_by_pipeline: dict[int, list[RadarReport]]) -> float:
    tested = 0
    unstable = 0
    for pipeline in pipelines:
        summary = _merged_report_summary(reports_by_pipeline.get(pipeline.id, []))
        if int(summary["tests_total"]) <= 0:
            continue
        tested += 1
        if int(summary["tests_failed"]) > 0:
            unstable += 1

    if tested == 0:
        return 100.0
    return _safe_score(100 - ((unstable / tested) * 100))


def _quality_score(
    *,
    build_stability: float,
    test_success_rate: float,
    security_score: float,
    quality_trend_score: float,
) -> float:
    return _safe_score(
        (0.30 * build_stability)
        + (0.30 * test_success_rate)
        + (0.25 * security_score)
        + (0.15 * quality_trend_score)
    )


def _project_name(path_with_namespace: str) -> str:
    if not path_with_namespace:
        return "Unknown"
    return path_with_namespace.rsplit("/", maxsplit=1)[-1]


def _risk_label(level: str) -> str:
    return {
        "low": "Niedrig",
        "medium": "Mittel",
        "high": "Hoch",
    }.get(level, "Mittel")


def _build_weekly_trend(
    pipelines: list[RadarPipeline],
    reports_by_pipeline: dict[int, list[RadarReport]],
    weeks: int,
) -> list[dict[str, Any]]:
    now = _now_utc()
    current_week_start = _week_start(now)
    trend_rows: list[dict[str, Any]] = []
    previous_score: float | None = None

    for offset in range(weeks - 1, -1, -1):
        week_start = current_week_start - timedelta(days=7 * offset)
        week_end = week_start + timedelta(days=7)
        week_pipelines = [p for p in pipelines if week_start <= _pipeline_time(p).date() < week_end]

        build = _build_stability(week_pipelines)
        test = _test_success_rate(week_pipelines, reports_by_pipeline)
        security = _security_score(week_pipelines, reports_by_pipeline)
        score = _safe_score((0.4 * build) + (0.35 * test) + (0.25 * security))

        if score < 60:
            label = "RED Kritisch"
            status = "critical"
        elif previous_score is not None and score <= previous_score - 10:
            label = "YELLOW Sinkend"
            status = "sinking"
        else:
            label = "GREEN Stabil"
            status = "stable"

        trend_rows.append({"week": _kw_label(week_start), "status": status, "label": label, "score": score})
        previous_score = score

    return trend_rows


def _parse_label_set(labels: list[str]) -> set[str]:
    return {label.strip().lower() for label in labels if label and label.strip()}


def _categorize_merge_request(mr: RadarMergeRequest) -> str:  # noqa: PLR0911
    labels = _parse_label_set(mr.labels)
    title = (mr.title or "").lower()

    if {"security", "sec", "vuln", "dependency"}.intersection(labels) or "security" in title:
        return "security"
    if {"bug", "bugfix", "fix", "defect"}.intersection(labels) or title.startswith("fix"):
        return "bugfix"
    if {"performance", "perf"}.intersection(labels) or "performance" in title:
        return "performance"
    if {"ui", "ux", "frontend", "design"}.intersection(labels):
        return "uiux"
    if {"hotfix", "urgent"}.intersection(labels):
        return "hotfix"
    if {"integration", "infra", "platform"}.intersection(labels):
        return "integration"
    if {"feature", "enhancement"}.intersection(labels) or title.startswith("feat"):
        return "feature"
    return "integration"


def _category_label(category: str) -> str:
    return {
        "feature": "NEW_FEATURE",
        "bugfix": "BUGFIX",
        "performance": "PERFORMANCE",
        "security": "SECURITY",
        "integration": "INTEGRATION",
        "uiux": "UI_UX",
        "hotfix": "HOTFIX",
    }.get(category, "INTEGRATION")


def _fallback_category(pipeline: RadarPipeline, summary: dict[str, float | bool]) -> str:
    if int(summary.get("critical_findings", 0) or 0) > 0:
        return "security"
    if int(summary.get("tests_failed", 0) or 0) > 0:
        return "bugfix"
    if (pipeline.ref or "").startswith("release/"):
        return "integration"
    if (pipeline.source_type or "") == "schedule":
        return "performance"
    return "feature"


def _find_best_merge_request(
    *,
    pipeline: RadarPipeline,
    merge_requests: list[RadarMergeRequest],
) -> RadarMergeRequest | None:
    if not merge_requests:
        return None

    if pipeline.sha:
        for mr in merge_requests:
            if mr.merge_commit_sha and mr.merge_commit_sha == pipeline.sha:
                return mr

    if pipeline.ref:
        same_branch = [mr for mr in merge_requests if mr.target_branch == pipeline.ref]
        if same_branch:
            return sorted(same_branch, key=lambda mr: mr.merged_at or datetime.fromtimestamp(0, tz=UTC), reverse=True)[0]

    return sorted(merge_requests, key=lambda mr: mr.merged_at or datetime.fromtimestamp(0, tz=UTC), reverse=True)[0]


def build_management_risk_radar(  # noqa: C901, PLR0912, PLR0913, PLR0915
    *,
    projects: list[RadarProject],
    pipelines: list[RadarPipeline],
    reports: list[RadarReport],
    team_names: list[str],
    team_project_mappings: list[RadarTeamProjectMapping],
    merge_requests_by_project: dict[int, list[RadarMergeRequest]] | None = None,
    weeks: int = 3,
) -> dict[str, Any]:
    reports_by_pipeline: dict[int, list[RadarReport]] = defaultdict(list)
    for report in reports:
        reports_by_pipeline[report.pipeline_id].append(report)

    projects_by_id = {project.id: project for project in projects}
    pipelines_by_project: dict[int, list[RadarPipeline]] = defaultdict(list)
    for pipeline in pipelines:
        pipelines_by_project[pipeline.project_id].append(pipeline)
    for project_id, rows in pipelines_by_project.items():
        pipelines_by_project[project_id] = sorted(rows, key=_pipeline_time, reverse=True)

    merge_requests_by_project = merge_requests_by_project or {}

    project_rows: list[dict[str, Any]] = []
    project_status_rows: list[dict[str, Any]] = []
    release_notes_feed: list[dict[str, Any]] = []
    all_regressions: list[dict[str, Any]] = []

    now = _now_utc()
    current_week = _week_start(now)
    previous_week = current_week - timedelta(days=7)

    for project in projects:
        recent = pipelines_by_project.get(project.id, [])[:40]

        build_stability = _build_stability(recent)
        test_success_rate = _test_success_rate(recent, reports_by_pipeline)
        security_status = _security_score(recent, reports_by_pipeline)
        weekly_trend = _build_weekly_trend(recent, reports_by_pipeline, weeks=weeks)
        trend_score = weekly_trend[-1]["score"] if weekly_trend else 0.0

        readiness_score = _safe_score((0.40 * build_stability) + (0.35 * test_success_rate) + (0.25 * security_status))
        quality_score = _quality_score(
            build_stability=build_stability,
            test_success_rate=test_success_rate,
            security_score=security_status,
            quality_trend_score=trend_score,
        )
        release_risk_score = _safe_score(100 - quality_score)
        risk_level = _risk_level(release_risk_score)

        last_14_days = [p for p in recent if _pipeline_time(p) >= (now - timedelta(days=14))]
        pipeline_success_14 = _build_stability(last_14_days)
        mttr_hours = _mttr_hours(last_14_days)
        mttr_score = _mttr_score(mttr_hours)
        flakiness_score = _flakiness_score(last_14_days, reports_by_pipeline)
        delivery_confidence = _safe_score((0.5 * pipeline_success_14) + (0.3 * mttr_score) + (0.2 * flakiness_score))

        current_week_pipelines = [
            p for p in recent if current_week <= _pipeline_time(p).date() < (current_week + timedelta(days=7))
        ]
        previous_week_pipelines = [p for p in recent if previous_week <= _pipeline_time(p).date() < current_week]

        current_tests_failed = sum(
            int(_merged_report_summary(reports_by_pipeline.get(p.id, []))["tests_failed"]) for p in current_week_pipelines
        )
        previous_tests_failed = sum(
            int(_merged_report_summary(reports_by_pipeline.get(p.id, []))["tests_failed"])
            for p in previous_week_pipelines
        )
        current_critical = sum(
            int(_merged_report_summary(reports_by_pipeline.get(p.id, []))["critical_findings"])
            for p in current_week_pipelines
        )
        previous_critical = sum(
            int(_merged_report_summary(reports_by_pipeline.get(p.id, []))["critical_findings"])
            for p in previous_week_pipelines
        )

        current_build = _build_stability(current_week_pipelines)
        previous_build = _build_stability(previous_week_pipelines)

        regression_events: list[dict[str, Any]] = []
        if previous_tests_failed > 0 and current_tests_failed >= int(previous_tests_failed * 1.2):
            regression_events.append(
                {
                    "type": "test_failures",
                    "severity": "medium",
                    "reason": "Steigende Testfehler gegenueber Vorwoche",
                    "current": current_tests_failed,
                    "previous": previous_tests_failed,
                }
            )
        if current_critical > previous_critical:
            regression_events.append(
                {
                    "type": "security",
                    "severity": "high",
                    "reason": "Neue Security Findings in High/Critical",
                    "current": current_critical,
                    "previous": previous_critical,
                }
            )

        build_delta = previous_build - current_build
        if current_build < 80 or build_delta >= 10:
            regression_events.append(
                {
                    "type": "stability",
                    "severity": "medium" if current_build >= 60 else "high",
                    "reason": "Build Stability unter Schwellwert oder deutlicher Rueckgang",
                    "current": current_build,
                    "previous": previous_build,
                }
            )

        for event in regression_events:
            all_regressions.append({"project_id": project.id, "project": _project_name(project.path_with_namespace), **event})

        risk_status = _quality_status(100 - release_risk_score)
        project_status_rows.append(
            {
                "project": _project_name(project.path_with_namespace),
                "status": risk_status,
                "label": f"{_status_code(risk_status)} {_risk_label(risk_level)}",
                "reason": regression_events[0]["reason"] if regression_events else "Keine kritischen Signale",
            }
        )

        project_rows.append(
            {
                "project_id": project.id,
                "project": _project_name(project.path_with_namespace),
                "path_with_namespace": project.path_with_namespace,
                "release_risk": {
                    "score": release_risk_score,
                    "level": risk_level,
                    "label": f"{_status_code(risk_level)} {_risk_label(risk_level)}",
                },
                "delivery_confidence_pct": delivery_confidence,
                "quality_trend": weekly_trend,
                "build_stability_pct": build_stability,
                "test_success_rate_pct": test_success_rate,
                "security_score_pct": security_status,
                "release_readiness_pct": readiness_score,
                "regressions": regression_events,
                "mttr_hours": None if mttr_hours is None else round(mttr_hours, 1),
                "flakiness_score_pct": flakiness_score,
            }
        )

        merge_requests = merge_requests_by_project.get(project.id, [])
        for pipeline in recent[:8]:
            summary = _merged_report_summary(reports_by_pipeline.get(pipeline.id, []))
            mr = _find_best_merge_request(pipeline=pipeline, merge_requests=merge_requests)
            category = _categorize_merge_request(mr) if mr else _fallback_category(pipeline, summary)

            pipeline_risk = "high"
            if (pipeline.status or "").lower() in SUCCESS_STATUSES and int(summary["critical_findings"]) == 0:
                pipeline_risk = "low" if int(summary["tests_failed"]) == 0 else "medium"

            happened_at = _pipeline_time(pipeline)
            module = (
                project.path_with_namespace.split("/")[-2]
                if "/" in project.path_with_namespace
                else project.path_with_namespace
            )

            release_notes_feed.append(
                {
                    "version": f"p-{pipeline.gitlab_pipeline_id}",
                    "target_branch": pipeline.ref or "unknown",
                    "date": happened_at.date().isoformat(),
                    "project": _project_name(project.path_with_namespace),
                    "category": category,
                    "category_label": _category_label(category),
                    "status": pipeline.status,
                    "impact": {
                        "module": module,
                        "audience": "delivery",
                        "process": "release",
                    },
                    "risk": {
                        "level": pipeline_risk,
                        "label": f"{_status_code(pipeline_risk)} {_risk_label(pipeline_risk)}",
                        "reason": (
                            "Security Findings vorhanden"
                            if int(summary["critical_findings"]) > 0
                            else "Testfehler erkannt"
                            if int(summary["tests_failed"]) > 0
                            else "Pipeline stabil"
                        ),
                    },
                    "source": {
                        "type": "merge_request" if mr else "pipeline",
                        "title": mr.title if mr else None,
                        "labels": mr.labels if mr else [],
                        "web_url": mr.web_url if mr else None,
                    },
                    "why_relevant": (
                        f"MR: {mr.title}" if mr and mr.title else "Direkter Einfluss auf Release-Stabilitaet und Lieferfaehigkeit."
                    ),
                    "known_issues": [
                        issue
                        for issue in [
                            "Offene Testfehler" if int(summary["tests_failed"]) > 0 else None,
                            "Security Finding offen" if int(summary["critical_findings"]) > 0 else None,
                        ]
                        if issue is not None
                    ],
                    "approval": {"business_signoff": "pending", "status": "open"},
                }
            )

    project_rows.sort(key=lambda row: row["release_risk"]["score"], reverse=True)
    project_status_rows.sort(key=lambda row: {"red": 0, "yellow": 1, "green": 2}.get(row["status"], 3))

    portfolio_trend: list[dict[str, Any]] = []
    for idx in range(weeks):
        week_values = [row["quality_trend"][idx]["score"] for row in project_rows if len(row["quality_trend"]) > idx]
        if not week_values:
            continue
        avg_score = _safe_score(sum(week_values) / len(week_values))
        previous = portfolio_trend[-1]["score"] if portfolio_trend else None
        if avg_score < 60:
            label = "RED Kritisch"
        elif previous is not None and avg_score <= previous - 10:
            label = "YELLOW Sinkend"
        else:
            label = "GREEN Stabil"
        portfolio_trend.append(
            {
                "week": project_rows[0]["quality_trend"][idx]["week"] if project_rows else f"KW-{idx}",
                "score": avg_score,
                "label": label,
            }
        )

    team_rows: list[dict[str, Any]] = []
    by_team: dict[str, list[int]] = defaultdict(list)
    for mapping in team_project_mappings:
        by_team[mapping.team_name].append(mapping.project_id)

    for team_name in team_names:
        mapped_ids = set(by_team.get(team_name, []))
        team_projects = [row for row in project_rows if row["project_id"] in mapped_ids]

        if not team_projects:
            team_rows.append(
                {
                    "team": team_name,
                    "stability": "yellow",
                    "label": "YELLOW Keine Projektzuordnung",
                    "project_count": 0,
                }
            )
            continue

        avg_readiness = _safe_score(sum(float(row["release_readiness_pct"]) for row in team_projects) / len(team_projects))
        stability = _quality_status(avg_readiness)
        label = "Stabil" if stability == "green" else "Achtung" if stability == "yellow" else "Kritisch"
        team_rows.append(
            {
                "team": team_name,
                "stability": stability,
                "label": f"{_status_code(stability)} {label}",
                "project_count": len(team_projects),
                "avg_readiness_pct": avg_readiness,
            }
        )

    all_recent_pipelines = sorted(pipelines, key=_pipeline_time, reverse=True)
    merge_impact_events: list[dict[str, Any]] = []
    by_project: dict[int, list[RadarPipeline]] = defaultdict(list)
    for pipeline in all_recent_pipelines:
        by_project[pipeline.project_id].append(pipeline)

    for project_id, rows in by_project.items():
        merge_candidates = [
            p
            for p in rows
            if (p.source_type or "") in {"merge_request_event", "push", "web", "api"}
            and (p.ref or "")
            and ((p.ref or "").startswith("release/") or (p.ref or "") == "main")
        ]
        if not merge_candidates:
            continue

        latest_merge = merge_candidates[0]
        current_project_rows = [row for row in project_rows if row["project_id"] == project_id]
        if not current_project_rows:
            continue

        after = float(current_project_rows[0]["release_readiness_pct"])
        without_latest = [p for p in rows if p.id != latest_merge.id][:40]
        before = _safe_score(
            (0.40 * _build_stability(without_latest))
            + (0.35 * _test_success_rate(without_latest, reports_by_pipeline))
            + (0.25 * _security_score(without_latest, reports_by_pipeline))
        )
        delta = round(after - before, 1)
        merge_impact_events.append(
            {
                "project_id": project_id,
                "project": _project_name(projects_by_id.get(project_id).path_with_namespace)
                if projects_by_id.get(project_id)
                else f"Project {project_id}",
                "target_branch": latest_merge.ref,
                "merge_pipeline_id": latest_merge.gitlab_pipeline_id,
                "release_readiness_before": before,
                "release_readiness_after": after,
                "delta": delta,
                "impact": "improved" if delta >= 3 else "degraded" if delta <= -3 else "neutral",
            }
        )

    merge_impact_events = sorted(merge_impact_events, key=lambda row: abs(float(row["delta"])), reverse=True)[:20]

    release_notes_feed = sorted(release_notes_feed, key=lambda row: row["date"], reverse=True)[:60]
    head = release_notes_feed[:20]
    prev = release_notes_feed[20:40]
    head_counter = Counter(item["category"] for item in head)
    prev_counter = Counter(item["category"] for item in prev)

    high_risk_projects = [row for row in project_rows if row["release_risk"]["level"] == "high"]
    executive_notifications: list[dict[str, Any]] = []
    for regression in all_regressions:
        if regression["severity"] == "high":
            executive_notifications.append(
                {
                    "severity": "high",
                    "title": f"Regression in {regression['project']}",
                    "message": regression["reason"],
                }
            )
    for row in high_risk_projects[:10]:
        executive_notifications.append(
            {
                "severity": "high",
                "title": f"Release-Risiko hoch: {row['project']}",
                "message": "Release Risk ist rot. Stabilitaet/Test/Security pruefen.",
            }
        )

    sprint_window_start = (now - timedelta(days=14)).date().isoformat()
    sprint_window_end = now.date().isoformat()
    sprint_build = _build_stability([p for p in pipelines if _pipeline_time(p) >= (now - timedelta(days=14))])
    sprint_risk = _risk_level(_safe_score(100 - sprint_build))

    return {
        "generated_at": now.isoformat(),
        "summary": {
            "project_count": len(project_rows),
            "high_risk_projects": len(high_risk_projects),
            "regression_events": len(all_regressions),
            "delivery_confidence_avg_pct": _safe_score(
                sum(float(row["delivery_confidence_pct"]) for row in project_rows) / max(1, len(project_rows))
            ),
            "release_readiness_avg_pct": _safe_score(
                sum(float(row["release_readiness_pct"]) for row in project_rows) / max(1, len(project_rows))
            ),
        },
        "release_risk": {
            "distribution": {
                "low": sum(1 for row in project_rows if row["release_risk"]["level"] == "low"),
                "medium": sum(1 for row in project_rows if row["release_risk"]["level"] == "medium"),
                "high": sum(1 for row in project_rows if row["release_risk"]["level"] == "high"),
            },
            "projects": [
                {
                    "project_id": row["project_id"],
                    "project": row["project"],
                    **row["release_risk"],
                }
                for row in project_rows
            ],
        },
        "delivery_confidence": [
            {
                "project_id": row["project_id"],
                "project": row["project"],
                "value_pct": row["delivery_confidence_pct"],
                "mttr_hours": row["mttr_hours"],
                "flakiness_score_pct": row["flakiness_score_pct"],
            }
            for row in project_rows
        ],
        "quality_trend": portfolio_trend,
        "regressions": all_regressions,
        "build_stability": [
            {"project_id": row["project_id"], "project": row["project"], "value_pct": row["build_stability_pct"]}
            for row in project_rows
        ],
        "release_readiness": [
            {
                "project_id": row["project_id"],
                "project": row["project"],
                "value_pct": row["release_readiness_pct"],
            }
            for row in project_rows
        ],
        "team_quality_indicator": team_rows,
        "sprint_quality_summary": {
            "window_start": sprint_window_start,
            "window_end": sprint_window_end,
            "build_stability_pct": sprint_build,
            "regression_events": len(all_regressions),
            "quality_trend": portfolio_trend,
            "release_risk": {"level": sprint_risk, "label": f"{_status_code(sprint_risk)} {_risk_label(sprint_risk)}"},
        },
        "executive_notifications": executive_notifications,
        "project_status": project_status_rows,
        "merge_impact_events": merge_impact_events,
        "release_notes": {
            "feed": release_notes_feed,
            "comparison": {
                "new_features": head_counter.get("feature", 0) - prev_counter.get("feature", 0),
                "bugfixes": head_counter.get("bugfix", 0) - prev_counter.get("bugfix", 0),
                "security_fixes": head_counter.get("security", 0) - prev_counter.get("security", 0),
                "known_risks": sum(1 for item in head if item["risk"]["level"] == "high"),
            },
        },
        "projects": project_rows,
    }
