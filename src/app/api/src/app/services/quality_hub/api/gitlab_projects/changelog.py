from __future__ import annotations

import asyncio
from pathlib import PurePosixPath
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.session import get_db_session
from app.core.security.session_auth import get_current_user
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import (
    get_project_file_raw,
    get_project_merge_request_changed_paths,
    list_group_projects,
    list_project_merge_requests,
    list_project_repository_tree,
)
from app.services.quality_hub.infrastructure.models import UserModel
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/gitlab/projects", tags=["gitlab"])

_PREFERRED_FILENAMES = {
    "changelog.md": 0,
    "changelog.rst": 1,
    "changelog.txt": 2,
    "changelog": 3,
    "changes.md": 4,
    "changes.rst": 5,
    "changes.txt": 6,
    "history.md": 7,
    "history.rst": 8,
    "release-notes.md": 9,
    "release_notes.md": 10,
    "releasenotes.md": 11,
}
_PREFERRED_NORMALIZED_FILENAMES = {
    "".join(ch for ch in filename.casefold() if ch.isalnum()): rank
    for filename, rank in _PREFERRED_FILENAMES.items()
}


def _dedupe_preserve(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        output.append(value)
        seen.add(value)
    return output


def _normalize_filename(filename: str) -> str:
    return "".join(ch for ch in filename.casefold() if ch.isalnum())


def _is_changelog_candidate(path: str) -> bool:
    filename = PurePosixPath(path).name.casefold()
    normalized = _normalize_filename(filename)
    if normalized in _PREFERRED_NORMALIZED_FILENAMES:
        return True
    if "changelog" in normalized:
        return True
    return "release" in normalized and "note" in normalized


def _candidate_sort_key(path: str) -> tuple[int, int, int]:
    filename = PurePosixPath(path).name.casefold()
    normalized = _normalize_filename(filename)
    depth = len(PurePosixPath(path).parts)
    preferred_rank = _PREFERRED_NORMALIZED_FILENAMES.get(normalized)
    if preferred_rank is not None:
        return (preferred_rank, depth, len(path))
    if "changelog" in normalized:
        return (20, depth, len(path))
    if "release" in normalized and "note" in normalized:
        return (30, depth, len(path))
    if "history" in normalized:
        return (40, depth, len(path))
    if "change" in normalized:
        return (50, depth, len(path))
    return (99, depth, len(path))


def _trim_content(content: str, max_chars: int) -> tuple[str, bool]:
    if len(content) <= max_chars:
        return content, False
    return f"{content[:max_chars].rstrip()}\n\n... (truncated)", True


def _build_blob_url(project_web_url: str | None, file_path: str, ref: str | None) -> str | None:
    if not project_web_url:
        return None
    selected_ref = ref or "HEAD"
    encoded_ref = quote(selected_ref, safe="")
    encoded_path = "/".join(quote(part, safe="") for part in file_path.split("/") if part)
    return f"{project_web_url}/-/blob/{encoded_ref}/{encoded_path}"


def _empty_mr_rule_payload() -> dict:
    return {
        "rule_id": "mr_requires_changelog_change",
        "description": "Every merge request must include a changelog change.",
        "checked_merge_requests": 0,
        "violations": 0,
        "items": [],
        "error": None,
    }


async def _evaluate_project_mr_rule(
    *,
    token: str,
    base_url: str,
    project_id: int,
    mr_limit: int,
) -> dict:
    payload = _empty_mr_rule_payload()
    try:
        merge_requests = await list_project_merge_requests(
            token=token,
            base_url=base_url,
            project_id=project_id,
            state="opened",
            limit=mr_limit,
        )
    except httpx.HTTPStatusError as exc:
        payload["error"] = f"Failed to load merge requests (status {exc.response.status_code})"
        return payload

    semaphore = asyncio.Semaphore(6)

    async def evaluate_single_merge_request(row: dict) -> dict | None:
        iid_raw = row.get("iid")
        if isinstance(iid_raw, int):
            iid = iid_raw
        elif isinstance(iid_raw, str) and iid_raw.isdigit():
            iid = int(iid_raw)
        else:
            return None

        changed_paths: list[str] = []
        item_error: str | None = None
        try:
            async with semaphore:
                changed_paths = await get_project_merge_request_changed_paths(
                    token=token,
                    base_url=base_url,
                    project_id=project_id,
                    merge_request_iid=iid,
                )
        except httpx.HTTPStatusError as exc:
            item_error = f"Failed to read MR changes (status {exc.response.status_code})"

        matching_paths = [path for path in changed_paths if _is_changelog_candidate(path)]
        has_changelog_change = bool(matching_paths)
        return {
            "iid": iid,
            "title": row.get("title") or f"MR !{iid}",
            "web_url": row.get("web_url"),
            "state": row.get("state"),
            "has_changelog_change": has_changelog_change,
            "matching_paths": matching_paths,
            "error": item_error,
        }

    evaluations = await asyncio.gather(
        *(evaluate_single_merge_request(row) for row in merge_requests if isinstance(row, dict))
    )
    items = [item for item in evaluations if item is not None]
    violations = sum(1 for item in items if not item["has_changelog_change"])
    payload["checked_merge_requests"] = len(items)
    payload["violations"] = violations
    payload["items"] = items
    return payload


async def _load_project_changelog(  # noqa: C901, PLR0912, PLR0915
    *,
    token: str,
    base_url: str,
    project: dict,
    content_max_chars: int,
    mr_limit: int,
) -> dict:
    project_id = project["id"]
    default_branch = project.get("default_branch")
    project_web_url = project.get("web_url")
    mr_rule = await _evaluate_project_mr_rule(
        token=token,
        base_url=base_url,
        project_id=project_id,
        mr_limit=mr_limit,
    )
    fallback_refs = _dedupe_preserve(
        [ref for ref in [default_branch, "main", "master", "HEAD"] if ref]
    )

    try:
        tree_rows = await list_project_repository_tree(
            token=token,
            base_url=base_url,
            project_id=project_id,
            ref=default_branch,
            recursive=True,
        )
    except httpx.HTTPStatusError as exc:
        upstream_status = exc.response.status_code
        return {
            **project,
            "changelog": {
                "found": False,
                "path": None,
                "ref": None,
                "content": None,
                "truncated": False,
                "size_chars": None,
                "web_url": None,
                "error": f"Failed to browse repository tree (status {upstream_status})",
            },
            "mr_rule": mr_rule,
        }

    candidate_paths = sorted(
        [
            row.get("path")
            for row in tree_rows
            if isinstance(row, dict)
            and row.get("type") == "blob"
            and isinstance(row.get("path"), str)
            and _is_changelog_candidate(row.get("path"))
        ],
        key=_candidate_sort_key,
    )

    if not candidate_paths:
        return {
            **project,
            "changelog": {
                "found": False,
                "path": None,
                "ref": None,
                "content": None,
                "truncated": False,
                "size_chars": None,
                "web_url": None,
                "error": None,
            },
            "mr_rule": mr_rule,
        }

    selected_path = candidate_paths[0]
    raw_content: str | None = None
    resolved_ref: str | None = None
    load_error: str | None = None

    for ref in fallback_refs:
        try:
            raw_content = await get_project_file_raw(
                token=token,
                base_url=base_url,
                project_id=project_id,
                file_path=selected_path,
                ref=ref,
            )
            resolved_ref = ref
            break
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in {400, 404}:
                continue
            load_error = f"Failed to read changelog file (status {exc.response.status_code})"
            break

    if raw_content is None:
        return {
            **project,
            "changelog": {
                "found": False,
                "path": selected_path,
                "ref": resolved_ref,
                "content": None,
                "truncated": False,
                "size_chars": None,
                "web_url": _build_blob_url(project_web_url, selected_path, resolved_ref or default_branch),
                "error": load_error or "Changelog file could not be read",
            },
            "mr_rule": mr_rule,
        }

    content, truncated = _trim_content(raw_content, content_max_chars)
    return {
        **project,
        "changelog": {
            "found": True,
            "path": selected_path,
            "ref": resolved_ref or default_branch,
            "content": content,
            "truncated": truncated,
            "size_chars": len(raw_content),
            "web_url": _build_blob_url(project_web_url, selected_path, resolved_ref or default_branch),
            "error": None,
        },
        "mr_rule": mr_rule,
    }


@router.get("/workspace/changelog")
async def list_workspace_changelog(  # noqa: PLR0913
    workspace_id: int = Query(..., gt=0),
    project_limit: int = Query(default=30, ge=1, le=200),
    content_max_chars: int = Query(default=12000, ge=500, le=50000),
    mr_limit: int = Query(default=40, ge=1, le=200),
    current_user: UserModel = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_db_session),  # noqa: B008
) -> dict:
    repository = QualityHubRepository(session)
    credential = await repository.get_gitlab_credential(current_user.id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitLab token is not connected")

    workspace = await repository.get_monitored_group(workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    token = TokenCipher().decrypt(credential.token_encrypted)
    projects = await list_group_projects(
        token=token,
        base_url=credential.base_url,
        group_id=workspace.gitlab_group_id,
    )

    normalized_projects = sorted(
        [
            {
                "id": int(project["id"]),
                "name": project.get("name") or str(project["id"]),
                "path_with_namespace": project.get("path_with_namespace") or project.get("path"),
                "default_branch": project.get("default_branch"),
                "web_url": project.get("web_url"),
            }
            for project in projects
            if isinstance(project, dict) and project.get("id") is not None
        ],
        key=lambda item: str(item.get("path_with_namespace") or item["name"]).casefold(),
    )[:project_limit]

    semaphore = asyncio.Semaphore(5)

    async def run_for_project(project: dict) -> dict:
        async with semaphore:
            return await _load_project_changelog(
                token=token,
                base_url=credential.base_url,
                project=project,
                content_max_chars=content_max_chars,
                mr_limit=mr_limit,
            )

    items = await asyncio.gather(*(run_for_project(project) for project in normalized_projects))
    found_count = sum(1 for item in items if item.get("changelog", {}).get("found"))
    checked_merge_requests = sum(
        int(item.get("mr_rule", {}).get("checked_merge_requests", 0))
        for item in items
    )
    mr_violations = sum(int(item.get("mr_rule", {}).get("violations", 0)) for item in items)
    projects_with_violations = sum(
        1
        for item in items
        if int(item.get("mr_rule", {}).get("violations", 0)) > 0
    )

    return {
        "workspace_id": workspace.id,
        "workspace_path": workspace.gitlab_group_path,
        "project_limit": project_limit,
        "content_max_chars": content_max_chars,
        "mr_limit": mr_limit,
        "count": len(items),
        "found_count": found_count,
        "mr_rule": {
            "checked_merge_requests": checked_merge_requests,
            "violations": mr_violations,
            "projects_with_violations": projects_with_violations,
        },
        "items": items,
    }
