# Quality-Hub MVP

Quality-Hub is a GitOps release-readiness and CI health dashboard for GitLab + Flux Kubernetes deployments.

## Full documentation

- Complete project documentation: `docs/COMPLETE_DOCUMENTATION.md`

## What this MVP includes

- FastAPI backend in `src/app/api`
- Next.js dashboard integration under `/dashboard/quality-hub/*`
- Token-based GitLab connection flow (`/auth/token`)
- Project monitoring and sync (`/v1/projects/sync`)
- Broken pipelines readiness query (`/v1/pipelines`)
- Flux deployment status APIs (`/v1/deployments/status`)
- Workspace entities: views, notes, watchlist, tags
- Team and team member management APIs
- Local Docker Compose stack (`infra/compose.yaml`) with web/api/worker/beat/gitlab/db/redis

## Local run (Docker Compose)

```bash
docker compose -f infra/compose.yaml up --build
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- GitLab (demo): `http://localhost:8929`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

Notes:

- First startup of GitLab can take several minutes.
- GitLab CE typically needs at least ~4 GB RAM available for smooth startup.
- Demo root account (first boot): user `root`, password `root12345`.
- If the `gitlab_*` Docker volumes already exist, the password is whatever was set before.

## Required environment variables

Compose already defines defaults for local run. For manual backend run, copy:

```bash
cp src/app/api/.env.example src/app/api/.env.dev
```

Key vars:

- `DATABASE_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `GITLAB_BASE_URL`
- `SESSION_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `API_CORS_ORIGINS`

## API quickstart

1. Open `http://localhost:3000/auth/token`
2. Create a Personal Access Token in GitLab: `http://localhost:8929/-/profile/personal_access_tokens`
3. In Quality-Hub, keep base URL `http://gitlab:8929` and enter your token
4. Add monitored groups via:
   - `POST /v1/user/monitored-groups`
5. Trigger project sync:
   - `POST /v1/projects/sync`
6. Open portfolio:
   - `http://localhost:3000/dashboard/quality-hub/portfolio`

## Cluster registration

Register clusters in DB via API:

`POST /v1/clusters`

```json
{
  "name": "onprem-cluster-a",
  "kube_api": "https://kube-api.example.local",
  "kube_context_ref": "onprem-cluster-a",
  "kubeconfig_ref": "/kubeconfigs/onprem-a.config",
  "active": true
}
```

## Monitored GitLab groups

Create monitored group by ID/path or URL:

`POST /v1/user/monitored-groups`

```json
{
  "group_url": "https://gitlab.com/my-org/platform"
}
```

## Report uploads

Upload report artifacts to pipeline records:

`POST /v1/reports/upload` (multipart form)

Fields:

- `pipeline_id` (int)
- `type` (`junit`, `sarif`, `lcov`, `cobertura`, `eslint`, `checkstyle`)
- `file` (artifact)

Example with `curl`:

```bash
curl -X POST \
  -F "pipeline_id=123" \
  -F "type=junit" \
  -F "file=@junit.xml" \
  http://localhost:8000/v1/reports/upload
```

## Manual backend run (without compose)

```bash
cd src/app/api
uv run alembic upgrade head
uv run uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --reload
```

Workers:

```bash
cd src/app/api
uv run celery -A app.core.tasks.celery_app.celery_app worker -l info
uv run celery -A app.core.tasks.beat_schedule.celery_app beat -l info
```

## Notes

- This MVP uses token flow (not GitLab OAuth).
- Kubernetes watch task is a production-oriented skeleton and must be extended with real cluster connectivity logic for live Flux event ingestion.
