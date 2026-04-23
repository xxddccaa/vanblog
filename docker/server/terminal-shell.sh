#!/usr/bin/env bash
set -euo pipefail

export HOME="${VANBLOG_AI_TERMINAL_HOME:-/app/ai-terminal-home}"
workspace_dir="${VANBLOG_AI_TERMINAL_WORKSPACE:-/workspace/vanblog}"

mkdir -p "${HOME}"

if [ -d "${workspace_dir}" ]; then
  cd "${workspace_dir}"
fi

exec bash
