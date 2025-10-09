#!/bin/bash

# MyWebDrive 一键部署到阿里云服务器脚本
# 使用方法: ./deploy-to-server.sh [服务器IP] [选项]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 配置文件路径
CONFIG_FILE="$HOME/.mywebdrive-deploy.conf"

# 加载配置
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        log_info "已加载配置文件: $CONFIG_FILE"
    fi
}

# 保存配置
save_config() {
    cat > "$CONFIG_FILE" << EOF
# MyWebDrive 部署配置
SERVER_IP="$SERVER_IP"
SERVER_USER="$SERVER_USER"
SERVER_PORT="$SERVER_PORT"
REMOTE_DIR="$REMOTE_DIR"
SSH_KEY="$SSH_KEY"
EOF
    chmod 600 "$CONFIG_FILE"
    log_success "配置已保存到: $CONFIG_FILE"
}

# 交互式配置
interactive_setup() {
    log_info "开始配置部署参数..."
    
    # 服务器IP
    read -p "请输入服务器IP地址: " SERVER_IP
    
    # 服务器用户
    read -p "请输入SSH用户名 [默认: root]: " SERVER_USER
    SERVER_USER=${SERVER_USER:-root}
    
    # SSH端口
    read -p "请输入SSH端口 [默认: 22]: " SERVER_PORT
    SERVER_PORT=${SERVER_PORT:-22}
    
    # 远程目录
    read -p "请输入远程部署目录 [默认: /opt/MyWebDrive]: " REMOTE_DIR
    REMOTE_DIR=${REMOTE_DIR:-/opt/MyWebDrive}
    
    # SSH密钥
    read -p "请输入SSH私钥路径 [默认: ~/.ssh/id_rsa]: " SSH_KEY
    SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}
    
    # 确认配置
    echo ""
    log_info "配置信息:"
    echo "  服务器IP: $SERVER_IP"
    echo "  SSH用户: $SERVER_USER"
    echo "  SSH端口: $SERVER_PORT"
    echo "  远程目录: $REMOTE_DIR"
    echo "  SSH密钥: $SSH_KEY"
    echo ""
    
    read -p "确认配置正确? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "配置已取消"
        exit 1
    fi
    
    save_config
}

# 测试SSH连接
test_ssh_connection() {
    log_info "测试SSH连接..."
    
    if ssh -i "$SSH_KEY" -p "$SERVER_PORT" -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
        "$SERVER_USER@$SERVER_IP" "echo 'SSH连接成功'" > /dev/null 2>&1; then
        log_success "SSH连接测试成功"
        return 0
    else
        log_error "SSH连接失败，请检查配置"
        return 1
    fi
}

# 检查本地环境
check_local_environment() {
    log_info "检查本地环境..."
    
    # 检查Git状态
    if [ -n "$(git status --porcelain)" ]; then
        log_warn "检测到未提交的更改"
        git status --short
        read -p "是否继续部署? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # 检查当前分支
    local current_branch=$(git branch --show-current)
    log_info "当前分支: $current_branch"
    
    # 检查必要工具
    local required_tools=("git" "ssh" "rsync")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "缺少必要工具: $tool"
            exit 1
        fi
    done
    
    log_success "本地环境检查通过"
}

# 推送代码到服务器
push_code_to_server() {
    log_info "推送代码到服务器..."
    
    # 使用rsync同步代码
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude 'dist' \
        --exclude 'build' \
        --exclude '.env' \
        --exclude 'logs' \
        --exclude 'data' \
        -e "ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no" \
        ./ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"
    
    log_success "代码推送完成"
}

# 在服务器上执行命令
remote_exec() {
    local command="$1"
    ssh -i "$SSH_KEY" -p "$SERVER_PORT" -o StrictHostKeyChecking=no \
        "$SERVER_USER@$SERVER_IP" "$command"
}

# 检查服务器环境
check_server_environment() {
    log_info "检查服务器环境..."
    
    # 检查Docker
    if ! remote_exec "command -v docker &> /dev/null"; then
        log_error "服务器未安装Docker"
        read -p "是否自动安装Docker? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker_on_server
        else
            exit 1
        fi
    fi
    
    # 检查Docker Compose
    if ! remote_exec "command -v docker-compose &> /dev/null"; then
        log_error "服务器未安装Docker Compose"
        read -p "是否自动安装Docker Compose? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker_compose_on_server
        else
            exit 1
        fi
    fi
    
    # 检查Node.js
    if ! remote_exec "command -v node &> /dev/null"; then
        log_warn "服务器未安装Node.js"
        read -p "是否自动安装Node.js? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_nodejs_on_server
        fi
    fi
    
    log_success "服务器环境检查完成"
}

# 在服务器上安装Docker
install_docker_on_server() {
    log_info "在服务器上安装Docker..."
    
    remote_exec "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh"
    remote_exec "systemctl start docker && systemctl enable docker"
    
    log_success "Docker安装完成"
}

# 在服务器上安装Docker Compose
install_docker_compose_on_server() {
    log_info "在服务器上安装Docker Compose..."
    
    remote_exec "curl -L \"https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    remote_exec "chmod +x /usr/local/bin/docker-compose"
    
    log_success "Docker Compose安装完成"
}

# 在服务器上安装Node.js
install_nodejs_on_server() {
    log_info "在服务器上安装Node.js..."
    
    remote_exec "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
    remote_exec "corepack enable && corepack prepare pnpm@9.7.0 --activate"
    
    log_success "Node.js安装完成"
}

