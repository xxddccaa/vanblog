#!/bin/sh
set -eu

WALINE_SHARED_JWT="$(node /app/ensure-waline-jwt.cjs WALINE_JWT_TOKEN)"
export WALINE_JWT_TOKEN="${WALINE_SHARED_JWT}"

exec node runner.cjs
