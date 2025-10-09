#!/bin/bash

# MyWebDrive 备份和恢复脚本
# 使用方法: ./backup-restore.sh [backup|restore|list] [选项]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
BACKUP_BASE_DIR="/backup/mywebdrive"
PROJECT_DIR="/opt/MyWebDrive"
DATA_DIR="/data"

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

# 创建完整备份
create_backup() {
    local backup_name="${1:-$(date +%Y%m%d_%H%M%S)}"
    local backup_dir="$BACKUP_BASE_DIR/$backup_name"
    
    log_info "创建备份: $backup_name"
    
    # 创建备份目录
    mkdir -p "$backup_dir"
    
    # 备份代码和配置
    log_info "备份代码和配置..."
    cd "$PROJECT_DIR"
    
    # Git信息
    git rev-parse HEAD > "$backup_dir/git_commit"
    git branch --show-current > "$backup_dir/git_branch"
    git status --porcelain > "$backup_dir/git_status"
    
    # 配置文件
    if [ -f "infrastructure/alicloud/.env" ]; then
        cp infrastructure/alicloud/.env "$backup_dir/env"
    fi
    
    # 备份数据
    log_info "备份数据库和文件..."
    if [ -d "$DATA_DIR" ]; then
        cp -r "$DATA_DIR" "$backup_dir/data"
    fi
    
    # Docker状态
    cd "$PROJECT_DIR/infrastructure/alicloud"
    docker-compose -f docker-compose.node.yml ps > "$backup_dir/docker_status" 2>/dev/null || true
    
    # 系统信息
    df -h > "$backup_dir/disk_usage"
    free -h > "$backup_dir/memory_usage"
    
    # 创建备份元数据
    cat > "$backup_dir/backup_info.json" << EOF
{
    "backup_name": "$backup_name",
    "backup_time": "$(date -Iseconds)",
    "backup_type": "full",
    "project_dir": "$PROJECT_DIR",
    "data_dir": "$DATA_DIR",
    "git_commit": "$(cat $backup_dir/git_commit)",
    "git_branch": "$(cat $backup_dir/git_branch)"
}
EOF
    
    # 压缩备份（可选）
    read -p "是否压缩备份? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "压缩备份..."
        cd "$BACKUP_BASE_DIR"
        tar -czf "${backup_name}.tar.gz" "$backup_name"
        rm -rf "$backup_name"
        log_success "备份已压缩: ${backup_name}.tar.gz"
    else
        log_success "备份完成: $backup_dir"
    fi
}

# 恢复备份
restore_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        log_error "请指定备份名称"
        list_backups
        exit 1
    fi
    
    local backup_path="$BACKUP_BASE_DIR/$backup_name"
    local compressed_backup="$BACKUP_BASE_DIR/${backup_name}.tar.gz"
    
    # 检查备份是否存在
    if [ -d "$backup_path" ]; then
        backup_dir="$backup_path"
    elif [ -f "$compressed_backup" ]; then
        log_info "解压缩备份..."
        cd "$BACKUP_BASE_DIR"
        tar -xzf "${backup_name}.tar.gz"
        backup_dir="$backup_path"
    else
        log_error "备份不存在: $backup_name"
        list_backups
        exit 1
    fi
    
    # 显示备份信息
    if [ -f "$backup_dir/backup_info.json" ]; then
        log_info "备份信息:"
        cat "$backup_dir/backup_info.json" | jq . 2>/dev/null || cat "$backup_dir/backup_info.json"
    fi
    
    log_warn "恢复备份将覆盖当前数据，此操作不可逆！"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    log_info "开始恢复备份: $backup_name"
    
    # 创建恢复前备份
    log_info "创建恢复前备份..."
    create_backup "before_restore_$(date +%Y%m%d_%H%M%S)"
    
    # 停止服务
    log_info "停止服务..."
    cd "$PROJECT_DIR/infrastructure/alicloud"
    docker-compose -f docker-compose.node.yml down
    
    # 恢复代码
    if [ -f "$backup_dir/git_commit" ]; then
        log_info "恢复代码版本..."
        cd "$PROJECT_DIR"
        local target_commit=$(cat "$backup_dir/git_commit")
        git fetch origin
        git reset --hard "$target_commit"
    fi
    
    # 恢复配置
    if [ -f "$backup_dir/env" ]; then
        log_info "恢复配置文件..."
        cp "$backup_dir/env" "$PROJECT_DIR/infrastructure/alicloud/.env"
    fi
    
    # 恢复数据
    if [ -d "$backup_dir/data" ]; then
        log_info "恢复数据..."
        if [ -d "$DATA_DIR" ]; then
            mv "$DATA_DIR" "${DATA_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
        fi
        cp -r "$backup_dir/data" "$DATA_DIR"
    fi
    
    # 启动服务
    log_info "启动服务..."
    cd "$PROJECT_DIR/infrastructure/alicloud"
    ./deploy.sh production latest
    
    log_success "备份恢复完成"
}

