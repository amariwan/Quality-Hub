#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="$(getent passwd "$(id -u)" | cut -d: -f6)"
HOME_DIR="${HOME_DIR:-${HOME:-/root}}"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_owned_dir() {
  local dir="$1"
  run_privileged mkdir -p "${dir}"
  if [ ! -w "${dir}" ]; then
    run_privileged chown -R "$(id -u):$(id -g)" "${dir}" 2>/dev/null || true
  fi
}

ensure_owned_dir "${HOME_DIR}/.npm"
ensure_owned_dir "${HOME_DIR}/.cache"

# ensure .local is owned by the current user and create any needed uv directory
ensure_owned_dir "${HOME_DIR}/.local"
ensure_owned_dir "${HOME_DIR}/.local/share/uv/python"

# install procps (pgrep) if it's missing, Debian-based containers often lack it
if ! command -v pgrep >/dev/null; then
  echo "[devcontainer] installing procps for pgrep support..."
  run_privileged apt-get update && run_privileged apt-get install -y procps || true
fi

if [ "${QUALITY_HUB_AUTOSTART:-1}" = "0" ]; then
  echo "[devcontainer] QUALITY_HUB_AUTOSTART=0 -> skipping service startup."
  exit 0
fi

RUNTIME_DIR="/tmp/quality-hub-devcontainer"
mkdir -p "${RUNTIME_DIR}"

start_service() {
  local name="$1"
  local command="$2"
  local pattern="$3"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  local log_file="${RUNTIME_DIR}/${name}.log"

  if [ -f "${pid_file}" ]; then
    local pid
    pid="$(cat "${pid_file}")"
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      local args
      args="$(ps -p "${pid}" -o args= 2>/dev/null || true)"
      if echo "${args}" | grep -F -- "${pattern}" >/dev/null 2>&1; then
        echo "[devcontainer] ${name} already running (pid ${pid})."
        return 0
      fi
    fi
  fi

  local existing_pid
  existing_pid="$(pgrep -f "${pattern}" | head -n 1 || true)"
  if [ -n "${existing_pid}" ]; then
    echo "${existing_pid}" >"${pid_file}"
    echo "[devcontainer] ${name} already running (pid ${existing_pid})."
    return 0
  fi

  echo "[devcontainer] Starting ${name}..."
  nohup bash -lc "${command}" >"${log_file}" 2>&1 &
  local pid=$!
  echo "${pid}" >"${pid_file}"
  sleep 1

  if kill -0 "${pid}" 2>/dev/null; then
    echo "[devcontainer] ${name} started (pid ${pid}, log ${log_file})."
    return 0
  fi

  echo "[devcontainer] ${name} failed to start. Last log lines:"
  tail -n 30 "${log_file}" || true
  return 1
}

wait_for_http() {
  local label="$1"
  local url="$2"
  local timeout="${3:-120}"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "[devcontainer] ${label} is ready at ${url}."
      return 0
    fi

    local now
    now="$(date +%s)"
    if [ $((now - start_ts)) -ge "${timeout}" ]; then
      echo "[devcontainer] ${label} did not become ready in ${timeout}s."
      return 1
    fi

    sleep 2
  done
}

echo "[devcontainer] Running DB migrations (best effort)..."
(cd /workspace/src/app/api && uv run alembic upgrade head) || true

start_service "api" "cd /workspace/src/app/api && uv run uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --reload" "uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --reload"
start_service "worker" "cd /workspace/src/app/api && uv run celery -A app.core.tasks.celery_app.celery_app worker -l info" "celery -A app.core.tasks.celery_app.celery_app worker -l info"
start_service "beat" "cd /workspace/src/app/api && uv run celery -A app.core.tasks.beat_schedule.celery_app beat -l info" "celery -A app.core.tasks.beat_schedule.celery_app beat -l info"
start_service "web" "cd /workspace && pnpm exec next dev --hostname 0.0.0.0 --port 3000" "next dev --hostname 0.0.0.0 --port 3000"

wait_for_http "API" "http://127.0.0.1:8000/v1/health" 120 || true
wait_for_http "Web" "http://127.0.0.1:3000" 120 || true

cat <<'MSG'
[devcontainer] Ready.
Running services:
  - Web:    http://localhost:3000
  - API:    http://localhost:8000
  - GitLab: http://localhost:8929
Log files:
  - /tmp/quality-hub-devcontainer/web.log
  - /tmp/quality-hub-devcontainer/api.log
  - /tmp/quality-hub-devcontainer/worker.log
  - /tmp/quality-hub-devcontainer/beat.log
MSG
