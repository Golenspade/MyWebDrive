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

PNPM_VERSION="9.7.0"
ensure_pnpm(){ if ! command -v pnpm >/dev/null 2>&1; then corepack enable >/dev/null 2>&1 || true; corepack prepare "pnpm@${PNPM_VERSION}" --activate >/dev/null 2>&1 || true; fi }

# --- 加载根目录 .env（如存在）---
if [ -f ".env" ]; then set -a; source .env; set +a; log_info ".env loaded"; fi

# --- 通用端口检查 ---
check_on_port(){ local port=$1; local pid=$(lsof -ti :$port 2>/dev/null | head -1 || true); [ -n "$pid" ] && echo "RUNNING (PID: $pid)" || echo "STOPPED"; }
kill_on_port(){ local port=$1; local pids=$(lsof -ti :$port 2>/dev/null || true); [ -n "$pids" ] && kill $pids 2>/dev/null || true; }

# --- 前端（cruip-landing Next）---
FRONTEND_PORT=${FRONTEND_PORT:-3100}
FRONTEND_HOST=${FRONTEND_HOST:-127.0.0.1}
start_frontend(){
  log_service "Starting frontend (cruip-landing) on :${FRONTEND_PORT}..."
  if [ "$(check_on_port $FRONTEND_PORT)" != "STOPPED" ]; then log_warn "Frontend already running"; return; fi
  mkdir -p logs
  (cd frontend/cruip-landing && \
    API_BASE_URL=${API_BASE_URL:-http://localhost:${GW_PORT:-9080}} \
    nohup pnpm exec next dev -H "${FRONTEND_HOST}" -p "${FRONTEND_PORT}" > ../../logs/frontend.log 2>&1 & echo $! > ../../logs/frontend.pid)
  sleep 2; kill -0 $(cat logs/frontend.pid) 2>/dev/null && log_info "Frontend started (PID: $(cat logs/frontend.pid))" || log_error "Frontend failed"
}
start_frontend_prod(){
  log_service "Starting frontend (cruip-landing) in production mode on :${FRONTEND_PORT}..."
  if [ "$(check_on_port $FRONTEND_PORT)" != "STOPPED" ]; then log_warn "Frontend already running"; return; fi
  mkdir -p logs
  log_info "Building frontend bundle"
  if ! (cd frontend/cruip-landing && API_BASE_URL=${API_BASE_URL:-http://localhost:${GW_PORT:-9080}} pnpm exec next build > ../../logs/frontend.build.log 2>&1); then
    log_error "Frontend build failed (see logs/frontend.build.log)"
    return 1
  fi
  log_info "Starting Next in standalone mode"
  (cd frontend/cruip-landing && \
    API_BASE_URL=${API_BASE_URL:-http://localhost:${GW_PORT:-9080}} \
    nohup pnpm exec next start -H "${FRONTEND_HOST}" -p "${FRONTEND_PORT}" > ../../logs/frontend.log 2>&1 & echo $! > ../../logs/frontend.pid)
  sleep 2; kill -0 $(cat logs/frontend.pid) 2>/dev/null && log_info "Frontend (prod) started (PID: $(cat logs/frontend.pid))" || log_error "Frontend (prod) failed"
}
stop_frontend(){
  log_service "Stopping frontend"
  kill_on_port "$FRONTEND_PORT"
  [ -f logs/frontend.pid ] && rm -f logs/frontend.pid
  log_info "Frontend stopped"
}

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
    AUTH_DATABASE_URL="${AUTH_DATABASE_URL}" \
    DATABASE_URL="${AUTH_DATABASE_URL:-$DATABASE_URL}" \
    nohup pnpm dev > ../../logs/auth.log 2>&1 & echo $! > ../../logs/auth.pid)
}
start_user(){
  log_service "Starting user (:${USER_PORT})..."
  if [ "$(check_on_port $USER_PORT)" != "STOPPED" ]; then log_warn "user already running"; return; fi
  mkdir -p logs
  (cd services/user && JWT_SECRET=${JWT_SECRET:-your-secret-key} USER_PORT=$USER_PORT \
    USER_DATABASE_URL="${USER_DATABASE_URL}" \
    DATABASE_URL="${USER_DATABASE_URL:-$DATABASE_URL}" \
    nohup pnpm dev > ../../logs/user.log 2>&1 & echo $! > ../../logs/user.pid)
}
start_metadata(){
  log_service "Starting metadata (:${META_PORT})..."
  if [ "$(check_on_port $META_PORT)" != "STOPPED" ]; then log_warn "metadata already running"; return; fi
  mkdir -p logs
  (pnpm --filter ./services/metadata prisma:generate > logs/metadata.prisma.log 2>&1 || true)
  (cd services/metadata && JWT_SECRET=${JWT_SECRET:-your-secret-key} METADATA_PORT=$META_PORT \
    METADATA_DATABASE_URL="${METADATA_DATABASE_URL:-file:./metadata.db}" \
    USER_SERVICE_URL="http://localhost:${USER_PORT}" \
    nohup pnpm dev > ../../logs/metadata.log 2>&1 & echo $! > ../../logs/metadata.pid)
}
start_storage(){
  log_service "Starting storage (:${STOR_PORT})..."
  if [ "$(check_on_port $STOR_PORT)" != "STOPPED" ]; then log_warn "storage already running"; return; fi
  mkdir -p logs storage/files storage/temp
  (pnpm --filter ./services/storage prisma:generate > logs/storage.prisma.log 2>&1 || true)
  (pnpm --filter ./services/storage db:push > logs/storage.dbpush.log 2>&1 || true)
  (cd services/storage && JWT_SECRET=${JWT_SECRET:-your-secret-key} STORAGE_PORT=$STOR_PORT \
    STORAGE_PATH="${STORAGE_PATH:-./storage}" METADATA_SERVICE_URL="${METADATA_SERVICE_URL:-http://localhost:${META_PORT}}" \

    STORAGE_DATABASE_URL="${STORAGE_DATABASE_URL:-file:./storage.db}" \

    REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}" \

    DOWNLOAD_CONCURRENCY_LIMIT="${DOWNLOAD_CONCURRENCY_LIMIT:-3}" \

    DOWNLOAD_Mbps="${DOWNLOAD_Mbps:-300}" \

    OWNER_COOKIE_SECRET="${OWNER_COOKIE_SECRET:-please-change-me}" \

    OWNER_COOKIE_TTL_SEC="${OWNER_COOKIE_TTL_SEC:-86400}" \

    nohup pnpm dev > ../../logs/storage.log 2>&1 & echo $! > ../../logs/storage.pid)
}
start_sharing(){
  log_service "Starting sharing (:${SHAR_PORT})..."
  if [ "$(check_on_port $SHAR_PORT)" != "STOPPED" ]; then log_warn "sharing already running"; return; fi
  mkdir -p logs
  (pnpm --filter ./services/sharing prisma:generate > logs/sharing.prisma.log 2>&1 || true)
  (pnpm --filter ./services/sharing db:push > logs/sharing.dbpush.log 2>&1 || true)
  (cd services/sharing && JWT_SECRET=${JWT_SECRET:-your-secret-key} SHARING_PORT=$SHAR_PORT \
    STORAGE_SERVICE_URL="${STORAGE_SERVICE_URL:-http://localhost:${STOR_PORT}}" METADATA_SERVICE_URL="${METADATA_SERVICE_URL:-http://localhost:${META_PORT}}" \

    SHARING_DATABASE_URL="${SHARING_DATABASE_URL:-file:./sharing.db}" \

    nohup pnpm dev > ../../logs/sharing.log 2>&1 & echo $! > ../../logs/sharing.pid)
}
start_gateway(){
  log_service "Starting API Gateway (:${GW_PORT})..."
  if [ "$(check_on_port $GW_PORT)" != "STOPPED" ]; then log_warn "gateway already running"; return; fi
  mkdir -p logs
  (pnpm --filter ./services/api-gateway-node prisma:generate > logs/gateway.prisma.log 2>&1 || true)
  (pnpm --filter ./services/api-gateway-node db:push > logs/gateway.dbpush.log 2>&1 || true)
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
  printf "%-24s %-8s %-22s\n" "Frontend (cruip)" "$FRONTEND_PORT" "$(check_on_port $FRONTEND_PORT)"
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

# --- Postgres DB via docker-compose ---
db_start(){
  log_service "Starting Postgres (docker-compose)"
  if [ -f infrastructure/docker-compose.db.yml ]; then
    docker compose -f infrastructure/docker-compose.db.yml up -d
    log_info "Postgres started (port 5432)"
  else
    log_error "infrastructure/docker-compose.db.yml not found"
    exit 1
  fi
}

db_stop(){
  log_service "Stopping Postgres"
  if [ -f infrastructure/docker-compose.db.yml ]; then
    docker compose -f infrastructure/docker-compose.db.yml down
    log_info "Postgres stopped"
  else
    log_error "infrastructure/docker-compose.db.yml not found"
    exit 1
  fi
}

db_reset(){
  log_service "Resetting Postgres volume (DANGEROUS: drops data)"
  if [ -f infrastructure/docker-compose.db.yml ]; then
    docker compose -f infrastructure/docker-compose.db.yml down -v
    docker compose -f infrastructure/docker-compose.db.yml up -d
    log_info "Postgres reset complete"
  else
    log_error "infrastructure/docker-compose.db.yml not found"
    exit 1
  fi
}

# --- 环境模板与工具 ---
print_common_env(){ cat <<EOF
# Common limits & Redis
DOWNLOAD_CONCURRENCY_LIMIT=3
DOWNLOAD_Mbps=300
REDIS_URL=redis://localhost:6379/0

# Owner cookie (same in auth & storage)
OWNER_COOKIE_SECRET=please-change-me
OWNER_COOKIE_TTL_SEC=86400
COOKIE_SECURE=false
# Generate hash via: node -e "console.log(require('bcryptjs').hashSync('your-owner-code', 10))"
OWNER_CODE_HASH=

# Aliyun RAM Role for STS
ALIYUN_ROLE_ARN=
GATEWAY_DATABASE_URL=file:./gateway.db
EOF
}
print_auth_env(){ cat <<EOF
# Auth service
AUTH_PORT=7081
JWT_SECRET=please-change-me
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=604800
REGISTRATION_REQUIRE_INVITE=true
EOF
}
print_storage_env(){ cat <<EOF
# Storage service
STORAGE_PORT=7084
STORAGE_PATH=./storage
USE_MINIO=false
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_USE_SSL=false
MINIO_BUCKET=mywebdrive
METADATA_SERVICE_URL=http://localhost:7083
EOF
}
cmd_env_print(){
  local svc="${1:-all}"
  case "$svc" in
    all) print_common_env; print_auth_env; print_storage_env ;;
    auth) print_common_env; print_auth_env ;;
    storage) print_common_env; print_storage_env ;;
    *) echo "[!] Unknown service for env: $svc (use all|auth|storage)" >&2; exit 1 ;;
  esac
}
cmd_env_write(){
  local out="${1:-.env.example}"
  echo "[i] Writing env template to $out"
  { print_common_env; print_auth_env; print_storage_env; } > "$out"
}

