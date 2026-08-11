#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ] && [ "${VANBLOG_DROPPED_PRIVILEGES:-}" != "1" ]; then
  mkdir -p /var/log
  chown -R vanblog:vanblog /var/log
  export VANBLOG_DROPPED_PRIVILEGES=1
  export HOME=/home/vanblog
  exec su-exec vanblog:vanblog sh "$(readlink -f "$0")" "$@"
fi

WALINE_SHARED_JWT="$(node /app/ensure-waline-jwt.cjs WALINE_JWT_TOKEN)"
export WALINE_JWT_TOKEN="${WALINE_SHARED_JWT}"

exec node runner.cjs
