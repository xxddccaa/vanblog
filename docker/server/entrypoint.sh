#!/usr/bin/env bash
set -euo pipefail

WALINE_SHARED_JWT="$(node /app/ensure-waline-jwt.cjs WALINE_JWT_TOKEN)"
export WALINE_JWT_TOKEN="${WALINE_SHARED_JWT}"

ai_terminal_enabled="${VANBLOG_AI_TERMINAL_ENABLED:-${VAN_BLOG_AI_TERMINAL_ENABLED:-false}}"
ai_terminal_base="${VANBLOG_AI_TERMINAL_BASE:-/admin/ai-terminal}"
ai_terminal_home="${VANBLOG_AI_TERMINAL_HOME:-/app/ai-terminal-home}"
ai_terminal_workspace="${VANBLOG_AI_TERMINAL_WORKSPACE:-/workspace/vanblog}"

mkdir -p "${ai_terminal_home}"
mkdir -p "${ai_terminal_workspace}"

if [[ "${ai_terminal_enabled}" == "true" ]]; then
  export VANBLOG_AI_TERMINAL_HOME="${ai_terminal_home}"
  export VANBLOG_AI_TERMINAL_WORKSPACE="${ai_terminal_workspace}"
  wetty \
    --host 0.0.0.0 \
    --port 7681 \
    --base "${ai_terminal_base}" \
    --allow-iframe \
    --command /app/server/terminal-shell.sh &
  wetty_pid=$!
fi

node dist/src/main.js &
server_pid=$!

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" 2>/dev/null || true
  fi
  if [[ -n "${wetty_pid:-}" ]]; then
    kill "${wetty_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ -n "${wetty_pid:-}" ]]; then
  wait -n "${server_pid}" "${wetty_pid}"
else
  wait "${server_pid}"
fi
