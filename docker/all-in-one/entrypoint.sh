#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[all-in-one] $*"
}

POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-vanblog}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DATA_DIR="${PGDATA:-/var/lib/postgresql/data}"
POSTGRES_SOCKET_DIR="/var/run/postgresql"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_DATA_DIR="${VANBLOG_REDIS_DIR:-/data/redis}"
WALINE_DB="${VAN_BLOG_WALINE_DB:-waline}"
WALINE_USER="${POSTGRES_USER:-postgres}"
WALINE_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
WEBSITE_CONTROL_PORT="${WEBSITE_CONTROL_PORT:-3011}"
WALINE_CONTROL_PORT="${WALINE_CONTROL_PORT:-8361}"

server_pid=""
website_pid=""
waline_pid=""
admin_pid=""
redis_pid=""
postgres_pid=""
caddy_pid=""

wait_for_command() {
  local description="$1"
  shift
  local attempts="${WAIT_FOR_ATTEMPTS:-60}"
  local sleep_seconds="${WAIT_FOR_SLEEP_SECONDS:-2}"

  for ((i = 1; i <= attempts; i += 1)); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  log "timed out waiting for ${description}"
  return 1
}

wait_for_http() {
  local description="$1"
  local url="$2"
  wait_for_command "${description}" wget -q -O /dev/null "${url}"
}

ensure_directories() {
  mkdir -p \
    "${POSTGRES_DATA_DIR}" \
    "${POSTGRES_SOCKET_DIR}" \
    "${REDIS_DATA_DIR}" \
    /app/static \
    /var/log \
    /var/log/nginx \
    /var/lib/nginx/logs \
    /root/.config/aliyunpan \
    /root/.config/caddy \
    /root/.local/share/caddy
  chown -R postgres:postgres /var/lib/postgresql "${POSTGRES_SOCKET_DIR}" "${POSTGRES_DATA_DIR}"
}

init_postgres() {
  if [[ -f "${POSTGRES_DATA_DIR}/PG_VERSION" ]]; then
    local existing_version
    existing_version="$(cat "${POSTGRES_DATA_DIR}/PG_VERSION")"
    if [[ "${existing_version}" != 16* ]]; then
      log "unsupported PostgreSQL data directory version: ${existing_version}; expected 16.x"
      exit 1
    fi
    return 0
  fi

  log "initializing PostgreSQL data directory"
  local password_file
  password_file="$(mktemp)"
  printf '%s\n' "${POSTGRES_PASSWORD}" > "${password_file}"
  chmod 600 "${password_file}"
  chown postgres:postgres "${password_file}"

  su-exec postgres initdb \
    -D "${POSTGRES_DATA_DIR}" \
    --username="${POSTGRES_USER}" \
    --pwfile="${password_file}" \
    --auth-host=scram-sha-256 \
    --auth-local=trust

  rm -f "${password_file}"

  cat >> "${POSTGRES_DATA_DIR}/postgresql.conf" <<CFG
listen_addresses = '127.0.0.1'
port = ${POSTGRES_PORT}
unix_socket_directories = '${POSTGRES_SOCKET_DIR}'
CFG

  cat >> "${POSTGRES_DATA_DIR}/pg_hba.conf" <<CFG
host all all 127.0.0.1/32 scram-sha-256
host all all ::1/128 scram-sha-256
CFG
}

start_postgres() {
  log "starting PostgreSQL"
  su-exec postgres postgres -D "${POSTGRES_DATA_DIR}" &
  postgres_pid=$!
  wait_for_command "PostgreSQL" pg_isready -h 127.0.0.1 -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres
}

ensure_postgres_database() {
  local db_name="$1"
  su-exec postgres psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT format('CREATE DATABASE %I', '${db_name}')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db_name}');
\gexec
SQL
}

start_redis() {
  log "starting Redis"
  redis-server \
    --bind 127.0.0.1 \
    --port "${REDIS_PORT}" \
    --appendonly yes \
    --dir "${REDIS_DATA_DIR}" \
    --save 60 1 &
  redis_pid=$!
  wait_for_command "Redis" redis-cli -h 127.0.0.1 -p "${REDIS_PORT}" ping
}

