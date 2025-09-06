#!/bin/bash

# MyWebDrive 服务管理脚本
# 使用方法: ./manage-services.sh [command]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_service() {
    echo -e "${BLUE}[SERVICE]${NC} $1"
}

# 自动加载根目录 .env（如存在），导出为环境变量
if [ -f ".env" ]; then
    # shellcheck disable=SC2046
    set -a
    # 使用 bash 内置 source 加载键值对
    # 支持以 # 开头的注释
    source .env
    set +a
    log_info ".env loaded into environment"
fi

# 检查前端服务状态
check_frontend() {
    local pid=$(lsof -ti :3000 2>/dev/null | head -1 || echo "")
    if [ -n "$pid" ]; then
        echo "RUNNING (PID: $pid)"
        return 0
    else
        echo "STOPPED"
        return 1
    fi
}

# 检查后端服务状态
check_backend_service() {
    local port=$1
    local service_name=$2
    local pid=$(lsof -ti :$port 2>/dev/null | head -1 || echo "")
    if [ -n "$pid" ]; then
        echo "RUNNING (PID: $pid)"
        return 0
    else
        echo "STOPPED"
        return 1
    fi
}

# 停止前端服务
stop_frontend() {
    log_service "Stopping frontend service..."
    local pids=$(lsof -ti :3000 2>/dev/null || echo "")
    if [ -n "$pids" ]; then
        for pid in $pids; do
            kill $pid 2>/dev/null || true
        done
        log_info "Frontend service stopped"
    else
        log_warn "Frontend service is not running"
    fi
}

# 停止后端服务
stop_backend() {
    log_service "Stopping backend services..."

    # Decide which metadata service port to stop based on env
    local metadata_port
    if [ "${USE_NODE_METADATA}" = "true" ]; then
        metadata_port=7083
    else
        metadata_port=8083
    fi

    # Storage/Sharing dynamic ports
    local storage_port
    if [ "${USE_NODE_STORAGE}" = "true" ]; then storage_port=7084; else storage_port=8084; fi
    local sharing_port
    if [ "${USE_NODE_SHARING}" = "true" ]; then sharing_port=7085; else sharing_port=8085; fi

    local services=(
        "8080:api-gateway"
        "8081:auth-service"
        "8082:user-service"
        "${metadata_port}:metadata-service"
        "${storage_port}:storage-service"
        "${sharing_port}:sharing-service"
    )

    for service_port in "${services[@]}"; do
        IFS=':' read -r port service <<< "$service_port"
        local pids=$(lsof -ti :$port 2>/dev/null || echo "")
        if [ -n "$pids" ]; then
            for pid in $pids; do
                kill $pid 2>/dev/null || true
            done
            log_info "$service stopped"
        else
            log_warn "$service is not running"
        fi
    done
}

# 启动前端服务
start_frontend() {
    log_service "Starting frontend service..."
    if check_frontend > /dev/null; then
        log_warn "Frontend service is already running"
        return
    fi
    
    cd frontend
    nohup npm run dev > ../logs/frontend.log 2>&1 &
    local pid=$!
    cd ..
    
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_info "Frontend service started (PID: $pid)"
    else
        log_error "Failed to start frontend service"
    fi
}

