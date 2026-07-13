#!/usr/bin/env bash

# Start all backend Node services via manage-services.sh with a simple health check.
# - Loads .env if present (managed by manage-services.sh)
# - Warns if Redis is not reachable (storage service depends on it)
# - Waits for gateway /health to become ready
# Usage:
#   bash scripts/start-backend-dev.sh                 # default gateway :9080
#   GATEWAY_PORT=9180 bash scripts/start-backend-dev.sh

set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

GW_PORT="${GATEWAY_PORT:-9080}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }

# Optional: quick Redis check (best-effort)
if bash -c 'exec 3<>/dev/tcp/127.0.0.1/6379' 2>/dev/null; then
  : # OK
else
  log_warn "Redis (127.0.0.1:6379) 不可达，storage 服务会反复报错；可先启动：brew services start redis 或 docker run -p 6379:6379 redis:7"
fi

log_info "启动后端服务 (gateway :${GW_PORT})"
bash ./manage-services.sh start-backend

log_info "等待 API Gateway 健康检查 /health 就绪..."
READY=0
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${GW_PORT}/health" >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  log_warn "等待超时，/health 暂不可用；请查看 logs/gateway.log"
else
  log_info "Gateway 就绪：http://127.0.0.1:${GW_PORT}/health"
fi

echo
log_info "当前服务状态："
bash ./manage-services.sh status || true

echo
log_info "日志位置：logs/*.log  示例：tail -f logs/gateway.log"

