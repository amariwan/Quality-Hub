from __future__ import annotations

from datetime import datetime

import httpx

from app.services.quality_hub.infrastructure.adapters.gitlab_rest_client import GitLabRestClient


async def verify_token(*, token: str, base_url: str) -> dict:
    client = GitLabRestClient(base_url=base_url)
    return await client.get_user(token)


async def list_groups(*, token: str, base_url: str) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_groups(token)


async def list_projects(*, token: str, base_url: str) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_projects(token)


async def list_group_projects(*, token: str, base_url: str, group_id: int) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_group_projects(token, group_id)


async def get_project(*, token: str, base_url: str, project_id: int) -> dict | None:
    client = GitLabRestClient(base_url=base_url)
    try:
        return await client.get_project(token, project_id)
    except httpx.HTTPError:
        return None


async def list_project_pipelines(  # noqa: PLR0913
    *,
    token: str,
    base_url: str,
    project_id: int,
    status: str | None = None,
    ref: str | None = None,
    source: str | None = None,
    limit: int = 50,
) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_project_pipelines(
        token,
        project_id,
        status=status,
        ref=ref,
        source=source,
        limit=limit,
    )


async def list_project_merge_requests(
    *,
    token: str,
    base_url: str,
    project_id: int,
    state: str = "opened",
    limit: int = 200,
) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_project_merge_requests(
        token,
        project_id,
        state=state,
        limit=limit,
    )


async def get_project_merge_request_changed_paths(
    *,
    token: str,
    base_url: str,
    project_id: int,
    merge_request_iid: int,
) -> list[str]:
    client = GitLabRestClient(base_url=base_url)
    return await client.get_project_merge_request_changed_paths(
        token,
        project_id,
        merge_request_iid,
    )


async def list_group_issues(  # noqa: PLR0913
    *,
    token: str,
    base_url: str,
    group_id: int,
    state: str = "opened",
    search: str | None = None,
    limit: int = 200,
) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_group_issues(
        token,
        group_id,
        state=state,
        search=search,
        limit=limit,
    )


async def create_project_issue(  # noqa: PLR0913
    *,
    token: str,
    base_url: str,
    project_id: int,
    title: str,
    description: str | None = None,
    labels: list[str] | None = None,
    due_date: str | None = None,
) -> dict:
    client = GitLabRestClient(base_url=base_url)
    return await client.create_project_issue(
        token,
        project_id,
        title=title,
        description=description,
        labels=labels,
        due_date=due_date,
    )


async def list_project_repository_tree(
    *,
    token: str,
    base_url: str,
    project_id: int,
    ref: str | None = None,
    recursive: bool = True,
) -> list[dict]:
    client = GitLabRestClient(base_url=base_url)
    return await client.list_project_repository_tree(
        token,
        project_id,
        ref=ref,
        recursive=recursive,
    )


async def get_project_file_raw(
    *,
    token: str,
    base_url: str,
    project_id: int,
    file_path: str,
    ref: str,
) -> str:
    client = GitLabRestClient(base_url=base_url)
    return await client.get_project_file_raw(
        token,
        project_id,
        file_path=file_path,
        ref=ref,
    )


async def resolve_revision_metadata(*, token: str, base_url: str, project_id: int, sha: str | None) -> dict:
    if not sha:
        return {"actor_merger": None, "actor_author": None, "git_tag": None}

    client = GitLabRestClient(base_url=base_url)
    commit = await client.get_commit(token=token, project_id=project_id, sha=sha)
    merge_request = await client.get_merge_request_for_commit(token=token, project_id=project_id, sha=sha)
    tags = await client.list_tags_for_sha(token=token, project_id=project_id, sha=sha)

    actor_merger = None
    if merge_request:
        merged_by = merge_request.get("merged_by") or {}
        actor_merger = merged_by.get("username") or merged_by.get("name")

    actor_author = commit.get("author_email") or commit.get("author_name") if commit else None
    git_tag = tags[0].get("name") if tags else None

    return {
        "actor_merger": actor_merger,
        "actor_author": actor_author,
        "git_tag": git_tag,
        "resolved_at": datetime.utcnow().isoformat(),
    }
