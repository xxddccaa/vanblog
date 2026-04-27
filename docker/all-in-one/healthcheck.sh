#!/usr/bin/env bash
set -euo pipefail

POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-vanblog}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
REDIS_PORT="${REDIS_PORT:-6379}"
WEBSITE_CONTROL_PORT="${WEBSITE_CONTROL_PORT:-3011}"
WALINE_CONTROL_PORT="${WALINE_CONTROL_PORT:-8361}"

pg_isready -h 127.0.0.1 -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null
redis-cli -h 127.0.0.1 -p "${REDIS_PORT}" ping | grep -q PONG
wget -q -O /dev/null http://127.0.0.1:3000/swagger
wget -q -O /dev/null http://127.0.0.1:${WEBSITE_CONTROL_PORT}/health
wget -q -O /dev/null http://127.0.0.1:${WALINE_CONTROL_PORT}/health
wget -q -O /dev/null http://127.0.0.1:3002/admin/
wget -q -O /dev/null http://127.0.0.1/
