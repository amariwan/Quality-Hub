from __future__ import annotations

from urllib.parse import quote

import httpx

from app.config.settings import get_settings


class GitLabRestClient:
    def __init__(self, base_url: str | None = None, timeout_seconds: float = 20.0):
        settings = get_settings()
        root = (base_url or settings.GITLAB_BASE_URL).rstrip("/")
        self.api_base_url = f"{root}/api/v4"
        self.timeout_seconds = timeout_seconds

    async def _request(self, method: str, path: str, token: str, params: dict | None = None) -> dict | list:
        headers = {"PRIVATE-TOKEN": token}
        url = f"{self.api_base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.request(method, url, headers=headers, params=params)
            response.raise_for_status()
            return response.json()

    async def _request_paginated(self, path: str, token: str, params: dict | None = None) -> list[dict]:
        headers = {"PRIVATE-TOKEN": token}
        url = f"{self.api_base_url}{path}"
        output: list[dict] = []
        page = 1
        extra_params = params or {}

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            while True:
                request_params = {"per_page": 100, "page": page, **extra_params}
                response = await client.request("GET", url, headers=headers, params=request_params)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list):
                    raise ValueError("Unexpected paginated response payload")

                output.extend(item for item in payload if isinstance(item, dict))

                next_page = response.headers.get("X-Next-Page") or response.headers.get("x-next-page")
                if not next_page:
                    break
                page = int(next_page)

        return output

    async def get_user(self, token: str) -> dict:
        result = await self._request("GET", "/user", token)
        if not isinstance(result, dict):
            raise ValueError("Unexpected GitLab user response")
        return result

    async def list_groups(self, token: str) -> list[dict]:
        return await self._request_paginated("/groups", token)

    async def get_group(self, token: str, group_id: int) -> dict:
        result = await self._request("GET", f"/groups/{group_id}", token)
        if not isinstance(result, dict):
            raise ValueError("Unexpected GitLab group response")
        return result

    async def list_group_projects(self, token: str, group_id: int) -> list[dict]:
        return await self._request_paginated(
            f"/groups/{group_id}/projects",
            token,
            params={"include_subgroups": "true"},
        )

    async def list_projects(self, token: str) -> list[dict]:
        return await self._request_paginated(
            "/projects",
            token,
            params={"simple": "true", "archived": "false"},
        )

    async def get_project(self, token: str, project_id: int) -> dict:
        result = await self._request("GET", f"/projects/{project_id}", token)
        if not isinstance(result, dict):
            raise ValueError("Unexpected GitLab project response")
        return result

    async def list_project_pipelines(
        self,
        token: str,
        project_id: int,
        *,
        status: str | None = None,
        ref: str | None = None,
        source: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        params: dict[str, str] = {}
        if status:
            params["status"] = status
        if ref:
            params["ref"] = ref
        if source:
            params["source"] = source

        rows = await self._request_paginated(
            f"/projects/{project_id}/pipelines",
            token,
            params=params,
        )
        return rows[:limit]

    async def list_project_merge_requests(
        self,
        token: str,
        project_id: int,
        *,
        state: str = "opened",
        limit: int = 200,
    ) -> list[dict]:
        rows = await self._request_paginated(
            f"/projects/{project_id}/merge_requests",
            token,
            params={"state": state},
        )
        return rows[:limit]

    async def get_pipeline(self, token: str, project_id: int, pipeline_id: int) -> dict:
        result = await self._request("GET", f"/projects/{project_id}/pipelines/{pipeline_id}", token)
        if not isinstance(result, dict):
            raise ValueError("Unexpected pipeline response")
        return result

    async def get_pipeline_test_report_summary(self, token: str, project_id: int, pipeline_id: int) -> dict | None:
        try:
            result = await self._request(
                "GET",
                f"/projects/{project_id}/pipelines/{pipeline_id}/test_report_summary",
                token,
            )
            return result if isinstance(result, dict) else None
        except httpx.HTTPStatusError:
            return None

    async def get_commit(self, token: str, project_id: int, sha: str) -> dict | None:
        try:
            encoded = quote(sha, safe="")
            result = await self._request("GET", f"/projects/{project_id}/repository/commits/{encoded}", token)
            return result if isinstance(result, dict) else None
        except httpx.HTTPStatusError:
            return None

    async def get_merge_request_for_commit(self, token: str, project_id: int, sha: str) -> dict | None:
        try:
            encoded = quote(sha, safe="")
            result = await self._request(
                "GET",
                f"/projects/{project_id}/repository/commits/{encoded}/merge_requests",
                token,
                params={"per_page": 1},
            )
            if isinstance(result, list) and result:
                first = result[0]
                return first if isinstance(first, dict) else None
            return None
        except httpx.HTTPStatusError:
            return None

    async def list_tags_for_sha(self, token: str, project_id: int, sha: str) -> list[dict]:
        try:
            tags = await self._request("GET", f"/projects/{project_id}/repository/tags", token, params={"per_page": 100})
            output: list[dict] = []
            if isinstance(tags, list):
                for tag in tags:
                    if not isinstance(tag, dict):
                        continue
                    commit = tag.get("commit") or {}
                    if isinstance(commit, dict) and commit.get("id") == sha:
                        output.append(tag)
            return output
        except httpx.HTTPStatusError:
            return []
