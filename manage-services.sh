#!/bin/bash
# MyWebDrive 服务管理脚本（Node-only，已移除 Go 分支）
# 用法: ./manage-services.sh [start|stop|restart|start-backend|stop-backend|start-frontend|stop-frontend|start-next|status]
set -e

# --- 彩色输出 ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }
log_service(){ echo -e "${BLUE}[SERVICE]${NC} $1"; }

# --- 加载根目录 .env（如存在）---
if [ -f ".env" ]; then set -a; source .env; set +a; log_info ".env loaded"; fi

# --- 通用端口检查 ---
check_on_port(){ local port=$1; local pid=$(lsof -ti :$port 2>/dev/null | head -1 || true); [ -n "$pid" ] && echo "RUNNING (PID: $pid)" || echo "STOPPED"; }
kill_on_port(){ local port=$1; local pids=$(lsof -ti :$port 2>/dev/null || true); [ -n "$pids" ] && kill $pids 2>/dev/null || true; }

# --- 前端（Vite 3000）---
start_frontend(){
  log_service "Starting frontend (Vite) on :3000..."
  if [ "$(check_on_port 3000)" != "STOPPED" ]; then log_warn "Frontend already running"; return; fi
  mkdir -p logs
  (cd frontend && nohup npm run dev > ../logs/frontend.log 2>&1 & echo $! > ../logs/frontend.pid)
  sleep 2; kill -0 $(cat logs/frontend.pid) 2>/dev/null && log_info "Frontend started (PID: $(cat logs/frontend.pid))" || log_error "Frontend failed"
}
stop_frontend(){ log_service "Stopping frontend"; kill_on_port 3000; log_info "Frontend stopped"; }

# --- Node 微服务端口 ---
GW_PORT=${GATEWAY_PORT:-9080}
AUTH_PORT=${AUTH_PORT:-7081}
USER_PORT=${USER_PORT:-7082}
META_PORT=${METADATA_PORT:-7083}
STOR_PORT=${STORAGE_PORT:-7084}
SHAR_PORT=${SHARING_PORT:-7085}

