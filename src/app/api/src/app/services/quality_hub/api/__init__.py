from __future__ import annotations

from fastapi import APIRouter

from app.services.quality_hub.api.auth_token import router as auth_token_router
from app.services.quality_hub.api.clusters import router as clusters_router
from app.services.quality_hub.api.deployments_status import router as deployments_status_router
from app.services.quality_hub.api.gitlab_groups import router as gitlab_groups_router
from app.services.quality_hub.api.gitlab_issues import router as gitlab_issues_router
from app.services.quality_hub.api.gitlab_projects import router as gitlab_projects_router
from app.services.quality_hub.api.health import router as health_router
from app.services.quality_hub.api.monitored_groups import router as monitored_groups_router
from app.services.quality_hub.api.ops_center import router as ops_center_router
from app.services.quality_hub.api.pipelines import router as pipelines_router
from app.services.quality_hub.api.project_mappings import router as project_mappings_router
from app.services.quality_hub.api.projects import router as projects_router
from app.services.quality_hub.api.projects_sync import router as projects_sync_router
from app.services.quality_hub.api.reports_upload import router as reports_upload_router
from app.services.quality_hub.api.risk_radar import router as risk_radar_router
from app.services.quality_hub.api.settings import router as settings_router
from app.services.quality_hub.api.team_members import router as team_members_router
from app.services.quality_hub.api.team_project_mappings import router as team_project_mappings_router
from app.services.quality_hub.api.teams import router as teams_router
from app.services.quality_hub.api.workspace_notes import router as workspace_notes_router
from app.services.quality_hub.api.workspace_tags import router as workspace_tags_router
from app.services.quality_hub.api.workspace_views import router as workspace_views_router
from app.services.quality_hub.api.workspace_watchlist import router as workspace_watchlist_router
from app.services.quality_hub.api.ws import router as ws_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_token_router)
router.include_router(gitlab_groups_router)
router.include_router(gitlab_issues_router)
router.include_router(gitlab_projects_router)
router.include_router(monitored_groups_router)
router.include_router(ops_center_router)
router.include_router(projects_router)
router.include_router(projects_sync_router)
router.include_router(pipelines_router)
router.include_router(risk_radar_router)
router.include_router(reports_upload_router)
router.include_router(deployments_status_router)
router.include_router(clusters_router)
router.include_router(project_mappings_router)
router.include_router(workspace_views_router)
router.include_router(workspace_notes_router)
router.include_router(workspace_watchlist_router)
router.include_router(workspace_tags_router)
router.include_router(teams_router)
router.include_router(team_project_mappings_router)
router.include_router(team_members_router)
router.include_router(settings_router)
router.include_router(ws_router)
