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
- `CRUD /v1/user/monitored-groups`
- `POST /v1/projects/sync`
- `GET /v1/pipelines`
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

## Notes

- GitLab OAuth is intentionally out of scope for this implementation.
- Token flow is session-cookie based for local single-user MVP mode.
- Kubernetes watch adapter is a production-ready skeleton that currently emits heartbeats unless extended with real cluster watch calls.
