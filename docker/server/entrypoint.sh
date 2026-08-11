#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" == "0" && "${VANBLOG_DROPPED_PRIVILEGES:-}" != "1" ]]; then
  mkdir -p /app/static /var/log /run/secrets/vanblog /home/vanblog/.config/aliyunpan
  chown -R vanblog:vanblog /app/static /var/log /run/secrets/vanblog /home/vanblog/.config/aliyunpan
  export VANBLOG_DROPPED_PRIVILEGES=1
  export HOME=/home/vanblog
  exec su-exec vanblog:vanblog bash "$(readlink -f "$0")" "$@"
fi

WALINE_SHARED_JWT="$(node /app/ensure-waline-jwt.cjs WALINE_JWT_TOKEN)"
export WALINE_JWT_TOKEN="${WALINE_SHARED_JWT}"
mkdir -p /run/secrets/vanblog
chmod 700 /run/secrets/vanblog
BACKUP_ENCRYPTION_KEY="$(
  VANBLOG_WALINE_JWT_FILE="${VANBLOG_BACKUP_ENCRYPTION_KEY_FILE:-/run/secrets/vanblog/backup-encryption.key}" \
    node /app/ensure-waline-jwt.cjs VANBLOG_BACKUP_ENCRYPTION_KEY
)"
export VANBLOG_BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"

node dist/src/main.js &
server_pid=$!

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

wait "${server_pid}"
