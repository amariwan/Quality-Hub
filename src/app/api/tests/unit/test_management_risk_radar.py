from datetime import UTC, datetime, timedelta

from app.services.quality_hub.application.management_risk_radar import (
    RadarMergeRequest,
    RadarPipeline,
    RadarProject,
    RadarReport,
    RadarTeamProjectMapping,
    build_management_risk_radar,
)


def _dt(days_ago: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days_ago)


def test_management_risk_radar_computes_core_sections():
    projects = [
        RadarProject(id=1, path_with_namespace="org/backend"),
        RadarProject(id=2, path_with_namespace="org/frontend"),
    ]

    pipelines = [
        RadarPipeline(
            id=1,
            project_id=1,
            gitlab_pipeline_id=1001,
            status="success",
            ref="main",
            sha="abc1001",
            source_type="push",
            started_at=_dt(8),
            finished_at=_dt(8),
            duration=250,
        ),
        RadarPipeline(
            id=2,
            project_id=1,
            gitlab_pipeline_id=1002,
            status="failed",
            ref="release/1.2",
            sha="abc1002",
            source_type="merge_request_event",
            started_at=_dt(1),
            finished_at=_dt(1),
            duration=300,
        ),
        RadarPipeline(
            id=3,
            project_id=2,
            gitlab_pipeline_id=2001,
            status="success",
            ref="main",
            sha="def2001",
            source_type="push",
            started_at=_dt(2),
            finished_at=_dt(2),
            duration=220,
        ),
    ]

    reports = [
        RadarReport(
            pipeline_id=1,
            report_type="junit",
            summary_json={"tests_total": 100, "tests_failed": 0},
        ),
        RadarReport(
            pipeline_id=2,
            report_type="junit",
            summary_json={"tests_total": 100, "tests_failed": 30},
        ),
        RadarReport(
            pipeline_id=2,
            report_type="sarif",
            summary_json={"critical_findings": 2},
        ),
        RadarReport(
            pipeline_id=3,
            report_type="junit",
            summary_json={"tests_total": 80, "tests_failed": 1},
        ),
    ]

    payload = build_management_risk_radar(
        projects=projects,
        pipelines=pipelines,
        reports=reports,
        team_names=["backend", "frontend"],
        team_project_mappings=[
            RadarTeamProjectMapping(team_name="backend", project_id=1),
            RadarTeamProjectMapping(team_name="frontend", project_id=2),
        ],
        merge_requests_by_project={
            1: [
                RadarMergeRequest(
                    project_id=1,
                    iid=11,
                    title="fix: checkout reliability",
                    labels=["bugfix"],
                    target_branch="release/1.2",
                    merged_at=_dt(1),
                    merge_commit_sha="abc1002",
                    web_url=None,
                )
            ]
        },
        weeks=3,
    )

    assert payload["summary"]["project_count"] == 2
    assert "release_risk" in payload
    assert "delivery_confidence" in payload
    assert "quality_trend" in payload
    assert "regressions" in payload
    assert "release_readiness" in payload
    assert "team_quality_indicator" in payload
    assert "sprint_quality_summary" in payload
    assert "executive_notifications" in payload
    assert "project_status" in payload
    assert "merge_impact_events" in payload
    assert "release_notes" in payload

    assert len(payload["release_notes"]["feed"]) > 0
    assert any(item["project"] == "backend" for item in payload["release_risk"]["projects"])
    assert payload["release_notes"]["feed"][0]["source"]["type"] in {"merge_request", "pipeline"}
