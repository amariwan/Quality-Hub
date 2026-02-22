#!/usr/bin/env bash
set -euo pipefail

cd /workspace

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
