#!/bin/bash

# 初始化所有微服务的数据库
# 使用方法: ./scripts/init-databases.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 检查sqlite3是否安装
check_sqlite3() {
    if ! command -v sqlite3 &> /dev/null; then
        log_error "sqlite3 is not installed. Please install it first."
        exit 1
    fi
}

# 创建数据库目录
create_db_directory() {
    local db_dir="./data"
    if [ ! -d "$db_dir" ]; then
        mkdir -p "$db_dir"
        log_info "Created database directory: $db_dir"
    fi
}

# 初始化认证服务数据库
init_auth_db() {
    local db_file="./data/auth.db"
    local migration_file="./backend/auth-service/migrations/001_create_users_table.sql"
    
    log_info "Initializing auth service database..."
    
    if [ -f "$migration_file" ]; then
        sqlite3 "$db_file" < "$migration_file"
        log_info "Auth database initialized successfully"
    else
        log_error "Migration file not found: $migration_file"
        return 1
    fi
}

# 初始化用户服务数据库
init_user_db() {
    local db_file="./data/user.db"
    local migration_file="./backend/user-service/migrations/001_create_users_table.sql"
    
    log_info "Initializing user service database..."
    
    if [ -f "$migration_file" ]; then
        sqlite3 "$db_file" < "$migration_file"
        log_info "User database initialized successfully"
    else
        log_error "Migration file not found: $migration_file"
        return 1
    fi
}

# 初始化元数据服务数据库
init_metadata_db() {
    local db_file="./data/metadata.db"
    local migration_file="./backend/metadata-service/migrations/001_create_files_table.sql"
    
    log_info "Initializing metadata service database..."
    
    if [ -f "$migration_file" ]; then
        sqlite3 "$db_file" < "$migration_file"
        log_info "Metadata database initialized successfully"
    else
        log_error "Migration file not found: $migration_file"
        return 1
    fi
}

# 初始化分享服务数据库
init_sharing_db() {
    local db_file="./data/sharing.db"
    local migration_file="./backend/sharing-service/migrations/001_create_shares_table.sql"
    
    log_info "Initializing sharing service database..."
    
    if [ -f "$migration_file" ]; then
        sqlite3 "$db_file" < "$migration_file"
        log_info "Sharing database initialized successfully"
    else
        log_error "Migration file not found: $migration_file"
        return 1
    fi
}

# 创建存储目录
create_storage_directories() {
    local storage_dirs=("./storage/files" "./storage/temp" "./storage/chunks")
    
    log_info "Creating storage directories..."
    
    for dir in "${storage_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Created storage directory: $dir"
        fi
    done
}

# 生成示例配置文件
generate_env_example() {
    local env_file=".env.example"
    
    log_info "Generating example environment file..."
    
    cat > "$env_file" << EOF
# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 数据库配置
AUTH_DATABASE_PATH=./data/auth.db
USER_DATABASE_PATH=./data/user.db
METADATA_DATABASE_PATH=./data/metadata.db
SHARING_DATABASE_PATH=./data/sharing.db

# 存储配置
STORAGE_PATH=./storage
USE_MINIO=false

# MinIO配置（如果使用MinIO）
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=mywebdrive
MINIO_USE_SSL=false

# 服务端口配置
API_GATEWAY_PORT=8080
AUTH_SERVICE_PORT=8081
USER_SERVICE_PORT=8082
METADATA_SERVICE_PORT=8083
STORAGE_SERVICE_PORT=8084
SHARING_SERVICE_PORT=8085

# 服务URL配置（用于API网关）
AUTH_SERVICE_URL=http://localhost:8081
USER_SERVICE_URL=http://localhost:8082
METADATA_SERVICE_URL=http://localhost:8083
STORAGE_SERVICE_URL=http://localhost:8084
SHARING_SERVICE_URL=http://localhost:8085

# 日志级别
LOG_LEVEL=info

# 开发模式
DEV_MODE=true
EOF

    log_info "Generated $env_file"
}

# 主函数
main() {
    log_info "Starting database initialization..."
    
    # 检查依赖
    check_sqlite3
    
    # 创建必要的目录
    create_db_directory
    create_storage_directories
    
    # 初始化各个服务的数据库
    init_auth_db
    init_user_db
    init_metadata_db
    init_sharing_db
    
    # 生成配置文件示例
    generate_env_example
    
    log_info "Database initialization completed successfully!"
    log_warn "Please copy .env.example to .env and update the configuration values"
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