# --- PNPM 基础命令 ---
cmd_setup(){ corepack enable || true; corepack prepare "pnpm@${PNPM_VERSION}" --activate || true; pnpm --version; }
cmd_install(){ ensure_pnpm; pnpm install; }
cmd_build(){ ensure_pnpm; pnpm build:all; }

# --- 主入口 ---
case ${1:-status} in
  help|-h|--help)
    echo "Usage: $0 {setup|install|build|db:start|db:stop|db:reset|start|stop|restart|start-backend|stop-backend|start-frontend|start-frontend-prod|stop-frontend|start-next|status|env:print|env:write}" ;;
  setup)          cmd_setup ;;
  install)        cmd_install ;;
  build)          cmd_build ;;
  db:start)       db_start ;;
  db:stop)        db_stop ;;
  db:reset)       db_reset ;;
  start)
    start_backend
    if [ "${FRONTEND_MODE}" = "prod" ]; then
      start_frontend_prod
    else
      start_frontend
    fi
    ;;
  stop)           stop_frontend; stop_backend ;;
  restart)
    stop_frontend; stop_backend; start_backend
    if [ "${FRONTEND_MODE}" = "prod" ]; then
      start_frontend_prod
    else
      start_frontend
    fi
    ;;
  start-frontend) start_frontend ;;
  start-frontend-prod) start_frontend_prod ;;
  stop-frontend)  stop_frontend ;;
  start-backend)  start_backend ;;
  stop-backend)   stop_backend ;;
  start-next)     start_next ;;
  env:print)      shift; cmd_env_print "$@" ;;
  env:write)      shift; cmd_env_write "$@" ;;
  status)         show_status ;;
  *) echo "Usage: $0 {setup|install|build|start|stop|restart|start-backend|stop-backend|start-frontend|start-frontend-prod|stop-frontend|start-next|status|env:print|env:write}"; exit 1;;
esac