# 启动后端服务
start_backend() {
    log_service "Starting backend services..."
    
    # 创建必要的目录
    mkdir -p data storage logs bin
    
    # 设置Go代理
    export GOPROXY=https://goproxy.cn,direct

    # 统一设置 JWT 秘钥，确保网关与各服务验证一致（若未通过 .env 设置）
    if [ -z "$JWT_SECRET" ]; then
        export JWT_SECRET="your-secret-key"
        log_warn "JWT_SECRET not set, using default placeholder (dev only)"
    fi

    # 编译所有服务（如果需要）
    if [ ! -f "bin/auth-service" ] || [ ! -f "bin/user-service" ] || [ ! -f "bin/metadata-service" ] || [ ! -f "bin/storage-service" ] || [ ! -f "bin/sharing-service" ] || [ ! -f "bin/api-gateway" ]; then
        # Go 版本后端已移除，此处不再编译；Node 版由 pnpm 构建/启动。
        log_info "Skipping Go builds: repository has migrated to Node services."
    fi

    # 启动服务
    # 可选：使用 Node 版元数据服务（USE_NODE_METADATA=true 时）
    if [ "${USE_NODE_METADATA}" = "true" ]; then
        start_metadata_node
    else
        # 启动 Go 元数据服务
        local service="metadata-service"
        local port=8083
        if ! check_backend_service $port $service > /dev/null; then
            nohup ./bin/$service > logs/$service.log 2>&1 &
            local pid=$!
            echo $pid > logs/$service.pid
            sleep 2
            if kill -0 $pid 2>/dev/null; then
                log_info "$service started on port $port (PID: $pid)"
            else
                log_error "Failed to start $service"
            fi
        else
            log_warn "$service is already running on port $port"
        fi
    fi

    # Storage service (Go or Node)
    if [ "${USE_NODE_STORAGE}" = "true" ]; then
        start_storage_node
    else
        local service="storage-service"; local port=8084
        if ! check_backend_service $port $service > /dev/null; then
            nohup ./bin/$service > logs/$service.log 2>&1 &
            local pid=$!; echo $pid > logs/$service.pid; sleep 2
            if kill -0 $pid 2>/dev/null; then log_info "$service started on port $port (PID: $pid)"; else log_error "Failed to start $service"; fi
        else
            log_warn "$service is already running on port $port"
        fi
    fi

    # Sharing service (Go or Node)
    if [ "${USE_NODE_SHARING}" = "true" ]; then
        start_sharing_node
    else
        local service="sharing-service"; local port=8085
        if ! check_backend_service $port $service > /dev/null; then
            nohup ./bin/$service > logs/$service.log 2>&1 &
            local pid=$!; echo $pid > logs/$service.pid; sleep 2
            if kill -0 $pid 2>/dev/null; then log_info "$service started on port $port (PID: $pid)"; else log_error "Failed to start $service"; fi
        else
            log_warn "$service is already running on port $port"
        fi
    fi

    # 其余 Go 服务
    local go_services=(
        "auth-service:8081"
        "user-service:8082"
        "api-gateway:8080"
    )
    for service_port in "${go_services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        if check_backend_service $port $service > /dev/null; then
            log_warn "$service is already running on port $port"
            continue
        fi
        # If starting api-gateway (Go), auto-point to Node services when toggles are enabled
        if [ "$service" = "api-gateway" ]; then
            # Respect existing env if user already set explicit URLs
            if [ "${USE_NODE_METADATA}" = "true" ] && [ -z "${METADATA_SERVICE_URL}" ]; then export METADATA_SERVICE_URL="http://localhost:7083"; fi
            if [ "${USE_NODE_STORAGE}" = "true" ] && [ -z "${STORAGE_SERVICE_URL}" ]; then export STORAGE_SERVICE_URL="http://localhost:7084"; fi
            if [ "${USE_NODE_SHARING}" = "true" ] && [ -z "${SHARING_SERVICE_URL}" ]; then export SHARING_SERVICE_URL="http://localhost:7085"; fi
        fi
        nohup ./bin/$service > logs/$service.log 2>&1 &
        local pid=$!
        echo $pid > logs/$service.pid
        sleep 2
        if kill -0 $pid 2>/dev/null; then
            log_info "$service started on port $port (PID: $pid)"
        else
            log_error "Failed to start $service"
        fi
    done
}

# 显示服务状态
show_status() {
    log_info "Service Status:"
    echo "=============================================================================="
    printf "%-20s %-10s %-20s\n" "Service" "Port" "Status"
    echo "=============================================================================="
    
    # 前端状态
    local frontend_status=$(check_frontend)
    printf "%-20s %-10s %-20s\n" "Frontend (React)" "3000" "$frontend_status"
    
    # 后端服务状态
    # 动态展示元数据服务端口
    local metadata_label="Metadata Service"
    local metadata_port
    if [ "${USE_NODE_METADATA}" = "true" ]; then
        metadata_label="Metadata Service (Node)"
        metadata_port=7083
    else
        metadata_port=8083
    fi

    local storage_label="Storage Service"; local storage_port=8084
    if [ "${USE_NODE_STORAGE}" = "true" ]; then storage_label="Storage Service (Node)"; storage_port=7084; fi
    local sharing_label="Sharing Service"; local sharing_port=8085
    if [ "${USE_NODE_SHARING}" = "true" ]; then sharing_label="Sharing Service (Node)"; sharing_port=7085; fi

    local services=(
        "API Gateway:8080"
        "Auth Service:8081"
        "User Service:8082"
        "${metadata_label}:${metadata_port}"
        "${storage_label}:${storage_port}"
        "${sharing_label}:${sharing_port}"
    )
    
    for service_port in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        local status=$(check_backend_service $port "$service")
        printf "%-20s %-10s %-20s\n" "$service" "$port" "$status"
    done
    
    echo "=============================================================================="

    # Node 网关状态（可选）
    local node_gw_port=${GATEWAY_PORT:-9080}
    local node_gw_status=$(check_backend_service $node_gw_port "API Gateway (Node)")
    printf "%-20s %-10s %-20s\n" "API Gateway (Node)" "$node_gw_port" "$node_gw_status"
}

