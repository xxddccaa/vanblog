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

show_service() {
  local name="$1"
  local port="$2"
  local url="$3"
  local session
  local pid
  local state="down"
  session="$(session_name "${name}")"
  pid="$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"

  if tmux has-session -t "${session}" 2>/dev/null; then
    state="tmux"
  fi
  if [[ -n "${pid}" ]]; then
    state="up"
  elif [[ -n "${url}" ]] && curl -fsS "${url}" >/dev/null 2>&1; then
    state="up"
  fi

  printf '%-12s %-8s %-8s\n' "${name}" "${pid:-"-"}" "${state}"
}

printf '%-12s %-8s %-8s\n' "service" "pid" "state"
show_service proxy 18080 "http://127.0.0.1:18080"
show_service waline 8360 "http://127.0.0.1:8360/comment?type=count&url=%2F__host-dev__"
show_service website 3001 "http://127.0.0.1:3001"
show_service server 3000 "http://127.0.0.1:3000/swagger"
show_service admin 3002 "http://127.0.0.1:3002/"

echo
docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" ps
