#!/usr/bin/env bash
set -euo pipefail

cd /workspace

HOME_DIR="$(getent passwd "$(id -u)" | cut -d: -f6)"
HOME_DIR="${HOME_DIR:-${HOME:-/root}}"
export COREPACK_HOME="${COREPACK_HOME:-${HOME_DIR}/.local/share/corepack}"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_writable_dir() {
  local dir="$1"
  run_privileged mkdir -p "${dir}"
  if [ ! -w "${dir}" ]; then
    run_privileged chown -R "$(id -u):$(id -g)" "${dir}" 2>/dev/null || true
  fi
}

# Devcontainer feature/install steps can leave cache dirs owned by root.
ensure_writable_dir "${HOME_DIR}/.cache/node/corepack"
ensure_writable_dir "${COREPACK_HOME}"
ensure_writable_dir "${HOME_DIR}/.local/share/pnpm"

corepack enable
corepack prepare pnpm@latest --activate

if [ -f package.json ]; then
  echo "[devcontainer] Installing Node dependencies..."
  pnpm install
fi

echo "[devcontainer] Installing Python 3.13 via uv (if needed)..."
uv python install 3.13

if [ -d src/app/api ]; then
  cd src/app/api

  if [ ! -f .env.dev ] && [ -f .env.example ]; then
    cp .env.example .env.dev
  fi

  echo "[devcontainer] Syncing Python dependencies..."
  uv sync --python 3.13

  echo "[devcontainer] Running DB migration (best effort)..."
  uv run alembic upgrade head || true
fi

echo "[devcontainer] Setup complete."
