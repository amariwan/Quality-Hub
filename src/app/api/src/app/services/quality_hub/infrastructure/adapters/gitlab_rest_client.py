from __future__ import annotations

from urllib.parse import quote

import httpx

from app.config.settings import get_settings
from app.services.quality_hub.infrastructure.adapters.gitlab_graphql_client import GitLabGraphQLClient


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

    async def list_project_pipelines(  # noqa: PLR0913
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

    async def get_project_merge_request_changed_paths(
        self,
        token: str,
        project_id: int,
        merge_request_iid: int,
    ) -> list[str]:
        encoded_iid = quote(str(merge_request_iid), safe="")
        result = await self._request(
            "GET",
            f"/projects/{project_id}/merge_requests/{encoded_iid}/changes",
            token,
        )
        if not isinstance(result, dict):
            raise ValueError("Unexpected merge request changes response")

        output: list[str] = []
        changes = result.get("changes")
        if not isinstance(changes, list):
            return output

        for row in changes:
            if not isinstance(row, dict):
                continue
            for key in ("new_path", "old_path"):
                value = row.get(key)
                if isinstance(value, str) and value and value not in output:
                    output.append(value)
        return output

    async def list_group_issues(
        self,
        token: str,
        group_id: int,
        *,
        state: str = "opened",
        search: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        params: dict[str, str] = {"state": state}
        if search:
            params["search"] = search
            params["in"] = "title,description"
        rows = await self._request_paginated(
            f"/groups/{group_id}/issues",
            token,
            params=params,
        )
        return rows[:limit]

    async def create_project_issue(  # noqa: C901, PLR0913
        self,
        token: str,
        project_id: int,
        *,
        title: str,
        description: str | None = None,
        labels: list[str] | None = None,
        due_date: str | None = None,
    ) -> dict:
        headers = {"PRIVATE-TOKEN": token, "Accept": "application/json"}
        url = f"{self.api_base_url}/projects/{project_id}/issues"
        payload: dict[str, str] = {"title": title}
        if description:
            payload["description"] = description
        if labels:
            payload["labels"] = ",".join(labels)
        if due_date:
            payload["due_date"] = due_date

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            attempts: list[tuple[str, dict[str, str]]] = [
                ("data", payload),
                ("json", payload),
                ("params", payload),
            ]
            last_error: httpx.HTTPStatusError | None = None
            graphql_error: Exception | None = None

            for mode, body in attempts:
                response = await client.post(
                    url,
                    headers=headers,
                    data=body if mode == "data" else None,
                    json=body if mode == "json" else None,
                    params=body if mode == "params" else None,
                )
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    last_error = exc
                    # Retry with alternative transport encoding only for server-side failures.
                    if exc.response.status_code >= 500:
                        continue
                    raise

                try:
                    result = response.json()
                except ValueError as exc:
                    preview = (response.text or "").strip().replace("\n", " ")
                    raise ValueError(f"GitLab returned non-JSON response: {preview[:300]}") from exc
                if not isinstance(result, dict):
                    raise ValueError("Unexpected issue create response")
                return result

            # Some GitLab builds respond 500 for REST issue create. In that case, fallback to GraphQL.
            if last_error is not None and last_error.response.status_code >= 500:
                try:
                    return await self._create_project_issue_graphql(
                        token=token,
                        project_id=project_id,
                        title=title,
                        description=description,
                        labels=labels,
                        due_date=due_date,
                    )
                except Exception as exc:  # noqa: BLE001
                    graphql_error = exc

            if last_error is not None:
                if graphql_error is not None:
                    request_id = last_error.response.headers.get("x-request-id") or "unknown"
                    body_preview = (last_error.response.text or "").strip().replace("\n", " ")[:300]
                    raise ValueError(
                        "GitLab REST issue create failed "
                        f"(status={last_error.response.status_code}, request_id={request_id}, body={body_preview}) "
                        f"and GraphQL fallback failed ({type(graphql_error).__name__}: {graphql_error})"
                    ) from graphql_error
                raise last_error
            raise ValueError("GitLab issue create failed without response")

    async def _create_project_issue_graphql(  # noqa: C901, PLR0913
        self,
        *,
        token: str,
        project_id: int,
        title: str,
        description: str | None = None,
        labels: list[str] | None = None,
        due_date: str | None = None,
    ) -> dict:
        project = await self.get_project(token, project_id)
        path_with_namespace = project.get("path_with_namespace")
        if not isinstance(path_with_namespace, str) or not path_with_namespace:
            raise ValueError("GitLab project path could not be resolved")

        mutation = """
        mutation CreateIssue(
          $projectPath: ID!
          $title: String!
          $description: String
          $labels: [String!]
          $dueDate: ISO8601Date
        ) {
          createIssue(input: {
            projectPath: $projectPath
            title: $title
            description: $description
            labels: $labels
            dueDate: $dueDate
          }) {
            issue {
              id
              iid
              title
              state
              webUrl
              createdAt
              updatedAt
            }
            errors
          }
        }
        """
        variables: dict[str, object] = {
            "projectPath": path_with_namespace,
            "title": title,
            "description": description,
            "labels": labels or [],
            "dueDate": due_date,
        }
        client = GitLabGraphQLClient(base_url=self.api_base_url.rsplit("/api/v4", 1)[0], timeout_seconds=self.timeout_seconds)
        result = await client.execute(token=token, query=mutation, variables=variables)

        errors = result.get("errors") if isinstance(result, dict) else None
        if isinstance(errors, list) and errors:
            filtered_errors: list[str] = []
            for item in errors:
                if isinstance(item, dict):
                    message = item.get("message")
                    if isinstance(message, str) and message.strip():
                        filtered_errors.append(message.strip())
                elif isinstance(item, str) and item.strip():
                    filtered_errors.append(item.strip())
            if filtered_errors:
                raise ValueError(f"GraphQL error: {', '.join(filtered_errors)}")

        payload = result.get("data") if isinstance(result, dict) else None
        if not isinstance(payload, dict):
            raise ValueError("Invalid GraphQL payload for createIssue")
        create_issue = payload.get("createIssue")
        if not isinstance(create_issue, dict):
            raise ValueError("Missing createIssue result")

        errors = create_issue.get("errors")
        if isinstance(errors, list):
            filtered_errors = [str(item) for item in errors if str(item).strip()]
            if filtered_errors:
                raise ValueError(f"GraphQL issue create failed: {', '.join(filtered_errors)}")

        issue = create_issue.get("issue")
        if not isinstance(issue, dict):
            raise ValueError("GraphQL issue create returned no issue")

        return {
            "id": issue.get("id"),
            "iid": issue.get("iid"),
            "project_id": project_id,
            "title": issue.get("title"),
            "state": issue.get("state"),
            "labels": labels or [],
            "web_url": issue.get("webUrl"),
            "created_at": issue.get("createdAt"),
            "updated_at": issue.get("updatedAt"),
        }

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

    async def list_project_repository_tree(
        self,
        token: str,
        project_id: int,
        *,
        ref: str | None = None,
        recursive: bool = True,
    ) -> list[dict]:
        params: dict[str, str] = {}
        if ref:
            params["ref"] = ref
        if recursive:
            params["recursive"] = "true"
        return await self._request_paginated(
            f"/projects/{project_id}/repository/tree",
            token,
            params=params,
        )

    async def get_project_file_raw(
        self,
        token: str,
        project_id: int,
        *,
        file_path: str,
        ref: str,
    ) -> str:
        headers = {"PRIVATE-TOKEN": token}
        encoded_path = quote(file_path, safe="")
        url = f"{self.api_base_url}/projects/{project_id}/repository/files/{encoded_path}/raw"

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.get(url, headers=headers, params={"ref": ref})
            response.raise_for_status()
            return response.text