# --- 启动各 Node 服务 ---
start_auth(){
  log_service "Starting auth (:${AUTH_PORT})..."
  if [ "$(check_on_port $AUTH_PORT)" != "STOPPED" ]; then log_warn "auth already running"; return; fi
  mkdir -p logs
  (cd services/auth && JWT_SECRET=${JWT_SECRET:-your-secret-key} AUTH_PORT=$AUTH_PORT \
    nohup pnpm dev > ../../logs/auth.log 2>&1 & echo $! > ../../logs/auth.pid)
}
start_user(){
  log_service "Starting user (:${USER_PORT})..."
  if [ "$(check_on_port $USER_PORT)" != "STOPPED" ]; then log_warn "user already running"; return; fi
  mkdir -p logs
  (cd services/user && JWT_SECRET=${JWT_SECRET:-your-secret-key} USER_PORT=$USER_PORT \
    nohup pnpm dev > ../../logs/user.log 2>&1 & echo $! > ../../logs/user.pid)
}
start_metadata(){
  log_service "Starting metadata (:${META_PORT})..."
  if [ "$(check_on_port $META_PORT)" != "STOPPED" ]; then log_warn "metadata already running"; return; fi
  mkdir -p logs
  (pnpm --filter ./services/metadata prisma:generate > logs/metadata.prisma.log 2>&1 || true)
  (cd services/metadata && JWT_SECRET=${JWT_SECRET:-your-secret-key} METADATA_PORT=$META_PORT \
    METADATA_DATABASE_URL=${METADATA_DATABASE_URL:-file:./metadata.db} \
    nohup pnpm dev > ../../logs/metadata.log 2>&1 & echo $! > ../../logs/metadata.pid)
}
start_storage(){
  log_service "Starting storage (:${STOR_PORT})..."
  if [ "$(check_on_port $STOR_PORT)" != "STOPPED" ]; then log_warn "storage already running"; return; fi
  mkdir -p logs storage/files storage/temp
  (pnpm --filter ./services/storage prisma:generate > logs/storage.prisma.log 2>&1 || true)
  (pnpm --filter ./services/storage db:push > logs/storage.dbpush.log 2>&1 || true)
  (cd services/storage && JWT_SECRET=${JWT_SECRET:-your-secret-key} STORAGE_PORT=$STOR_PORT \
    STORAGE_PATH=${STORAGE_PATH:-./storage} METADATA_SERVICE_URL=${METADATA_SERVICE_URL:-http://localhost:${META_PORT}} \
    STORAGE_DATABASE_URL=${STORAGE_DATABASE_URL:-file:./storage.db} \
    nohup pnpm dev > ../../logs/storage.log 2>&1 & echo $! > ../../logs/storage.pid)
}
start_sharing(){
  log_service "Starting sharing (:${SHAR_PORT})..."
  if [ "$(check_on_port $SHAR_PORT)" != "STOPPED" ]; then log_warn "sharing already running"; return; fi
  mkdir -p logs
  (pnpm --filter ./services/sharing prisma:generate > logs/sharing.prisma.log 2>&1 || true)
  (pnpm --filter ./services/sharing db:push > logs/sharing.dbpush.log 2>&1 || true)
  (cd services/sharing && JWT_SECRET=${JWT_SECRET:-your-secret-key} SHARING_PORT=$SHAR_PORT \
    STORAGE_SERVICE_URL=${STORAGE_SERVICE_URL:-http://localhost:${STOR_PORT}} METADATA_SERVICE_URL=${METADATA_SERVICE_URL:-http://localhost:${META_PORT}} \
    SHARING_DATABASE_URL=${SHARING_DATABASE_URL:-file:./sharing.db} \
    nohup pnpm dev > ../../logs/sharing.log 2>&1 & echo $! > ../../logs/sharing.pid)
}
start_gateway(){
  log_service "Starting API Gateway (:${GW_PORT})..."
  if [ "$(check_on_port $GW_PORT)" != "STOPPED" ]; then log_warn "gateway already running"; return; fi
  mkdir -p logs
  (cd services/api-gateway-node && GATEWAY_PORT=$GW_PORT JWT_SECRET=${JWT_SECRET:-your-secret-key} \
    AUTH_SERVICE_URL=${AUTH_SERVICE_URL:-http://localhost:${AUTH_PORT}} \
    USER_SERVICE_URL=${USER_SERVICE_URL:-http://localhost:${USER_PORT}} \
    METADATA_SERVICE_URL=${METADATA_SERVICE_URL:-http://localhost:${META_PORT}} \
    STORAGE_SERVICE_URL=${STORAGE_SERVICE_URL:-http://localhost:${STOR_PORT}} \
    SHARING_SERVICE_URL=${SHARING_SERVICE_URL:-http://localhost:${SHAR_PORT}} \
    nohup ./node_modules/.bin/tsx src/index.ts > ../../logs/gateway.log 2>&1 & echo $! > ../../logs/gateway.pid)
}

# --- 汇总启动/停止 ---
start_backend(){
  JWT_SECRET=${JWT_SECRET:-your-secret-key}
  mkdir -p logs
  start_auth; start_user; start_metadata; start_storage; start_sharing; start_gateway
  log_info "Backend started (gateway :${GW_PORT})"
}
stop_backend(){
  log_service "Stopping backend services"
  for p in $GW_PORT $AUTH_PORT $USER_PORT $META_PORT $STOR_PORT $SHAR_PORT; do kill_on_port $p; done
  log_info "Backend stopped"
}

# --- 状态 ---
show_status(){
  echo "================================ STATUS ================================"
  printf "%-24s %-8s %-22s\n" "Service" "Port" "Status"
  echo "------------------------------------------------------------------------"
  printf "%-24s %-8s %-22s\n" "Frontend (Vite)" "3000" "$(check_on_port 3000)"
  printf "%-24s %-8s %-22s\n" "API Gateway" "$GW_PORT" "$(check_on_port $GW_PORT)"
  printf "%-24s %-8s %-22s\n" "Auth Service" "$AUTH_PORT" "$(check_on_port $AUTH_PORT)"
  printf "%-24s %-8s %-22s\n" "User Service" "$USER_PORT" "$(check_on_port $USER_PORT)"
  printf "%-24s %-8s %-22s\n" "Metadata Service" "$META_PORT" "$(check_on_port $META_PORT)"
  printf "%-24s %-8s %-22s\n" "Storage Service" "$STOR_PORT" "$(check_on_port $STOR_PORT)"
  printf "%-24s %-8s %-22s\n" "Sharing Service" "$SHAR_PORT" "$(check_on_port $SHAR_PORT)"
  echo "========================================================================"
}

# --- Next.js （可选）---
start_next(){
  log_service "Starting Next dev (apps/web) on :4000..."
  if [ "$(check_on_port 4000)" != "STOPPED" ]; then log_warn "Next already running"; return; fi
  mkdir -p logs
  (cd apps/web && API_BASE_URL="http://localhost:${GW_PORT}" nohup pnpm dev > ../../logs/next.log 2>&1 & echo $! > ../../logs/next.pid)
}

# --- 主入口 ---
case ${1:-status} in
  start)         start_backend; start_frontend ;;
  stop)          stop_frontend; stop_backend ;;
  restart)       stop_frontend; stop_backend; start_backend; start_frontend ;;
  start-frontend) start_frontend ;;
  stop-frontend)  stop_frontend ;;
  start-backend)  start_backend ;;
  stop-backend)   stop_backend ;;
  start-next)     start_next ;;
  status)         show_status ;;
  *) echo "Usage: $0 {start|stop|restart|start-backend|stop-backend|start-frontend|stop-frontend|start-next|status}"; exit 1;;
esac
