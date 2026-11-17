#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" == "0" && "${VANBLOG_DROPPED_PRIVILEGES:-}" != "1" ]]; then
  mkdir -p /app/static /var/log /run/secrets/vanblog /home/vanblog/.config/aliyunpan
  chown -R vanblog:vanblog /app/static /var/log /run/secrets/vanblog /home/vanblog/.config/aliyunpan
  export VANBLOG_DROPPED_PRIVILEGES=1
  export HOME=/home/vanblog
  exec su-exec vanblog:vanblog bash "$(readlink -f "$0")" "$@"
fi

# WALINE_JWT_TOKEN is the pre-rename name of the shared secret and stays a fallback.
SHARED_SECRET="$(node /app/ensure-shared-secret.cjs VANBLOG_SHARED_SECRET WALINE_JWT_TOKEN)"
export VANBLOG_SHARED_SECRET="${SHARED_SECRET}"
mkdir -p /run/secrets/vanblog
chmod 700 /run/secrets/vanblog
BACKUP_ENCRYPTION_KEY="$(
  VANBLOG_SHARED_SECRET_FILE="${VANBLOG_BACKUP_ENCRYPTION_KEY_FILE:-/run/secrets/vanblog/backup-encryption.key}" \
    VANBLOG_SHARED_SECRET_LEGACY_FILE="" \
    node /app/ensure-shared-secret.cjs VANBLOG_BACKUP_ENCRYPTION_KEY
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
