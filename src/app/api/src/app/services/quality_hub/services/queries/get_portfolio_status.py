from __future__ import annotations

from app.services.quality_hub.application.deployment_status import summarize_portfolio_status
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


async def get_portfolio_status(
    repository: QualityHubRepository,
    show_clusters: bool = False,
    workspace_group_path: str | None = None,
) -> list[dict]:
    deployments = await repository.list_deployments()
    projects = await repository.list_projects()

    normalized_workspace_path = _normalize_workspace_path(workspace_group_path)
    project_by_id = {project.id: project for project in projects}
    if normalized_workspace_path is None:
        allowed_project_ids = set(project_by_id.keys())
    else:
        allowed_project_ids = {
            project.id
            for project in projects
            if _project_belongs_to_workspace(
                project.path_with_namespace,
                normalized_workspace_path,
            )
        }

    payload = [
        {
            "project_id": row.project_id,
            "cluster_id": row.cluster_id,
            "env": row.env,
            "status": row.status,
            "project": project_by_id.get(row.project_id).path_with_namespace
            if row.project_id in project_by_id
            else str(row.project_id),
            "cluster": str(row.cluster_id),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
        for row in deployments
        if row.project_id in allowed_project_ids
    ]
    return summarize_portfolio_status(payload, show_clusters=show_clusters)
