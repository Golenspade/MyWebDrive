#!/bin/bash

# 启动所有微服务
# 使用方法: ./scripts/start-services.sh

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

# 检查Go是否安装
check_go() {
    if ! command -v go &> /dev/null; then
        log_error "Go is not installed. Please install Go first."
        exit 1
    fi
}

# 检查环境文件
check_env_file() {
    if [ ! -f ".env" ]; then
        log_warn ".env file not found. Using default values."
        log_warn "You can copy .env.example to .env and customize the configuration."
    else
        log_info "Loading environment variables from .env"
        set -a
        source .env
        set +a
    fi
}

# 设置默认环境变量
set_default_env() {
    export JWT_SECRET=${JWT_SECRET:-"your-super-secret-jwt-key-change-this-in-production"}
    export AUTH_DATABASE_PATH=${AUTH_DATABASE_PATH:-"./data/auth.db"}
    export USER_DATABASE_PATH=${USER_DATABASE_PATH:-"./data/user.db"}
    export METADATA_DATABASE_PATH=${METADATA_DATABASE_PATH:-"./data/metadata.db"}
    export SHARING_DATABASE_PATH=${SHARING_DATABASE_PATH:-"./data/sharing.db"}
    export STORAGE_PATH=${STORAGE_PATH:-"./storage"}
    export USE_MINIO=${USE_MINIO:-"false"}
}

# 启动服务函数
start_service() {
    local service_name=$1
    local service_path=$2
    local port=$3
    local log_file="./logs/${service_name}.log"
    
    # 创建日志目录
    mkdir -p ./logs
    
    log_service "Starting $service_name on port $port..."
    
    # 切换到服务目录并启动
    cd "$service_path"
    
    # 构建并启动服务
    go build -o "../../../bin/$service_name" .
    if [ $? -ne 0 ]; then
        log_error "Failed to build $service_name"
        cd - > /dev/null
        return 1
    fi
    
    cd - > /dev/null
    
    # 启动服务（后台运行），在项目根目录下运行以确保正确的配置文件路径
    cd "$PWD"  # 确保在项目根目录
    nohup "./bin/$service_name" > "$log_file" 2>&1 &
    local pid=$!
    
    # 保存PID
    echo $pid > "./logs/${service_name}.pid"
    
    # 等待服务启动
    sleep 2
    
    # 检查服务是否正常启动
    if kill -0 $pid 2>/dev/null; then
        log_info "$service_name started successfully (PID: $pid)"
        return 0
    else
        log_error "$service_name failed to start"
        return 1
    fi
}

# 检查服务健康状态
check_service_health() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    log_info "Checking $service_name health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            log_info "$service_name is healthy"
            return 0
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    log_warn "$service_name health check failed after $max_attempts attempts"
    return 1
}

# 停止所有服务
stop_services() {
    log_info "Stopping all services..."
    
    local services=("auth-service" "user-service" "metadata-service" "storage-service" "sharing-service" "api-gateway")
    
    for service in "${services[@]}"; do
        local pid_file="./logs/${service}.pid"
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 $pid 2>/dev/null; then
                log_info "Stopping $service (PID: $pid)"
                kill $pid
                rm -f "$pid_file"
            else
                log_warn "$service is not running"
                rm -f "$pid_file"
            fi
        fi
    done
}

# 清理函数
cleanup() {
    log_info "Received interrupt signal. Stopping services..."
    stop_services
    exit 0
}

# 显示服务状态
show_status() {
    log_info "Service Status:"
    echo "==========================================================================================================="
    printf "%-20s %-10s %-10s %-50s\n" "Service" "Port" "Status" "Log File"
    echo "==========================================================================================================="
    
    local services=(
        "auth-service:8081"
        "user-service:8082"
        "metadata-service:8083"
        "storage-service:8084"
        "sharing-service:8085"
        "api-gateway:8080"
    )
    
    for service_port in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        local pid_file="./logs/${service}.pid"
        local log_file="./logs/${service}.log"
        local status="STOPPED"
        
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 $pid 2>/dev/null; then
                status="RUNNING (PID: $pid)"
            else
                status="STOPPED"
            fi
        fi
        
        printf "%-20s %-10s %-10s %-50s\n" "$service" "$port" "$status" "$log_file"
    done
    
    echo "==========================================================================================================="
}

# 主函数
main() {
    local command=${1:-"start"}
    
    case $command in
        "start")
            log_info "Starting MyWebDrive services..."
            
            # 检查依赖
            check_go
            check_env_file
            set_default_env
            
            # 创建bin目录
            mkdir -p ./bin
            
            # 设置信号处理
            trap cleanup SIGINT SIGTERM
            
            # 按顺序启动服务
            start_service "auth-service" "./backend/auth-service" 8081
            start_service "user-service" "./backend/user-service" 8082
            start_service "metadata-service" "./backend/metadata-service" 8083
            start_service "storage-service" "./backend/storage-service" 8084
            start_service "sharing-service" "./backend/sharing-service" 8085
            
            # 等待其他服务启动完成
            sleep 3
            
            # 最后启动API网关
            start_service "api-gateway" "./backend/api-gateway" 8080
            
            log_info "All services started successfully!"
            log_info "API Gateway is available at: http://localhost:8080"
            log_info "Press Ctrl+C to stop all services"
            
            # 显示状态
            show_status
            
            # 等待中断信号
            wait
            ;;
        "stop")
            stop_services
            ;;
        "status")
            show_status
            ;;
        "restart")
            stop_services
            sleep 2
            $0 start
            ;;
        *)
            echo "Usage: $0 {start|stop|status|restart}"
            echo ""
            echo "Commands:"
            echo "  start   - Start all services"
            echo "  stop    - Stop all services"
            echo "  status  - Show service status"
            echo "  restart - Restart all services"
            exit 1
            ;;
    esac
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