# 配置服务器环境变量
setup_server_env() {
    log_info "配置服务器环境变量..."
    
    local env_file="$REMOTE_DIR/infrastructure/alicloud/.env"
    
    # 检查服务器上是否已有.env文件
    if remote_exec "[ -f $env_file ]"; then
        log_info "服务器上已存在.env文件"
        read -p "是否覆盖? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "保留现有.env文件"
            return
        fi
    fi
    
    # 检查本地是否有.env文件
    if [ -f "infrastructure/alicloud/.env" ]; then
        log_info "上传本地.env文件到服务器..."
        scp -i "$SSH_KEY" -P "$SERVER_PORT" \
            infrastructure/alicloud/.env \
            "$SERVER_USER@$SERVER_IP:$env_file"
    else
        log_warn "本地未找到.env文件，使用env.example创建"
        remote_exec "cd $REMOTE_DIR/infrastructure/alicloud && cp env.example .env"
        log_warn "请手动编辑服务器上的.env文件: $env_file"
    fi
    
    log_success "环境变量配置完成"
}

# 在服务器上部署应用
deploy_on_server() {
    log_info "在服务器上部署应用..."
    
    # 创建数据目录
    remote_exec "mkdir -p /data/{sqlite,redis,minio} && chmod -R 755 /data"
    
    # 给部署脚本执行权限
    remote_exec "chmod +x $REMOTE_DIR/infrastructure/alicloud/deploy.sh"
    remote_exec "chmod +x $REMOTE_DIR/infrastructure/alicloud/rollback.sh"
    remote_exec "chmod +x $REMOTE_DIR/infrastructure/alicloud/backup-restore.sh"
    
    # 执行部署
    log_info "执行部署脚本..."
    remote_exec "cd $REMOTE_DIR/infrastructure/alicloud && ./deploy.sh production latest"
    
    log_success "应用部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."
    
    # 检查服务状态
    log_info "检查服务状态..."
    remote_exec "cd $REMOTE_DIR/infrastructure/alicloud && docker-compose -f docker-compose.node.yml ps"
    
    # 健康检查
    log_info "执行健康检查..."
    local services=("9080" "7081" "7082" "7083" "7084" "7085")
    for port in "${services[@]}"; do
        if remote_exec "curl -f -s http://localhost:$port/health > /dev/null"; then
            log_success "端口 $port 健康检查通过"
        else
            log_warn "端口 $port 健康检查失败"
        fi
    done
    
    log_success "部署验证完成"
}

# 显示部署信息
show_deployment_info() {
    echo ""
    log_success "🎉 部署完成！"
    echo ""
    echo "访问信息:"
    echo "  服务器IP: $SERVER_IP"
    echo "  API网关: http://$SERVER_IP:9080"
    echo "  前端应用: http://$SERVER_IP"
    echo ""
    echo "常用命令:"
    echo "  查看日志: ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'cd $REMOTE_DIR/infrastructure/alicloud && docker-compose -f docker-compose.node.yml logs -f'"
    echo "  重启服务: ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'cd $REMOTE_DIR/infrastructure/alicloud && docker-compose -f docker-compose.node.yml restart'"
    echo "  停止服务: ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'cd $REMOTE_DIR/infrastructure/alicloud && docker-compose -f docker-compose.node.yml down'"
    echo ""
}

# 显示帮助
show_help() {
    echo "MyWebDrive 一键部署到服务器脚本"
    echo ""
    echo "使用方法:"
    echo "  ./deploy-to-server.sh                  # 交互式部署"
    echo "  ./deploy-to-server.sh <server-ip>     # 快速部署到指定服务器"
    echo "  ./deploy-to-server.sh setup           # 配置部署参数"
    echo "  ./deploy-to-server.sh test            # 测试SSH连接"
    echo ""
    echo "选项:"
    echo "  -h, --help                             # 显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy-to-server.sh setup"
    echo "  ./deploy-to-server.sh 123.45.67.89"
    echo "  ./deploy-to-server.sh"
}

# 主函数
main() {
    local action="$1"
    
    case "$action" in
        "setup")
            interactive_setup
            ;;
        "test")
            load_config
            test_ssh_connection
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        "")
            # 交互式部署
            load_config
            
            if [ -z "$SERVER_IP" ]; then
                interactive_setup
            fi
            
            log_info "开始部署到服务器: $SERVER_IP"
            
            test_ssh_connection || exit 1
            check_local_environment
            check_server_environment
            push_code_to_server
            setup_server_env
            deploy_on_server
            verify_deployment
            show_deployment_info
            ;;
        *)
            # 假设参数是服务器IP
            SERVER_IP="$1"
            load_config
            
            # 如果其他配置不存在，使用默认值
            SERVER_USER=${SERVER_USER:-root}
            SERVER_PORT=${SERVER_PORT:-22}
            REMOTE_DIR=${REMOTE_DIR:-/opt/MyWebDrive}
            SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}
            
            save_config
            
            log_info "开始部署到服务器: $SERVER_IP"
            
            test_ssh_connection || exit 1
            check_local_environment
            check_server_environment
            push_code_to_server
            setup_server_env
            deploy_on_server
            verify_deployment
            show_deployment_info
            ;;
    esac
}

# 执行主函数
main "$@"
