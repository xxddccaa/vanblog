#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_DEV_DIR="${ROOT_DIR}/tests/host-dev"
HOST_RUNTIME_DIR="${HOST_DEV_DIR}/runtime"
HOST_LOG_DIR="${HOST_RUNTIME_DIR}/log"
COMPOSE_FILE="${HOST_DEV_DIR}/docker-compose.yaml"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-vanblog-host-dev}"

mkdir -p "${HOST_LOG_DIR}"

source "${ROOT_DIR}/scripts/host-dev-env.sh"

session_name() {
  local name="$1"
  echo "vanblog-host-${name}"
}

MANUAL_COMPOSE_FILE="${ROOT_DIR}/tests/manual-v1.3.0/docker-compose.yaml"
MANUAL_PROJECT_NAME="${MANUAL_PROJECT_NAME:-vanblog-manual-v130}"

kill_port() {
  local port="$1"
  if fuser "${port}/tcp" >/dev/null 2>&1; then
    echo "[host-dev] freeing port ${port}"
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    sleep 1
  fi
}

reset_host_processes() {
  for name in proxy admin server website waline; do
    tmux kill-session -t "$(session_name "${name}")" 2>/dev/null || true
  done
  for port in 18080 3000 3001 3002 3011 8360 8361; do
    kill_port "${port}"
  done
}

start_tmux() {
  local name="$1"
  local log_file="${HOST_LOG_DIR}/${name}.log"
  shift
  local session
  local cmd
  session="$(session_name "${name}")"
  printf -v cmd '%q ' "$@"

  if tmux has-session -t "${session}" 2>/dev/null; then
    echo "[host-dev] ${name} already running in tmux session ${session}"
    return
  fi

  echo "[host-dev] starting ${name}"
  tmux new-session -d -s "${session}" "bash -lc 'cd \"${ROOT_DIR}\" && source scripts/host-dev-env.sh && ${cmd} >> \"${log_file}\" 2>&1'"
}

wait_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "[host-dev] ${name} is ready: ${url}"
      return 0
    fi
    sleep 2
  done

  echo "[host-dev] ${name} failed to become ready: ${url}" >&2
  return 1
}

wait_tcp() {
  local host="$1"
  local port="$2"
  local name="$3"
  local attempts="${4:-60}"

  for ((i = 1; i <= attempts; i++)); do
    if bash -lc "exec 3<>/dev/tcp/${host}/${port}" >/dev/null 2>&1; then
      echo "[host-dev] ${name} is ready: ${host}:${port}"
      return 0
    fi
    sleep 2
  done

  echo "[host-dev] ${name} failed to become ready: ${host}:${port}" >&2
  return 1
}

post_restart() {
  local url="$1"
  local name="$2"
  local payload="${3:-{}}"
  echo "[host-dev] requesting ${name} restart"
  curl -fsS -X POST "${url}" \
    -H 'content-type: application/json' \
    -d "${payload}" >/dev/null
}

docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" up -d postgres redis
wait_http "http://127.0.0.1:16379" "redis tcp probe" 1 >/dev/null 2>&1 || true

reset_host_processes

echo "[host-dev] stopping manual docker stack on ${MANUAL_COMPOSE_FILE}"
VAN_BLOG_DEBUG_SUPER_TOKEN="${VAN_BLOG_DEBUG_SUPER_TOKEN}" \
  docker compose -f "${MANUAL_COMPOSE_FILE}" -p "${MANUAL_PROJECT_NAME}" down >/dev/null 2>&1 || true
node "${ROOT_DIR}/scripts/ensure-host-dev-db.mjs"

start_tmux waline env PORT=8360 HOST_RUNNER_AUTO_START=false node "${ROOT_DIR}/scripts/host-waline-runner.cjs"
wait_http "http://127.0.0.1:8361/health" "waline control"
post_restart "http://127.0.0.1:8361/restart" "waline"
wait_http "http://127.0.0.1:8360/comment?type=count&url=%2F__host-dev__" "waline"

start_tmux website env PORT=3001 WEBSITE_CONTROL_PORT=3011 HOST_RUNNER_AUTO_START=false node "${ROOT_DIR}/scripts/host-website-runner.cjs"
wait_http "http://127.0.0.1:3011/health" "website control"
post_restart "http://127.0.0.1:3011/restart" "website"
wait_tcp "127.0.0.1" "3001" "website"

start_tmux server env NODE_ENV=development pnpm --filter @vanblog/server dev
wait_http "http://127.0.0.1:3000/swagger" "server"

start_tmux admin env PORT=3002 BROWSER=none EEE=production pnpm --filter @vanblog/admin start
wait_http "http://127.0.0.1:3002/" "admin"

start_tmux proxy caddy run --config "${ROOT_DIR}/tests/host-dev/Caddyfile" --adapter caddyfile
wait_http "http://127.0.0.1:${HOST_DEV_HTTP_PORT}" "host proxy"

cat <<EOF
[host-dev] ready
- proxy:   http://127.0.0.1:${HOST_DEV_HTTP_PORT}
- server:  http://127.0.0.1:3000
- website: http://127.0.0.1:3001
- admin:   http://127.0.0.1:3002
- waline:  http://127.0.0.1:8360
- logs:    ${HOST_LOG_DIR}
EOF
