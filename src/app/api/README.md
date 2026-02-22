# Quality-Hub API (FastAPI)

This service provides the backend APIs for Quality-Hub MVP.

## Stack

- FastAPI
- SQLAlchemy 2.0 (async)
- Alembic
- Celery + Redis
- PostgreSQL

## Local setup

```bash
cd src/app/api
cp .env.example .env.dev
# edit .env.dev values as needed
```

## Run API only

```bash
cd src/app/api
uv run uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --reload
```

## Run Alembic migration

```bash
cd src/app/api
uv run alembic upgrade head
```

## Run workers

```bash
cd src/app/api
uv run celery -A app.core.tasks.celery_app.celery_app worker -l info
uv run celery -A app.core.tasks.celery_app.celery_app beat -l info
```

## API prefixes

All endpoints are under `/v1`.

Important endpoints:

- `POST /v1/auth/token`
- `GET /v1/auth/me`
- `DELETE /v1/auth/token`
- `GET /v1/gitlab/groups`
- `GET /v1/gitlab/issues`
- `POST /v1/gitlab/issues`
- `CRUD /v1/user/monitored-groups`
- `POST /v1/projects/sync`
- `GET /v1/pipelines`
- `GET /v1/risk-radar`
- `CRUD /v1/team-project-mappings`
- `POST /v1/reports/upload`
- `GET /v1/deployments/status`
- `GET /v1/deployments/status/{project_id}`
- `CRUD /v1/workspace/views`
- `CRUD /v1/workspace/notes`
- `CRUD /v1/workspace/watchlist`
- `CRUD /v1/workspace/tags`
- `CRUD /v1/teams`
- `CRUD /v1/teams/{team_id}/members`
- `CRUD /v1/clusters`
- `CRUD /v1/project-mappings`
- `GET /v1/ops/overview`
- `CRUD /v1/ops/release-gates`
- `CRUD /v1/ops/alert-rules`
- `CRUD /v1/ops/incident-links`
- `CRUD /v1/ops/workspace-templates`
- `GET /v1/ops/trend-regressions`
- `GET /v1/ops/dora-metrics`
- `GET /v1/ops/weekly-summary`
- `GET /v1/ops/ownership-heatmap`
- `POST /v1/ops/risk-simulation`
- `GET /v1/ops/audit-log`
- `GET /v1/ops/audit-log/export`
- `CRUD /v1/ops/release-trains`
- `CRUD /v1/ops/remediation-playbooks`
- `CRUD /v1/ops/slo-budgets`
- `CRUD /v1/ops/guardrails`
- `CRUD /v1/ops/dependencies`
- `CRUD /v1/ops/postmortems`
- `CRUD /v1/ops/change-approvals`
- `CRUD /v1/ops/webhook-automations`
- `GET /v1/ops/quality-cost`
- `GET /v1/ops/predictive-risk`
- `GET /v1/ops/status-page`
- `GET /v1/ops/team-benchmarking`

## Notes

- GitLab OAuth is intentionally out of scope for this implementation.
- Token flow is session-cookie based for local single-user MVP mode.
- Kubernetes watch adapter is a production-ready skeleton that currently emits heartbeats unless extended with real cluster watch calls.
