from __future__ import annotations

import httpx

from app.config.settings import get_settings


class GitLabGraphQLClient:
    def __init__(self, base_url: str | None = None, timeout_seconds: float = 20.0):
        settings = get_settings()
        root = (base_url or settings.GITLAB_BASE_URL).rstrip("/")
        self.graphql_url = f"{root}/api/graphql"
        self.timeout_seconds = timeout_seconds

    async def execute(self, token: str, query: str, variables: dict | None = None) -> dict:
        headers = {
            "Authorization": f"Bearer {token}",
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload: dict[str, object] = {"query": query}
        if variables:
            payload["variables"] = variables

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(self.graphql_url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError("Unexpected GitLab GraphQL response")
            return result
