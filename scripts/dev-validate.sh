#!/usr/bin/env bash

# Local dev startup and validation for unified Next proxy (4000)
# - Starts Go backend services
# - Starts Next (4000) and Vite (3000)
# - Verifies basic reachability and proxy behavior

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing required command: $1"; return 1
  fi
}

wait_for_port() {
  local port="$1"; local name="$2"; local tries=${3:-60}
  for i in $(seq 1 "$tries"); do
    if nc -z localhost "$port" >/dev/null 2>&1; then
      info "$name is up on :$port"
      return 0
    fi
    sleep 0.5
  done
  error "Timeout waiting for $name on :$port"; return 1
}

main() {
  mkdir -p logs

  # 0) Node & pnpm
  require_cmd node || exit 1
  if ! command -v pnpm >/dev/null 2>&1; then
    warn "pnpm not found; enabling via corepack"
    if command -v corepack >/dev/null 2>&1; then
      corepack enable || true
      corepack prepare pnpm@9.7.0 --activate || true
    else
      error "corepack not available; install pnpm manually"
      exit 1
    fi
  fi

  # 1) Install deps
  info "Installing workspace dependencies (pnpm -w install)"
  pnpm -w install

  # Build shared packages for runtime (e.g., @mywebdrive/common)
  info "Building shared packages"
  pnpm -r --filter ./packages/** run build || true

  # 2) Ensure Next env
  if [ ! -f apps/web/.env.local ]; then
    local api_base="${API_BASE_URL:-http://localhost:8080}"
    info "Creating apps/web/.env.local (API_BASE_URL=$api_base)"
    echo "API_BASE_URL=$api_base" > apps/web/.env.local
  else
    info "apps/web/.env.local present"
  fi

  # 3) Start backend services (Go gateway + services)
  info "Starting backend services via manage-services.sh"
  ./manage-services.sh start-backend

  # 4) Start Node gateway (9080)
  info "Starting Node API gateway on :9080"
  pnpm --filter ./services/api-gateway-node dev > logs/gateway-node.log 2>&1 &
  GATEWAY_NODE_PID=$!

  # 5) Start Next (4000) and Vite (3000)
  info "Starting Next (apps/web) on :4000"
  pnpm --filter ./apps/web dev > logs/next-dev.log 2>&1 &
  NEXT_PID=$!
  info "Starting Vite (frontend) on :3000"
  pnpm --filter ./frontend dev > logs/vite-dev.log 2>&1 &
  VITE_PID=$!

  cleanup() {
    warn "Shutting down dev processes..."
    kill "$NEXT_PID" "$VITE_PID" "$GATEWAY_NODE_PID" >/dev/null 2>&1 || true
    warn "Stopping backend services..."
    ./manage-services.sh stop-backend || true
  }
  trap cleanup EXIT INT TERM

  # 6) Wait for ports
  wait_for_port 8080 "API Gateway"
  wait_for_port 9080 "Node API Gateway"
  wait_for_port 3000 "Vite"
  wait_for_port 4000 "Next"

  # 7) Sanity checks
  info "Checking Next homepage: http://localhost:4000"
  if ! curl -fsS http://localhost:4000 >/dev/null; then
    error "Next homepage not reachable"; exit 1
  fi

  info "Checking API Gateway health: http://localhost:8080/health"
  if ! curl -fsS http://localhost:8080/health >/dev/null; then
    error "API Gateway /health not reachable"; exit 1
  fi

  info "Verifying Next -> Node gateway proxy: GET /api/v1/auth/login (expect 404/405/401)"
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/v1/auth/login || true)
  case "$code" in
    200|401|404|405)
      info "Proxy reachable (status=$code)"
      ;;
    *)
      warn "Unexpected status=$code; proxy may still be fine depending on services"
      ;;
  esac

  echo
  info "Dev is up!"
  echo "- Next:         http://localhost:4000 (unified dev entry)"
  echo "- Vite:         http://localhost:3000 (HMR direct debug)"
  echo "- Go Gateway:   http://localhost:8080"
  echo "- Node Gateway: http://localhost:9080"
  echo
  echo "Logs: logs/next-dev.log, logs/vite-dev.log, logs/gateway-node.log"
  echo "Press Ctrl+C to stop and cleanup."

  # Keep script running to hold background processes
  wait
}

main "$@"
