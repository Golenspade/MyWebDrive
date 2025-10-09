#!/bin/bash

# MyWebDrive 回滚脚本
# 使用方法: ./rollback.sh [回滚类型] [选项]
# 回滚类型: quick, version, config, data, full

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warn "检测到root用户，请确认操作安全性"
        read -p "继续执行? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 创建回滚前备份
create_rollback_backup() {
    local backup_dir="/backup/mywebdrive/rollback_$(date +%Y%m%d_%H%M%S)"
    log_info "创建回滚前备份: $backup_dir"
    
    mkdir -p "$backup_dir"
    
    # 备份当前配置
    if [ -f ".env" ]; then
        cp .env "$backup_dir/env_current"
    fi
    
    # 备份当前数据
    if [ -d "/data" ]; then
        cp -r /data "$backup_dir/data_current"
    fi
    
    # 记录当前Git版本
    cd /opt/MyWebDrive
    git rev-parse HEAD > "$backup_dir/git_commit_current"
    git branch --show-current > "$backup_dir/git_branch_current"
    
    # 记录当前Docker状态
    cd /opt/MyWebDrive/infrastructure/alicloud
    docker-compose -f docker-compose.node.yml ps > "$backup_dir/docker_status_current"
    
    log_success "备份完成: $backup_dir"
    echo "$backup_dir" > /tmp/mywebdrive_rollback_backup_path
}

# 快速回滚到上一个版本
quick_rollback() {
    log_info "开始快速回滚到上一个版本..."
    
    create_rollback_backup
    
    cd /opt/MyWebDrive
    
    # 获取上一个提交
    local previous_commit=$(git rev-parse HEAD~1)
    log_info "回滚到提交: $previous_commit"
    
    # 停止服务
    cd infrastructure/alicloud
    docker-compose -f docker-compose.node.yml down
    
    # 回滚代码
    cd /opt/MyWebDrive
    git reset --hard HEAD~1
    
    # 重新部署
    cd infrastructure/alicloud
    ./deploy.sh production latest
    
    log_success "快速回滚完成"
}

# 回滚到指定版本
version_rollback() {
    local target_version="$1"
    
    if [ -z "$target_version" ]; then
        log_error "请指定目标版本 (commit hash 或 tag)"
        echo "使用方法: ./rollback.sh version <commit-hash|tag>"
        exit 1
    fi
    
    log_info "开始回滚到版本: $target_version"
    
    create_rollback_backup
    
    cd /opt/MyWebDrive
    
    # 检查目标版本是否存在
    if ! git cat-file -e "$target_version" 2>/dev/null; then
        log_error "版本 $target_version 不存在"
        exit 1
    fi
    
    # 停止服务
    cd infrastructure/alicloud
    docker-compose -f docker-compose.node.yml down
    
    # 回滚代码
    cd /opt/MyWebDrive
    git reset --hard "$target_version"
    
    # 重新部署
    cd infrastructure/alicloud
    ./deploy.sh production "$target_version"
    
    log_success "版本回滚完成"
}

# 配置回滚
config_rollback() {
    local backup_path="$1"
    
    if [ -z "$backup_path" ]; then
        log_error "请指定备份路径"
        echo "使用方法: ./rollback.sh config <backup-path>"
        exit 1
    fi
    
    if [ ! -f "$backup_path" ]; then
        log_error "备份文件不存在: $backup_path"
        exit 1
    fi
    
    log_info "开始配置回滚..."
    
    # 备份当前配置
    if [ -f ".env" ]; then
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # 恢复配置
    cp "$backup_path" .env
    
    # 重启服务
    docker-compose -f docker-compose.node.yml restart
    
    log_success "配置回滚完成"
}

# 数据回滚
data_rollback() {
    local backup_path="$1"
    
    if [ -z "$backup_path" ]; then
        log_error "请指定数据备份路径"
        echo "使用方法: ./rollback.sh data <backup-data-path>"
        exit 1
    fi
    
    if [ ! -d "$backup_path" ]; then
        log_error "备份目录不存在: $backup_path"
        exit 1
    fi
    
    log_warn "数据回滚将覆盖当前所有数据，此操作不可逆！"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    log_info "开始数据回滚..."
    
    # 停止服务
    cd /opt/MyWebDrive/infrastructure/alicloud
    docker-compose -f docker-compose.node.yml down
    
    # 备份当前数据
    if [ -d "/data" ]; then
        mv /data "/data.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # 恢复数据
    cp -r "$backup_path" /data
    
    # 启动服务
    docker-compose -f docker-compose.node.yml up -d
    
    log_success "数据回滚完成"
}

# 完全回滚（移除部署）
full_rollback() {
    log_warn "完全回滚将移除所有部署内容，包括数据！"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    log_info "开始完全回滚..."
    
    # 创建最终备份
    create_rollback_backup
    
    # 停止并移除所有容器
    cd /opt/MyWebDrive/infrastructure/alicloud
    docker-compose -f docker-compose.node.yml down -v --remove-orphans
    
    # 移除Docker镜像（可选）
    read -p "是否移除Docker镜像? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker system prune -af
    fi
    
    # 移除代码目录（可选）
    read -p "是否移除代码目录 /opt/MyWebDrive? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf /opt/MyWebDrive
    fi
    
    # 移除数据目录（可选）
    read -p "是否移除数据目录 /data? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf /data
    fi
    
    # 移除Nginx配置（可选）
    read -p "是否移除Nginx配置? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f /etc/nginx/sites-enabled/mywebdrive
        rm -f /etc/nginx/sites-available/mywebdrive
        systemctl restart nginx
    fi
    
    # 移除定时任务
    crontab -l | grep -v mywebdrive | crontab -
    
    log_success "完全回滚完成"
}

# 显示帮助信息
show_help() {
    echo "MyWebDrive 回滚脚本"
    echo ""
    echo "使用方法:"
    echo "  ./rollback.sh quick                    # 快速回滚到上一个版本"
    echo "  ./rollback.sh version <commit|tag>     # 回滚到指定版本"
    echo "  ./rollback.sh config <backup-file>     # 回滚配置文件"
    echo "  ./rollback.sh data <backup-dir>        # 回滚数据"
    echo "  ./rollback.sh full                     # 完全回滚（移除部署）"
    echo ""
    echo "示例:"
    echo "  ./rollback.sh quick"
    echo "  ./rollback.sh version v1.0.0"
    echo "  ./rollback.sh version abc123def"
    echo "  ./rollback.sh config /backup/mywebdrive/env_20241209_120000"
    echo "  ./rollback.sh data /backup/mywebdrive/data_20241209_120000"
    echo "  ./rollback.sh full"
}

# 主函数
main() {
    local action="$1"
    
    case "$action" in
        "quick")
            check_root
            quick_rollback
            ;;
        "version")
            check_root
            version_rollback "$2"
            ;;
        "config")
            config_rollback "$2"
            ;;
        "data")
            check_root
            data_rollback "$2"
            ;;
        "full")
            check_root
            full_rollback
            ;;
        "help"|"-h"|"--help"|"")
            show_help
            ;;
        *)
            log_error "未知操作: $action"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