# 重启所有服务
restart_all() {
    log_info "Restarting all services..."
    stop_all
    sleep 3
    start_all
}

# 启动所有服务
start_all() {
    start_backend
    sleep 3
    start_frontend
    log_info "All services started!"
    log_info "Frontend (Vite): http://localhost:3000"
    local gw_port=${GATEWAY_PORT:-8080}
    log_info "Backend API (Go): http://localhost:${gw_port}"
}

# 停止所有服务
stop_all() {
    stop_frontend
    stop_backend
    log_info "All services stopped!"
}

# --- Node helpers (must be defined before use) ---
start_metadata_node() {
    log_service "Starting metadata-service (Node) on 7083..."
    local port=7083
    local service_name="metadata-service-node"
    if check_backend_service $port $service_name > /dev/null; then
        log_warn "$service_name is already running on port $port"
        return
    fi

    mkdir -p logs
    # Generate Prisma client quietly (best-effort)
    (pnpm --filter ./services/metadata prisma:generate > logs/${service_name}.prisma.log 2>&1 || true)

    JWT_SECRET=${JWT_SECRET:-your-secret-key} \
    METADATA_PORT=${METADATA_PORT:-7083} \
    METADATA_DATABASE_URL=${METADATA_DATABASE_URL:-file:./metadata.db} \
    nohup pnpm --filter ./services/metadata dev > logs/${service_name}.log 2>&1 &
    local pid=$!
    echo $pid > logs/${service_name}.pid
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_info "$service_name started on port $port (PID: $pid)"
    else
        log_error "Failed to start $service_name"
    fi
}

