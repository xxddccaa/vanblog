#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_DEV_DIR="${ROOT_DIR}/tests/host-dev"
COMPOSE_FILE="${HOST_DEV_DIR}/docker-compose.yaml"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-vanblog-host-dev}"

session_name() {
  local name="$1"
  echo "vanblog-host-${name}"
}

kill_port() {
  local port="$1"
  if fuser "${port}/tcp" >/dev/null 2>&1; then
    echo "[host-dev] freeing port ${port}"
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    sleep 1
  fi
}

for port in 18080 3002 3001 3011 8360 8361 3000; do
  kill_port "${port}"
done

for name in proxy admin server website waline; do
  tmux kill-session -t "$(session_name "${name}")" 2>/dev/null || true
done

docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" down
echo "[host-dev] stopped"
