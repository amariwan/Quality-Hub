from __future__ import annotations

from datetime import datetime

import httpx

from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import list_project_merge_requests
from app.services.quality_hub.application.management_risk_radar import (
    RadarMergeRequest,
    RadarPipeline,
    RadarProject,
    RadarReport,
    RadarTeamProjectMapping,
    build_management_risk_radar,
)
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository


def _parse_iso_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


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


async def get_management_risk_radar(
    repository: QualityHubRepository,
    *,
    user_id: int,
    weeks: int = 3,
    workspace_group_path: str | None = None,
) -> dict:
    projects = list(await repository.list_projects())
    pipelines = list(await repository.list_pipelines())
    reports = list(await repository.list_reports())
    teams = list(await repository.list_teams())
    team_project_rows = list(await repository.list_team_project_mappings())

    normalized_workspace_path = _normalize_workspace_path(workspace_group_path)
    if normalized_workspace_path is not None:
        projects = [
            project
            for project in projects
            if _project_belongs_to_workspace(
                project.path_with_namespace,
                normalized_workspace_path,
            )
        ]

    project_ids = {project.id for project in projects}
    pipelines = [pipeline for pipeline in pipelines if pipeline.project_id in project_ids]
    pipeline_ids = {pipeline.id for pipeline in pipelines}
    reports = [report for report in reports if report.pipeline_id in pipeline_ids]
    team_project_rows = [row for row in team_project_rows if row.project_id in project_ids]
    team_ids = {row.team_id for row in team_project_rows}
    teams = [team for team in teams if team.id in team_ids]
    team_by_id = {team.id: team for team in teams}

    merge_requests_by_project: dict[int, list[RadarMergeRequest]] = {}
    credential = await repository.get_gitlab_credential(user_id)
    if credential is not None:
        token = TokenCipher().decrypt(credential.token_encrypted)
        for project in projects:
            try:
                merge_requests = await list_project_merge_requests(
                    token=token,
                    base_url=credential.base_url,
                    project_id=project.gitlab_project_id,
                    state="merged",
                    limit=120,
                )
            except httpx.HTTPError:
                continue

            merge_requests_by_project[project.id] = [
                RadarMergeRequest(
                    project_id=project.id,
                    iid=item.get("iid"),
                    title=item.get("title") or "",
                    labels=[label for label in item.get("labels", []) if isinstance(label, str)],
                    target_branch=item.get("target_branch"),
                    merged_at=_parse_iso_datetime(item.get("merged_at")),
                    merge_commit_sha=item.get("merge_commit_sha"),
                    web_url=item.get("web_url"),
                )
                for item in merge_requests
                if isinstance(item, dict)
            ]

    return build_management_risk_radar(
        projects=[
            RadarProject(
                id=project.id,
                path_with_namespace=project.path_with_namespace,
            )
            for project in projects
        ],
        pipelines=[
            RadarPipeline(
                id=pipeline.id,
                project_id=pipeline.project_id,
                gitlab_pipeline_id=pipeline.gitlab_pipeline_id,
                status=pipeline.status,
                ref=pipeline.ref,
                sha=pipeline.sha,
                source_type=pipeline.source_type,
                started_at=pipeline.started_at,
                finished_at=pipeline.finished_at,
                duration=pipeline.duration,
            )
            for pipeline in pipelines
        ],
        reports=[
            RadarReport(
                pipeline_id=report.pipeline_id,
                report_type=report.type,
                summary_json=report.summary_json,
            )
            for report in reports
        ],
        team_names=[team.name for team in teams],
        team_project_mappings=[
            RadarTeamProjectMapping(
                team_name=team_by_id[row.team_id].name,
                project_id=row.project_id,
            )
            for row in team_project_rows
            if row.team_id in team_by_id
        ],
        merge_requests_by_project=merge_requests_by_project,
        weeks=max(2, min(12, weeks)),
    )
