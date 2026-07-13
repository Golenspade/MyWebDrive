#!/usr/bin/env bash

# Start Next.js frontend (cruip-landing) with safe defaults
# - Sets API_BASE_URL to the gateway
# - Mitigates EMFILE (too many open files) by raising ulimit or enabling polling
# Usage:
#   bash scripts/start-frontend-dev.sh            # default 127.0.0.1:3100 -> http://localhost:9080
#   PORT=3200 GATEWAY_PORT=9080 bash scripts/start-frontend-dev.sh
#   WATCHPACK_POLLING=true bash scripts/start-frontend-dev.sh  # force polling

set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FRONTEND_DIR="$ROOT_DIR/frontend/cruip-landing"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3100}"
GW_PORT="${GATEWAY_PORT:-9080}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:${GW_PORT}}"

cd "$FRONTEND_DIR"

# Try to mitigate EMFILE by increasing soft limit; fallback to polling if still low
_cur_limit=256
if (ulimit -n >/dev/null 2>&1); then
  _cur_limit=$(ulimit -n || echo 256)
  if [[ "${_cur_limit}" -lt 8192 ]]; then
    # best-effort increase
    ulimit -n 10000 >/dev/null 2>&1 || true
    _new_limit=$(ulimit -n || echo 256)
    if [[ "${_new_limit}" -lt 8192 ]]; then
      # enable polling as fallback
      export WATCHPACK_POLLING=${WATCHPACK_POLLING:-true}
      export WATCHPACK_POLL_INTERVAL=${WATCHPACK_POLL_INTERVAL:-1000}
      echo "[start-frontend-dev] Using polling watcher (limit=$_new_limit)"
    else
      echo "[start-frontend-dev] Raised ulimit -n to $_new_limit"
    fi
  fi
fi

echo "[start-frontend-dev] Host=$HOST Port=$PORT API_BASE_URL=$API_BASE_URL"
echo "[start-frontend-dev] Enabling polling watcher to avoid EMFILE"
export WATCHPACK_POLLING=${WATCHPACK_POLLING:-true}
export WATCHPACK_POLL_INTERVAL=${WATCHPACK_POLL_INTERVAL:-1000}
echo "[start-frontend-dev] Starting Next.js dev server..."

exec pnpm exec next dev -H "$HOST" -p "$PORT"
