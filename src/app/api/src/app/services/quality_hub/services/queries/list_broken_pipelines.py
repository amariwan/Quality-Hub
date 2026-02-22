from __future__ import annotations

from app.services.quality_hub.application.pipeline_readiness import evaluate_deployability
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository


def _normalize_workspace_path(raw: str | None) -> str | None:
    if raw is None:
        return None
    normalized = raw.strip().strip("/").casefold()
    return normalized or None


def _project_belongs_to_workspace(
    project_path_with_namespace: str | None,
    workspace_path: str | None,
) -> bool:
    if workspace_path is None:
        return True
    if not project_path_with_namespace:
        return False

    normalized_project_path = project_path_with_namespace.strip().strip("/").casefold()
    return normalized_project_path == workspace_path or normalized_project_path.startswith(f"{workspace_path}/")


async def list_broken_pipelines(
    repository: QualityHubRepository,
    scope: str = "all",
    workspace_group_path: str | None = None,
) -> list[dict]:
    rows = await repository.list_pipelines()
    projects = await repository.list_projects()

    normalized_workspace_path = _normalize_workspace_path(workspace_group_path)
    if normalized_workspace_path is None:
        allowed_project_ids = {project.id for project in projects}
    else:
        allowed_project_ids = {
            project.id
            for project in projects
            if _project_belongs_to_workspace(project.path_with_namespace, normalized_workspace_path)
        }

    data: list[dict] = []
    for row in rows:
        if row.project_id not in allowed_project_ids:
            continue
        reports = await repository.list_reports_for_pipeline(row.id)
        readiness = evaluate_deployability(
            pipeline_status=row.status,
            report_summaries=[report.summary_json for report in reports],
        )
        if scope == "readiness":
            if not (
                (row.ref and row.ref.startswith("release/")) or row.source_type in {"push", "merge_request_event", "schedule"}
            ):
                continue
        if readiness["deployability_state"] == "deployable":
            continue
        data.append(
            {
                "id": row.id,
                "project_id": row.project_id,
                "gitlab_pipeline_id": row.gitlab_pipeline_id,
                "status": row.status,
                "ref": row.ref,
                "sha": row.sha,
                "source_type": row.source_type,
                **readiness,
            }
        )
    return data
