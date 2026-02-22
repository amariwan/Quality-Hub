from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.quality_hub.infrastructure.models import (
    ClusterModel,
    DeploymentModel,
    GitlabCredentialModel,
    MonitoredGroupModel,
    NoteModel,
    PipelineModel,
    ProjectMappingModel,
    ProjectModel,
    ReportModel,
    SyncRunModel,
    TagLinkModel,
    TagModel,
    TeamMemberModel,
    TeamModel,
    UserModel,
    WatchLeaseModel,
    WorkspaceViewModel,
    WorkspaceWatchlistModel,
)


class QualityHubRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert_user(self, *, email: str, name: str | None, auth_provider_id: str | None = None) -> UserModel:
        stmt = select(UserModel).where(UserModel.email == email)
        user = (await self.session.execute(stmt)).scalar_one_or_none()
        if user:
            user.name = name
            if auth_provider_id:
                user.auth_provider_id = auth_provider_id
        else:
            user = UserModel(email=email, name=name, auth_provider_id=auth_provider_id)
            self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_user(self, user_id: int) -> UserModel | None:
        return await self.session.get(UserModel, user_id)

    async def upsert_gitlab_credential(
        self,
        *,
        user_id: int,
        gitlab_user_id: int,
        base_url: str,
        token_encrypted: str,
    ) -> GitlabCredentialModel:
        stmt = select(GitlabCredentialModel).where(GitlabCredentialModel.user_id == user_id)
        credential = (await self.session.execute(stmt)).scalar_one_or_none()
        if credential:
            credential.gitlab_user_id = gitlab_user_id
            credential.base_url = base_url
            credential.token_encrypted = token_encrypted
            credential.updated_at = datetime.utcnow()
        else:
            credential = GitlabCredentialModel(
                user_id=user_id,
                gitlab_user_id=gitlab_user_id,
                base_url=base_url,
                token_encrypted=token_encrypted,
            )
            self.session.add(credential)
        await self.session.commit()
        await self.session.refresh(credential)
        return credential

    async def get_gitlab_credential(self, user_id: int) -> GitlabCredentialModel | None:
        stmt = select(GitlabCredentialModel).where(GitlabCredentialModel.user_id == user_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def delete_gitlab_credential(self, user_id: int) -> None:
        await self.session.execute(delete(GitlabCredentialModel).where(GitlabCredentialModel.user_id == user_id))
        await self.session.commit()

    async def create_sync_run(self, user_id: int) -> SyncRunModel:
        run = SyncRunModel(user_id=user_id, status="queued")
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def update_sync_run(self, run_id: int, status: str, message: str | None = None) -> None:
        await self.session.execute(
            update(SyncRunModel)
            .where(SyncRunModel.id == run_id)
            .values(status=status, message=message, updated_at=datetime.utcnow())
        )
        await self.session.commit()

    async def get_sync_run(self, run_id: int, user_id: int) -> SyncRunModel | None:
        stmt = select(SyncRunModel).where(and_(SyncRunModel.id == run_id, SyncRunModel.user_id == user_id))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_monitored_groups(self, user_id: int) -> Sequence[MonitoredGroupModel]:
        stmt = select(MonitoredGroupModel).where(MonitoredGroupModel.user_id == user_id).order_by(MonitoredGroupModel.gitlab_group_path)
        return (await self.session.execute(stmt)).scalars().all()

    async def get_monitored_group(self, monitored_group_id: int, user_id: int) -> MonitoredGroupModel | None:
        stmt = select(MonitoredGroupModel).where(
            and_(MonitoredGroupModel.id == monitored_group_id, MonitoredGroupModel.user_id == user_id)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create_monitored_group(self, user_id: int, gitlab_group_id: int, gitlab_group_path: str) -> MonitoredGroupModel:
        model = MonitoredGroupModel(
            user_id=user_id,
            gitlab_group_id=gitlab_group_id,
            gitlab_group_path=gitlab_group_path,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return model

    async def update_monitored_group(
        self,
        monitored_group_id: int,
        user_id: int,
        gitlab_group_id: int,
        gitlab_group_path: str,
    ) -> MonitoredGroupModel | None:
        model = await self.get_monitored_group(monitored_group_id, user_id)
        if model is None:
            return None
        model.gitlab_group_id = gitlab_group_id
        model.gitlab_group_path = gitlab_group_path
        await self.session.commit()
        await self.session.refresh(model)
        return model

    async def delete_monitored_group(self, monitored_group_id: int, user_id: int) -> bool:
        result = await self.session.execute(
            delete(MonitoredGroupModel).where(
                and_(MonitoredGroupModel.id == monitored_group_id, MonitoredGroupModel.user_id == user_id)
            )
        )
        await self.session.commit()
        return result.rowcount > 0

    async def upsert_project(self, gitlab_project_id: int, path_with_namespace: str, default_branch: str | None) -> ProjectModel:
        stmt = select(ProjectModel).where(ProjectModel.gitlab_project_id == gitlab_project_id)
        project = (await self.session.execute(stmt)).scalar_one_or_none()
        if project:
            project.path_with_namespace = path_with_namespace
            project.default_branch = default_branch
            project.updated_at = datetime.utcnow()
        else:
            project = ProjectModel(
                gitlab_project_id=gitlab_project_id,
                path_with_namespace=path_with_namespace,
                default_branch=default_branch,
            )
            self.session.add(project)
        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def get_project_by_gitlab_id(self, gitlab_project_id: int) -> ProjectModel | None:
        stmt = select(ProjectModel).where(ProjectModel.gitlab_project_id == gitlab_project_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_project(self, project_id: int) -> ProjectModel | None:
        return await self.session.get(ProjectModel, project_id)

    async def list_projects(self) -> Sequence[ProjectModel]:
        stmt = select(ProjectModel).order_by(ProjectModel.path_with_namespace)
        return (await self.session.execute(stmt)).scalars().all()

    async def upsert_pipeline(
        self,
        *,
        project_id: int,
        gitlab_pipeline_id: int,
        ref: str | None,
        sha: str | None,
        status: str,
        started_at: datetime | None,
        finished_at: datetime | None,
        duration: float | None,
        source_type: str | None,
    ) -> PipelineModel:
        stmt = select(PipelineModel).where(
            and_(PipelineModel.project_id == project_id, PipelineModel.gitlab_pipeline_id == gitlab_pipeline_id)
        )
        pipeline = (await self.session.execute(stmt)).scalar_one_or_none()
        if pipeline:
            pipeline.ref = ref
            pipeline.sha = sha
            pipeline.status = status
            pipeline.started_at = started_at
            pipeline.finished_at = finished_at
            pipeline.duration = duration
            pipeline.source_type = source_type
        else:
            pipeline = PipelineModel(
                project_id=project_id,
                gitlab_pipeline_id=gitlab_pipeline_id,
                ref=ref,
                sha=sha,
                status=status,
                started_at=started_at,
                finished_at=finished_at,
                duration=duration,
                source_type=source_type,
            )
            self.session.add(pipeline)
        await self.session.commit()
        await self.session.refresh(pipeline)
        return pipeline

    async def list_pipelines(self, status: str | None = None) -> Sequence[PipelineModel]:
        stmt = select(PipelineModel).order_by(PipelineModel.id.desc())
        if status:
            stmt = stmt.where(PipelineModel.status == status)
        return (await self.session.execute(stmt)).scalars().all()

    async def create_report(self, pipeline_id: int, report_type: str, summary_json: dict, artifact_ref: str | None) -> ReportModel:
        report = ReportModel(pipeline_id=pipeline_id, type=report_type, summary_json=summary_json, artifact_ref=artifact_ref)
        self.session.add(report)
        await self.session.commit()
        await self.session.refresh(report)
        return report

    async def list_reports_for_pipeline(self, pipeline_id: int) -> Sequence[ReportModel]:
        stmt = select(ReportModel).where(ReportModel.pipeline_id == pipeline_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def upsert_deployment(self, key: dict, payload: dict) -> DeploymentModel:
        stmt = select(DeploymentModel).where(
            and_(
                DeploymentModel.project_id == key["project_id"],
                DeploymentModel.cluster_id == key["cluster_id"],
                DeploymentModel.env == key["env"],
                DeploymentModel.kind == key["kind"],
                DeploymentModel.resource_name == key["resource_name"],
                DeploymentModel.namespace == key["namespace"],
            )
        )
        deployment = (await self.session.execute(stmt)).scalar_one_or_none()
        if deployment:
            for field, value in payload.items():
                setattr(deployment, field, value)
            deployment.updated_at = datetime.utcnow()
        else:
            deployment = DeploymentModel(**key, **payload)
            self.session.add(deployment)
        await self.session.commit()
        await self.session.refresh(deployment)
        return deployment

    async def list_deployments(self, project_id: int | None = None) -> Sequence[DeploymentModel]:
        stmt = select(DeploymentModel)
        if project_id is not None:
            stmt = stmt.where(DeploymentModel.project_id == project_id)
        stmt = stmt.order_by(DeploymentModel.updated_at.desc())
        return (await self.session.execute(stmt)).scalars().all()

    async def create_cluster(self, **kwargs) -> ClusterModel:
        cluster = ClusterModel(**kwargs)
        self.session.add(cluster)
        await self.session.commit()
        await self.session.refresh(cluster)
        return cluster

    async def list_clusters(self) -> Sequence[ClusterModel]:
        return (await self.session.execute(select(ClusterModel).order_by(ClusterModel.name))).scalars().all()

    async def get_cluster(self, cluster_id: int) -> ClusterModel | None:
        return await self.session.get(ClusterModel, cluster_id)

    async def update_cluster(self, cluster_id: int, payload: dict) -> ClusterModel | None:
        cluster = await self.get_cluster(cluster_id)
        if cluster is None:
            return None
        for field, value in payload.items():
            setattr(cluster, field, value)
        await self.session.commit()
        await self.session.refresh(cluster)
        return cluster

    async def delete_cluster(self, cluster_id: int) -> bool:
        result = await self.session.execute(delete(ClusterModel).where(ClusterModel.id == cluster_id))
        await self.session.commit()
        return result.rowcount > 0

    async def create_project_mapping(self, **kwargs) -> ProjectMappingModel:
        item = ProjectMappingModel(**kwargs)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list_project_mappings(self) -> Sequence[ProjectMappingModel]:
        stmt = select(ProjectMappingModel).order_by(ProjectMappingModel.id.desc())
        return (await self.session.execute(stmt)).scalars().all()

    async def get_project_mapping(self, mapping_id: int) -> ProjectMappingModel | None:
        return await self.session.get(ProjectMappingModel, mapping_id)

    async def update_project_mapping(self, mapping_id: int, payload: dict) -> ProjectMappingModel | None:
        item = await self.get_project_mapping(mapping_id)
        if item is None:
            return None
        for field, value in payload.items():
            setattr(item, field, value)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete_project_mapping(self, mapping_id: int) -> bool:
        result = await self.session.execute(delete(ProjectMappingModel).where(ProjectMappingModel.id == mapping_id))
        await self.session.commit()
        return result.rowcount > 0

    async def create_workspace_view(self, **kwargs) -> WorkspaceViewModel:
        item = WorkspaceViewModel(**kwargs)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list_workspace_views(self, owner_user_id: int) -> Sequence[WorkspaceViewModel]:
        stmt = select(WorkspaceViewModel).where(WorkspaceViewModel.owner_user_id == owner_user_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def get_workspace_view(self, item_id: int, owner_user_id: int) -> WorkspaceViewModel | None:
        stmt = select(WorkspaceViewModel).where(
            and_(WorkspaceViewModel.id == item_id, WorkspaceViewModel.owner_user_id == owner_user_id)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def update_workspace_view(self, item_id: int, owner_user_id: int, payload: dict) -> WorkspaceViewModel | None:
        item = await self.get_workspace_view(item_id, owner_user_id)
        if item is None:
            return None
        for field, value in payload.items():
            setattr(item, field, value)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete_workspace_view(self, item_id: int, owner_user_id: int) -> bool:
        result = await self.session.execute(
            delete(WorkspaceViewModel).where(
                and_(WorkspaceViewModel.id == item_id, WorkspaceViewModel.owner_user_id == owner_user_id)
            )
        )
        await self.session.commit()
        return result.rowcount > 0

    async def create_note(self, **kwargs) -> NoteModel:
        item = NoteModel(**kwargs)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list_notes(self, owner_user_id: int) -> Sequence[NoteModel]:
        stmt = select(NoteModel).where(NoteModel.owner_user_id == owner_user_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def get_note(self, item_id: int, owner_user_id: int) -> NoteModel | None:
        stmt = select(NoteModel).where(and_(NoteModel.id == item_id, NoteModel.owner_user_id == owner_user_id))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def update_note(self, item_id: int, owner_user_id: int, payload: dict) -> NoteModel | None:
        item = await self.get_note(item_id, owner_user_id)
        if item is None:
            return None
        for field, value in payload.items():
            setattr(item, field, value)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete_note(self, item_id: int, owner_user_id: int) -> bool:
        result = await self.session.execute(delete(NoteModel).where(and_(NoteModel.id == item_id, NoteModel.owner_user_id == owner_user_id)))
        await self.session.commit()
        return result.rowcount > 0

    async def create_watchlist_item(self, **kwargs) -> WorkspaceWatchlistModel:
        item = WorkspaceWatchlistModel(**kwargs)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list_watchlist_items(self, owner_user_id: int) -> Sequence[WorkspaceWatchlistModel]:
        stmt = select(WorkspaceWatchlistModel).where(WorkspaceWatchlistModel.owner_user_id == owner_user_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def get_watchlist_item(self, item_id: int, owner_user_id: int) -> WorkspaceWatchlistModel | None:
        stmt = select(WorkspaceWatchlistModel).where(
            and_(WorkspaceWatchlistModel.id == item_id, WorkspaceWatchlistModel.owner_user_id == owner_user_id)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_watchlist_item_by_project(
        self,
        owner_user_id: int,
        project_id: int,
    ) -> WorkspaceWatchlistModel | None:
        stmt = select(WorkspaceWatchlistModel).where(
            and_(
                WorkspaceWatchlistModel.owner_user_id == owner_user_id,
                WorkspaceWatchlistModel.project_id == project_id,
            )
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def update_watchlist_item(
        self,
        item_id: int,
        owner_user_id: int,
        payload: dict,
    ) -> WorkspaceWatchlistModel | None:
        item = await self.get_watchlist_item(item_id, owner_user_id)
        if item is None:
            return None
        for field, value in payload.items():
            setattr(item, field, value)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete_watchlist_item(self, item_id: int, owner_user_id: int) -> bool:
        result = await self.session.execute(
            delete(WorkspaceWatchlistModel).where(
                and_(WorkspaceWatchlistModel.id == item_id, WorkspaceWatchlistModel.owner_user_id == owner_user_id)
            )
        )
        await self.session.commit()
        return result.rowcount > 0

    async def create_tag(self, **kwargs) -> TagModel:
        item = TagModel(**kwargs)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list_tags(self, owner_user_id: int) -> Sequence[TagModel]:
        stmt = select(TagModel).where(TagModel.owner_user_id == owner_user_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def get_tag(self, tag_id: int, owner_user_id: int) -> TagModel | None:
        stmt = select(TagModel).where(and_(TagModel.id == tag_id, TagModel.owner_user_id == owner_user_id))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def update_tag(self, tag_id: int, owner_user_id: int, payload: dict) -> TagModel | None:
        tag = await self.get_tag(tag_id, owner_user_id)
        if tag is None:
            return None
        for field, value in payload.items():
            setattr(tag, field, value)
        await self.session.commit()
        await self.session.refresh(tag)
        return tag

    async def delete_tag(self, tag_id: int, owner_user_id: int) -> bool:
        result = await self.session.execute(delete(TagModel).where(and_(TagModel.id == tag_id, TagModel.owner_user_id == owner_user_id)))
        await self.session.commit()
        return result.rowcount > 0

    async def replace_tag_links(self, tag_id: int, links: list[dict]) -> None:
        await self.session.execute(delete(TagLinkModel).where(TagLinkModel.tag_id == tag_id))
        for link in links:
            self.session.add(TagLinkModel(tag_id=tag_id, **link))
        await self.session.commit()

    async def list_tag_links(self, tag_id: int) -> Sequence[TagLinkModel]:
        stmt = select(TagLinkModel).where(TagLinkModel.tag_id == tag_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def create_team(self, name: str) -> TeamModel:
        team = TeamModel(name=name)
        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)
        return team

    async def list_teams(self) -> Sequence[TeamModel]:
        return (await self.session.execute(select(TeamModel).order_by(TeamModel.name))).scalars().all()

    async def get_team(self, team_id: int) -> TeamModel | None:
        return await self.session.get(TeamModel, team_id)

    async def update_team(self, team_id: int, payload: dict) -> TeamModel | None:
        team = await self.get_team(team_id)
        if team is None:
            return None
        for field, value in payload.items():
            setattr(team, field, value)
        await self.session.commit()
        await self.session.refresh(team)
        return team

    async def delete_team(self, team_id: int) -> bool:
        result = await self.session.execute(delete(TeamModel).where(TeamModel.id == team_id))
        await self.session.commit()
        return result.rowcount > 0

    async def add_team_member(self, team_id: int, user_id: int, role: str) -> TeamMemberModel:
        member = TeamMemberModel(team_id=team_id, user_id=user_id, role=role)
        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def list_team_members(self, team_id: int) -> Sequence[TeamMemberModel]:
        stmt = select(TeamMemberModel).where(TeamMemberModel.team_id == team_id)
        return (await self.session.execute(stmt)).scalars().all()

    async def update_team_member(self, team_id: int, member_id: int, payload: dict) -> TeamMemberModel | None:
        stmt = select(TeamMemberModel).where(
            and_(TeamMemberModel.id == member_id, TeamMemberModel.team_id == team_id)
        )
        member = (await self.session.execute(stmt)).scalar_one_or_none()
        if member is None:
            return None
        for field, value in payload.items():
            setattr(member, field, value)
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def delete_team_member(self, team_id: int, member_id: int) -> bool:
        result = await self.session.execute(
            delete(TeamMemberModel).where(and_(TeamMemberModel.id == member_id, TeamMemberModel.team_id == team_id))
        )
        await self.session.commit()
        return result.rowcount > 0

    async def upsert_watch_lease(self, cluster_id: int, worker_id: str) -> WatchLeaseModel:
        stmt = select(WatchLeaseModel).where(WatchLeaseModel.cluster_id == cluster_id)
        lease = (await self.session.execute(stmt)).scalar_one_or_none()
        now = datetime.utcnow()
        if lease is None:
            lease = WatchLeaseModel(cluster_id=cluster_id, worker_id=worker_id, heartbeat_at=now, acquired_at=now, stale=False)
            self.session.add(lease)
        else:
            lease.worker_id = worker_id
            lease.heartbeat_at = now
            lease.stale = False
        await self.session.commit()
        await self.session.refresh(lease)
        return lease

    async def mark_watch_stale(self, cluster_id: int) -> None:
        await self.session.execute(
            update(WatchLeaseModel).where(WatchLeaseModel.cluster_id == cluster_id).values(stale=True, heartbeat_at=datetime.utcnow())
        )
        await self.session.commit()

    async def count_projects(self) -> int:
        stmt = select(func.count(ProjectModel.id))
        return int((await self.session.execute(stmt)).scalar_one())
