#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ] && [ "${VANBLOG_DROPPED_PRIVILEGES:-}" != "1" ]; then
  mkdir -p /var/log
  chown -R vanblog:vanblog /var/log
  export VANBLOG_DROPPED_PRIVILEGES=1
  export HOME=/home/vanblog
  exec su-exec vanblog:vanblog sh "$(readlink -f "$0")" "$@"
fi

# WALINE_JWT_TOKEN is the pre-rename name of the shared secret and stays a fallback.
SHARED_SECRET="$(node /app/ensure-shared-secret.cjs VANBLOG_SHARED_SECRET WALINE_JWT_TOKEN)"
export VANBLOG_SHARED_SECRET="${SHARED_SECRET}"

exec node runner.cjs
