from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from app.services.quality_hub.application.ops_center import (
    build_ownership_heatmap,
    compute_dora_metrics,
    simulate_risk_decisions,
)


def _dt(days_ago: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days_ago)


def test_compute_dora_metrics_returns_expected_shape_and_counts():
    pipelines = [
        SimpleNamespace(
            id=1,
            project_id=101,
            status="success",
            ref="main",
            source_type="push",
            duration=1200,
            started_at=_dt(10),
            finished_at=_dt(10),
        ),
        SimpleNamespace(
            id=2,
            project_id=101,
            status="failed",
            ref="release/1.0",
            source_type="merge_request_event",
            duration=900,
            started_at=_dt(9),
            finished_at=_dt(9),
        ),
        SimpleNamespace(
            id=3,
            project_id=101,
            status="success",
            ref="release/1.0",
            source_type="merge_request_event",
            duration=1500,
            started_at=_dt(8),
            finished_at=_dt(8),
        ),
    ]

    payload = compute_dora_metrics(pipelines, days=30)

    assert payload["window_days"] == 30
    assert payload["sample_size"] == 3
    assert payload["deployment_frequency"]["deployments"] == 2
    assert payload["change_failure_rate"]["pct"] > 0
    assert payload["overall_classification"] in {"elite", "high", "medium", "low"}


def test_build_ownership_heatmap_marks_unowned_and_overloaded_teams():
    projects = [
        SimpleNamespace(id=1, path_with_namespace="org/backend"),
        SimpleNamespace(id=2, path_with_namespace="org/frontend"),
        SimpleNamespace(id=3, path_with_namespace="org/mobile"),
    ]
    teams = [
        SimpleNamespace(id=10, name="Platform"),
        SimpleNamespace(id=20, name="Product"),
    ]
    mappings = [
        SimpleNamespace(team_id=10, project_id=1),
        SimpleNamespace(team_id=10, project_id=2),
    ]

    payload = build_ownership_heatmap(
        projects=projects,
        teams=teams,
        team_project_mappings=mappings,
        capacity_threshold=1,
    )

    assert payload["summary"]["projects_total"] == 3
    assert payload["summary"]["unowned_projects"] == 1
    assert payload["summary"]["overloaded_teams"] == 1
    assert any(team["status"] == "overloaded" for team in payload["teams"])


def test_simulate_risk_decisions_blocks_expected_projects():
    projects = [
        {
            "project_id": 1,
            "project": "backend",
            "release_risk": {"score": 80},
            "release_readiness_pct": 82,
            "delivery_confidence_pct": 78,
        },
        {
            "project_id": 2,
            "project": "frontend",
            "release_risk": {"score": 45},
            "release_readiness_pct": 90,
            "delivery_confidence_pct": 88,
        },
        {
            "project_id": 3,
            "project": "mobile",
            "release_risk": {"score": 20},
            "release_readiness_pct": 92,
            "delivery_confidence_pct": 91,
        },
    ]

    payload = simulate_risk_decisions(
        projects=projects,
        incident_count_by_project={1: 0, 2: 2, 3: 0},
        release_risk_high_above=60,
        release_risk_medium_above=40,
        release_readiness_min_pct=75,
        delivery_confidence_min_pct=70,
        block_on_open_incidents=True,
    )

    assert payload["summary"]["projects_total"] == 3
    assert payload["summary"]["blocked"] == 2
    assert payload["summary"]["pass"] == 1
    first = payload["decisions"][0]
    assert first["status"] == "blocked"
