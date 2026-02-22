from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.config.settings import get_settings
from app.core.db.session import AsyncSessionLocal
from app.core.security.session_auth import get_session_user_id_from_raw
from app.core.security.token_cipher import TokenCipher
from app.services.quality_hub.application.gitlab_integration import (
    list_project_merge_requests,
    list_project_pipelines,
)
from app.services.quality_hub.infrastructure.repositories import QualityHubRepository

router = APIRouter(prefix="/ws/gitlab", tags=["gitlab-websocket"])


@router.websocket("/live")
async def websocket_gitlab_live(websocket: WebSocket) -> None:
    settings = get_settings()
    await websocket.accept()

    raw_cookie = websocket.cookies.get(settings.SESSION_COOKIE_NAME)
    user_id = get_session_user_id_from_raw(raw_cookie)
    if user_id is None:
        await websocket.send_json(
            {"type": "error", "detail": "Not authenticated", "code": status.HTTP_401_UNAUTHORIZED}
        )
        await websocket.close(code=4401)
        return

    project_ids = [int(value) for value in websocket.query_params.getlist("project_ids") if value.isdigit()]
    if not project_ids:
        await websocket.send_json(
            {"type": "error", "detail": "At least one project_ids query param is required", "code": 400}
        )
        await websocket.close(code=4400)
        return

    interval_seconds = int(
        websocket.query_params.get("interval_seconds", str(settings.WS_GITLAB_LIVE_DEFAULT_INTERVAL_SECONDS))
    )
    interval_seconds = max(3, min(interval_seconds, settings.WS_GITLAB_LIVE_MAX_INTERVAL_SECONDS))
    pipeline_limit = int(websocket.query_params.get("pipeline_limit", "30"))
    pipeline_limit = max(10, min(pipeline_limit, 200))
    events_limit = int(websocket.query_params.get("events_limit", "20"))
    events_limit = max(5, min(events_limit, 100))

    try:
        while True:
            async with AsyncSessionLocal() as session:
                repository = QualityHubRepository(session)
                credential = await repository.get_gitlab_credential(user_id)
                if credential is None:
                    await websocket.send_json(
                        {"type": "error", "detail": "GitLab token is not connected", "code": 400}
                    )
                    await websocket.close(code=4400)
                    return
                token = TokenCipher().decrypt(credential.token_encrypted)

                items: list[dict] = []
                totals = {
                    "projects": 0,
                    "open_merge_requests": 0,
                    "pipelines_sampled": 0,
                    "failed_pipelines": 0,
                }

                for project_id in project_ids:
                    try:
                        pipelines = await list_project_pipelines(
                            token=token,
                            base_url=credential.base_url,
                            project_id=project_id,
                            limit=pipeline_limit,
                        )
                        merge_requests = await list_project_merge_requests(
                            token=token,
                            base_url=credential.base_url,
                            project_id=project_id,
                            state="opened",
                            limit=100,
                        )
                    except httpx.HTTPStatusError as exc:
                        await websocket.send_json(
                            {
                                "type": "project_error",
                                "project_id": project_id,
                                "status_code": exc.response.status_code,
                                "detail": "Failed to load data from GitLab",
                            }
                        )
                        continue

                    sampled = len(pipelines)
                    failed = sum(1 for row in pipelines if row.get("status") == "failed")
                    failure_rate = round((failed / sampled) * 100, 1) if sampled else 0.0
                    latest = pipelines[0] if pipelines else {}
                    items.append(
                        {
                            "project_id": project_id,
                            "open_merge_requests": len(merge_requests),
                            "pipelines_sampled": sampled,
                            "failed_pipelines": failed,
                            "failure_rate_pct": failure_rate,
                            "latest_pipeline_status": latest.get("status"),
                            "latest_pipeline_updated_at": latest.get("updated_at"),
                            "latest_events": [
                                {
                                    "id": row.get("id"),
                                    "status": row.get("status"),
                                    "ref": row.get("ref"),
                                    "sha": row.get("sha"),
                                    "source": row.get("source"),
                                    "updated_at": row.get("updated_at"),
                                    "web_url": row.get("web_url"),
                                }
                                for row in pipelines[:events_limit]
                            ],
                        }
                    )

                    totals["projects"] += 1
                    totals["open_merge_requests"] += len(merge_requests)
                    totals["pipelines_sampled"] += sampled
                    totals["failed_pipelines"] += failed

                totals["failure_rate_pct"] = (
                    round((totals["failed_pipelines"] / totals["pipelines_sampled"]) * 100, 1)
                    if totals["pipelines_sampled"]
                    else 0.0
                )

                await websocket.send_json(
                    {
                        "type": "snapshot",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "interval_seconds": interval_seconds,
                        "totals": totals,
                        "items": items,
                    }
                )
            await asyncio.sleep(interval_seconds)
    except WebSocketDisconnect:
        return
