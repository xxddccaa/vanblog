#!/usr/bin/env bash
set -euo pipefail

WALINE_SHARED_JWT="$(node /app/ensure-waline-jwt.cjs WALINE_JWT_TOKEN)"
export WALINE_JWT_TOKEN="${WALINE_SHARED_JWT}"

node dist/src/main.js &
server_pid=$!

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

wait "${server_pid}"
