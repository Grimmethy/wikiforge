#!/usr/bin/env bash
# Starts WikiForge as a standalone background process, same convention as the
# PromptForge/ScriptForge companions -- agent-manager's dashboard does not manage this
# process (its plugin-tab mechanism doesn't yet support a tab for a process-managed
# plugin, see docs/PLUGIN_API.md "Not yet built" in agent-manager); this script is the
# equivalent of those companions' own launch step.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${WIKIFORGE_SECOND_BRAIN_ROOT:=/media/wok/model-cache/SecondBrain}"
: "${WIKIFORGE_PORT:=7421}"
export WIKIFORGE_SECOND_BRAIN_ROOT WIKIFORGE_PORT

STATE_DIR="${HOME}/.local/state/wikiforge"
mkdir -p "${STATE_DIR}"
PID_FILE="${STATE_DIR}/wikiforge.pid"
LOG_FILE="${STATE_DIR}/wikiforge.log"

if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "wikiforge already running (pid $(cat "${PID_FILE}"))"
  exit 0
fi

cd "${REPO_DIR}"
nohup node src/server.js >>"${LOG_FILE}" 2>&1 &
echo $! > "${PID_FILE}"
echo "wikiforge started (pid $!), logging to ${LOG_FILE}, listening on :${WIKIFORGE_PORT}"