start_storage_node() {
    log_service "Starting storage-service (Node) on 7084..."
    local port=7084
    local service_name="storage-service-node"
    if check_backend_service $port $service_name > /dev/null; then
        log_warn "$service_name is already running on port $port"
        return
    fi
    mkdir -p logs storage/files storage/temp
    # Generate Prisma client and push schema (best-effort)
    (pnpm --filter ./services/storage prisma:generate > logs/${service_name}.prisma.log 2>&1 || true)
    (pnpm --filter ./services/storage db:push > logs/${service_name}.dbpush.log 2>&1 || true)
    JWT_SECRET=${JWT_SECRET:-your-secret-key} 
    STORAGE_PORT=${STORAGE_PORT:-7084} \
    STORAGE_PATH=${STORAGE_PATH:-./storage} \
    METADATA_SERVICE_URL=${METADATA_SERVICE_URL:-http://localhost:7083} \
    STORAGE_DATABASE_URL=${STORAGE_DATABASE_URL:-file:./storage.db} \
    nohup pnpm --filter ./services/storage dev > logs/${service_name}.log 2>&1 &
    local pid=$!
    echo $pid > logs/${service_name}.pid
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_info "$service_name started on port $port (PID: $pid)"
    else
        log_error "Failed to start $service_name"
    fi
}

start_sharing_node() {
    log_service "Starting sharing-service (Node) on 7085..."
    local port=7085
    local service_name="sharing-service-node"
    if check_backend_service $port $service_name > /dev/null; then
        log_warn "$service_name is already running on port $port"
        return
    fi
    mkdir -p logs
    # Generate Prisma client and push schema (best-effort)
    (pnpm --filter ./services/sharing prisma:generate > logs/${service_name}.prisma.log 2>&1 || true)
    (pnpm --filter ./services/sharing db:push > logs/${service_name}.dbpush.log 2>&1 || true)
    JWT_SECRET=${JWT_SECRET:-your-secret-key} \
    SHARING_PORT=${SHARING_PORT:-7085} \
    STORAGE_SERVICE_URL=${STORAGE_SERVICE_URL:-http://localhost:7084} \
    METADATA_SERVICE_URL=${METADATA_SERVICE_URL:-http://localhost:7083} \
    SHARING_DATABASE_URL=${SHARING_DATABASE_URL:-file:./sharing.db} \
    nohup pnpm --filter ./services/sharing dev > logs/${service_name}.log 2>&1 &
    local pid=$!
    echo $pid > logs/${service_name}.pid
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_info "$service_name started on port $port (PID: $pid)"
    else
        log_error "Failed to start $service_name"
    fi
}

# 启动 Node 版 API 网关（默认端口 9080，可通过 GATEWAY_PORT 覆盖）
start_gateway_node() {
    log_service "Starting API Gateway (Node)..."
    local port=${GATEWAY_PORT:-9080}
    local service_name="api-gateway-node"
    if check_backend_service $port $service_name > /dev/null; then
        log_warn "$service_name is already running on port $port"
        return
    fi
    mkdir -p logs
    (
      cd services/api-gateway-node
      GATEWAY_PORT=$port \
      JWT_SECRET=${JWT_SECRET:-your-secret-key} \
      AUTH_SERVICE_URL=${AUTH_SERVICE_URL:-http://localhost:7081} \
      USER_SERVICE_URL=${USER_SERVICE_URL:-http://localhost:7082} \
      METADATA_SERVICE_URL=${METADATA_SERVICE_URL:-http://localhost:7083} \
      STORAGE_SERVICE_URL=${STORAGE_SERVICE_URL:-http://localhost:7084} \
      SHARING_SERVICE_URL=${SHARING_SERVICE_URL:-http://localhost:7085} \
      nohup ./node_modules/.bin/tsx src/index.ts > ../../logs/${service_name}.log 2>&1 &
      echo $! > ../../logs/${service_name}.pid
    )
    local pid=$(cat logs/${service_name}.pid)
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_info "$service_name started on port $port (PID: $pid)"
    else
        log_error "Failed to start $service_name"
    fi
}

# 启动 Next.js 开发服务器（apps/web，默认 4000）
start_next() {
    log_service "Starting Next dev (apps/web) on 4000..."
    local port=4000
    local service_name="next-dev"
    if check_backend_service $port $service_name > /dev/null; then
        log_warn "Next dev is already running on port $port"
        return
    fi
    mkdir -p logs
    # 为 Next 提供 API_BASE_URL（对接 Node 网关，默认 :9080）
    local api_base="http://localhost:${GATEWAY_PORT:-9080}"
    API_BASE_URL="$api_base" \
    nohup pnpm --filter ./apps/web dev > logs/${service_name}.log 2>&1 &
    local pid=$!
    echo $pid > logs/${service_name}.pid
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_info "Next dev started on port $port (PID: $pid), API_BASE_URL=$api_base"
    else
        log_error "Failed to start Next dev"
    fi
}

# 主函数
main() {
    local command=${1:-"status"}
    
    case $command in
        "start")
            start_all
            ;;
        "stop")
            stop_all
            ;;
        "restart")
            restart_all
            ;;
        "start-frontend")
            start_frontend
            ;;
        "stop-frontend")
            stop_frontend
            ;;
        "start-backend")
            start_backend
            ;;
        "stop-backend")
            stop_backend
            ;;
        "start-metadata-node")
            start_metadata_node
            ;;
        "start-storage-node")
            start_storage_node
            ;;
        "start-sharing-node")
            start_sharing_node
            ;;
        "start-gateway-node")
            start_gateway_node
            ;;
        "start-next")
            start_next
            ;;
        "status")
            show_status
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|start-frontend|stop-frontend|start-backend|stop-backend|status}"
            echo ""
            echo "Commands:"
            echo "  start           - Start all services (backend + frontend)"
            echo "  stop            - Stop all services"
            echo "  restart         - Restart all services"
            echo "  start-frontend  - Start only frontend service"
            echo "  stop-frontend   - Stop only frontend service"
            echo "  start-backend   - Start only backend services"
            echo "  stop-backend    - Stop only backend services"
            echo "  start-gateway-node - Start Node API gateway (default :9080)"
            echo "  start-next      - Start Next dev (apps/web) on :4000"
            echo "  status          - Show service status"
            exit 1
            ;;
    esac
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