# 列出所有备份
list_backups() {
    log_info "可用备份列表:"
    
    if [ ! -d "$BACKUP_BASE_DIR" ]; then
        log_warn "备份目录不存在: $BACKUP_BASE_DIR"
        return
    fi
    
    echo "----------------------------------------"
    printf "%-20s %-15s %-10s %s\n" "备份名称" "创建时间" "类型" "Git提交"
    echo "----------------------------------------"
    
    for item in "$BACKUP_BASE_DIR"/*; do
        if [ -d "$item" ]; then
            local name=$(basename "$item")
            local info_file="$item/backup_info.json"
            local git_file="$item/git_commit"
            
            if [ -f "$info_file" ]; then
                local backup_time=$(jq -r '.backup_time' "$info_file" 2>/dev/null | cut -d'T' -f1)
                local backup_type=$(jq -r '.backup_type' "$info_file" 2>/dev/null)
                local git_commit=$(jq -r '.git_commit' "$info_file" 2>/dev/null | cut -c1-8)
            elif [ -f "$git_file" ]; then
                local backup_time=$(stat -c %y "$item" | cut -d' ' -f1)
                local backup_type="unknown"
                local git_commit=$(cat "$git_file" | cut -c1-8)
            else
                local backup_time=$(stat -c %y "$item" | cut -d' ' -f1)
                local backup_type="unknown"
                local git_commit="unknown"
            fi
            
            printf "%-20s %-15s %-10s %s\n" "$name" "$backup_time" "$backup_type" "$git_commit"
        elif [[ "$item" == *.tar.gz ]]; then
            local name=$(basename "$item" .tar.gz)
            local backup_time=$(stat -c %y "$item" | cut -d' ' -f1)
            printf "%-20s %-15s %-10s %s\n" "$name" "$backup_time" "compressed" "unknown"
        fi
    done
    
    echo "----------------------------------------"
}

# 清理旧备份
cleanup_backups() {
    local keep_days="${1:-7}"
    
    log_info "清理 $keep_days 天前的备份..."
    
    find "$BACKUP_BASE_DIR" -name "*" -type d -mtime +$keep_days -exec rm -rf {} \; 2>/dev/null || true
    find "$BACKUP_BASE_DIR" -name "*.tar.gz" -type f -mtime +$keep_days -delete 2>/dev/null || true
    
    log_success "清理完成"
}

# 验证备份完整性
verify_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        log_error "请指定备份名称"
        exit 1
    fi
    
    local backup_dir="$BACKUP_BASE_DIR/$backup_name"
    
    if [ ! -d "$backup_dir" ]; then
        log_error "备份不存在: $backup_name"
        exit 1
    fi
    
    log_info "验证备份: $backup_name"
    
    # 检查必要文件
    local required_files=("backup_info.json" "git_commit")
    for file in "${required_files[@]}"; do
        if [ ! -f "$backup_dir/$file" ]; then
            log_error "缺少文件: $file"
            return 1
        fi
    done
    
    # 检查数据目录
    if [ ! -d "$backup_dir/data" ]; then
        log_warn "缺少数据目录"
    fi
    
    # 检查配置文件
    if [ ! -f "$backup_dir/env" ]; then
        log_warn "缺少配置文件"
    fi
    
    log_success "备份验证通过"
}

# 显示帮助
show_help() {
    echo "MyWebDrive 备份和恢复脚本"
    echo ""
    echo "使用方法:"
    echo "  ./backup-restore.sh backup [name]           # 创建备份"
    echo "  ./backup-restore.sh restore <name>          # 恢复备份"
    echo "  ./backup-restore.sh list                    # 列出备份"
    echo "  ./backup-restore.sh cleanup [days]          # 清理旧备份"
    echo "  ./backup-restore.sh verify <name>           # 验证备份"
    echo ""
    echo "示例:"
    echo "  ./backup-restore.sh backup"
    echo "  ./backup-restore.sh backup my_backup"
    echo "  ./backup-restore.sh restore 20241209_120000"
    echo "  ./backup-restore.sh cleanup 30"
}

# 主函数
main() {
    local action="$1"
    
    case "$action" in
        "backup")
            create_backup "$2"
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_backups "$2"
            ;;
        "verify")
            verify_backup "$2"
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