start_apps() {
  export NODE_ENV="${NODE_ENV:-production}"
  export VAN_BLOG_DATABASE_URL="${VAN_BLOG_DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}}"
  export VAN_BLOG_REDIS_URL="${VAN_BLOG_REDIS_URL:-redis://127.0.0.1:${REDIS_PORT}}"
  export VAN_BLOG_WALINE_DB="${WALINE_DB}"
  export VAN_BLOG_WALINE_DATABASE_URL="${VAN_BLOG_WALINE_DATABASE_URL:-postgresql://${WALINE_USER}:${WALINE_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${WALINE_DB}}"
  export VANBLOG_CADDY_API_URL="${VANBLOG_CADDY_API_URL:-http://127.0.0.1:2019}"
  export VANBLOG_WEBSITE_CONTROL_URL="${VANBLOG_WEBSITE_CONTROL_URL:-http://127.0.0.1:${WEBSITE_CONTROL_PORT}}"
  export VANBLOG_WALINE_CONTROL_URL="${VANBLOG_WALINE_CONTROL_URL:-http://127.0.0.1:${WALINE_CONTROL_PORT}}"
  export VANBLOG_WEBSITE_ISR_BASE="${VANBLOG_WEBSITE_ISR_BASE:-http://127.0.0.1:3001/api/revalidate?path=}"
  export VAN_BLOG_CADDY_MANAGE_HTTPS="${VAN_BLOG_CADDY_MANAGE_HTTPS:-false}"
  export VANBLOG_AI_TERMINAL_ENABLED="false"
  export PG_HOST="${PG_HOST:-127.0.0.1}"
  export PG_PORT="${PG_PORT:-${POSTGRES_PORT}}"
  export PG_DB="${PG_DB:-${WALINE_DB}}"
  export PG_USER="${PG_USER:-${WALINE_USER}}"
  export PG_PASSWORD="${PG_PASSWORD:-${WALINE_PASSWORD}}"

  log "starting server"
  (
    cd /app/server
    exec bash entrypoint.sh
  ) &
  server_pid=$!

  log "starting website"
  (
    cd /app/website
    exec sh entrypoint.sh
  ) &
  website_pid=$!

  log "starting Waline"
  (
    cd /app/waline
    exec sh entrypoint.sh
  ) &
  waline_pid=$!

  log "starting admin"
  nginx -g 'daemon off;' &
  admin_pid=$!

  wait_for_http "server" "http://127.0.0.1:3000/swagger"
  wait_for_http "website" "http://127.0.0.1:${WEBSITE_CONTROL_PORT}/health"
  wait_for_http "Waline" "http://127.0.0.1:${WALINE_CONTROL_PORT}/health"
  wait_for_http "admin" "http://127.0.0.1:3002/admin/"
}

start_caddy() {
  log "starting Caddy"
  caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
  caddy_pid=$!
  wait_for_http "public HTTP entrypoint" "http://127.0.0.1/"
}

cleanup() {
  set +e

  for pid in "${caddy_pid}" "${admin_pid}" "${waline_pid}" "${website_pid}" "${server_pid}" "${redis_pid}"; do
    if [[ -n "${pid}" ]]; then
      kill "${pid}" 2>/dev/null || true
    fi
  done

  if [[ -n "${postgres_pid}" ]]; then
    kill "${postgres_pid}" 2>/dev/null || true
  fi

  wait || true
}

trap cleanup EXIT INT TERM

ensure_directories
init_postgres
start_postgres
ensure_postgres_database "${POSTGRES_DB}"
ensure_postgres_database "${WALINE_DB}"
start_redis
start_apps
start_caddy

log "all services are up"
wait -n \
  "${postgres_pid}" \
  "${redis_pid}" \
  "${server_pid}" \
  "${website_pid}" \
  "${waline_pid}" \
  "${admin_pid}" \
  "${caddy_pid}"
log "a managed process exited; stopping container"
exit 1
