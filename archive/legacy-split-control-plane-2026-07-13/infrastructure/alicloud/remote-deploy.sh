#!/bin/bash
# MyWebDrive 远程部署脚本
# 用于从本地部署到阿里云服务器

set -e

# 配置
REMOTE_HOST="${REMOTE_HOST:-8.134.175.90}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-}"
DOMAIN="mygoavemujica.top"
REPO_URL="https://github.com/Golenspade/MyWebDrive.git"
DEPLOY_TAG="v0.2.0-search-publish-catalog"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   MyWebDrive 远程部署到阿里云                                 ║"
echo "║   Domain: $DOMAIN                                            ║"
echo "║   Version: $DEPLOY_TAG                                       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 检查 SSH 密钥
if [ -z "$SSH_KEY" ]; then
    echo -e "${RED}❌ 请设置 SSH_KEY 环境变量${NC}"
    echo "示例: export SSH_KEY=~/path/to/your.pem"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH 密钥文件不存在: $SSH_KEY${NC}"
    exit 1
fi

# 确保密钥权限正确
chmod 400 "$SSH_KEY"

# SSH 命令
SSH_CMD="ssh -o StrictHostKeyChecking=accept-new -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST"
SCP_CMD="scp -o StrictHostKeyChecking=accept-new -i $SSH_KEY"

echo -e "${GREEN}📋 部署配置${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "远程主机: $REMOTE_USER@$REMOTE_HOST"
echo "SSH 密钥: $SSH_KEY"
echo "域名: $DOMAIN"
echo "版本: $DEPLOY_TAG"
echo ""

# 步骤 1: 测试 SSH 连接
echo -e "${GREEN}📋 步骤 1: 测试 SSH 连接${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if $SSH_CMD "echo '连接成功'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH 连接正常${NC}"
else
    echo -e "${RED}❌ SSH 连接失败${NC}"
    exit 1
fi
echo ""

# 步骤 2: 安装基础依赖
echo -e "${GREEN}📋 步骤 2: 安装基础依赖${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$SSH_CMD << 'ENDSSH'
set -e

# 更新包列表
sudo apt-get update -qq

# 安装基础工具
sudo apt-get install -y -qq ca-certificates curl git

# 安装 Docker（如果未安装）
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
else
    echo "✅ Docker 已安装: $(docker --version)"
fi

# 验证 Docker Compose
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose 已安装: $(docker compose version)"
else
    echo "❌ Docker Compose 未安装"
    exit 1
fi

ENDSSH
echo -e "${GREEN}✅ 基础依赖安装完成${NC}"
echo ""

# 步骤 3: 克隆/更新代码
echo -e "${GREEN}📋 步骤 3: 克隆/更新代码${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$SSH_CMD << ENDSSH
set -e

if [ -d ~/myWebDrive ]; then
    echo "更新现有仓库..."
    cd ~/myWebDrive
    git fetch --all --tags
    git checkout $DEPLOY_TAG
    git pull origin $DEPLOY_TAG || true
else
    echo "克隆仓库..."
    git clone $REPO_URL ~/myWebDrive
    cd ~/myWebDrive
    git checkout $DEPLOY_TAG
fi

echo "✅ 当前版本: \$(git describe --tags)"
ENDSSH
echo -e "${GREEN}✅ 代码更新完成${NC}"
echo ""

# 步骤 4: 上传构建产物（从本地）
echo -e "${GREEN}📋 步骤 4: 上传本地构建产物${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  请确保已在本地执行: pnpm run build:all${NC}"
read -p "是否已完成本地构建? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏭️  跳过上传，将在服务器上构建${NC}"
else
    echo "上传构建产物..."
    # 上传 services dist
    for service in auth user metadata storage sharing api-gateway-node; do
        if [ -d "services/$service/dist" ]; then
            echo "上传 services/$service/dist..."
            $SCP_CMD -r "services/$service/dist" "$REMOTE_USER@$REMOTE_HOST:~/myWebDrive/services/$service/"
        fi
    done
    
    # 上传 packages dist
    for pkg in common observability; do
        if [ -d "packages/$pkg/dist" ]; then
            echo "上传 packages/$pkg/dist..."
            $SCP_CMD -r "packages/$pkg/dist" "$REMOTE_USER@$REMOTE_HOST:~/myWebDrive/packages/$pkg/"
        fi
    done
    
    # 上传前端构建
    if [ -d "frontend/cruip-landing/.next" ]; then
        echo "上传前端构建..."
        $SCP_CMD -r "frontend/cruip-landing/.next" "$REMOTE_USER@$REMOTE_HOST:~/myWebDrive/frontend/cruip-landing/"
    fi
    
    echo -e "${GREEN}✅ 构建产物上传完成${NC}"
fi
echo ""

# 步骤 5: 配置环境变量
echo -e "${GREEN}📋 步骤 5: 配置环境变量${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  请在服务器上手动配置环境变量${NC}"
echo "命令:"
echo "  $SSH_CMD"
echo "  cd ~/myWebDrive"
echo "  cp infrastructure/alicloud/.env.production infrastructure/alicloud/.env"
echo "  vim infrastructure/alicloud/.env"
echo ""
echo "必须修改的变量:"
echo "  - JWT_SECRET"
echo "  - OWNER_COOKIE_SECRET"
echo "  - CORS_ALLOWED_ORIGINS=https://$DOMAIN"
echo ""
read -p "按回车继续..."
echo ""

# 步骤 6: 配置 Nginx
echo -e "${GREEN}📋 步骤 6: 配置 Nginx${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 上传 Nginx 配置
echo "上传 Nginx 配置..."
$SCP_CMD infrastructure/alicloud/nginx-mywebdrive.conf "$REMOTE_USER@$REMOTE_HOST:/tmp/"

$SSH_CMD << 'ENDSSH'
set -e

# 安装 Nginx
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    sudo apt-get install -y nginx
fi

# 备份现有配置
if [ -d /etc/nginx ]; then
    sudo tar czf ~/nginx-backup-$(date +%F-%H%M).tgz /etc/nginx 2>/dev/null || true
    echo "✅ Nginx 配置已备份"
fi

# 禁用默认站点
sudo rm -f /etc/nginx/sites-enabled/default || true

# 安装新配置
sudo mv /tmp/nginx-mywebdrive.conf /etc/nginx/sites-available/mywebdrive
sudo ln -sf /etc/nginx/sites-available/mywebdrive /etc/nginx/sites-enabled/mywebdrive

# 测试配置
if sudo nginx -t; then
    echo "✅ Nginx 配置正确"
else
    echo "❌ Nginx 配置有误"
    exit 1
fi

ENDSSH
echo -e "${GREEN}✅ Nginx 配置完成${NC}"
echo ""

# 步骤 7: 申请 SSL 证书
echo -e "${GREEN}📋 步骤 7: 申请 SSL 证书${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "是否申请 Let's Encrypt 证书? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入邮箱地址: " EMAIL
    $SSH_CMD << ENDSSH
set -e

# 安装 certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL --agree-tos -n

# 重载 Nginx
sudo systemctl reload nginx

echo "✅ SSL 证书申请完成"
ENDSSH
    echo -e "${GREEN}✅ SSL 证书配置完成${NC}"
else
    echo -e "${YELLOW}⏭️  跳过 SSL 证书申请${NC}"
    echo "稍后可手动执行:"
    echo "  sudo certbot --nginx -d $DOMAIN -m your@email.com --agree-tos -n"
fi
echo ""

# 步骤 8: 启动服务
echo -e "${GREEN}📋 步骤 8: 启动 Docker Compose 服务${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$SSH_CMD << 'ENDSSH'
set -e

cd ~/myWebDrive/infrastructure/alicloud

# 复制环境变量
if [ ! -f .env ]; then
    echo "❌ 请先配置 .env 文件"
    exit 1
fi

# 启动服务
docker compose -f docker-compose.production.yml up -d

echo "✅ 服务已启动"
echo ""
echo "查看状态:"
docker compose -f docker-compose.production.yml ps

ENDSSH
echo -e "${GREEN}✅ 服务启动完成${NC}"
echo ""

# 步骤 9: 健康检查
echo -e "${GREEN}📋 步骤 9: 健康检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 10
$SSH_CMD "cd ~/myWebDrive && bash infrastructure/alicloud/prod-diagnose.sh"
echo ""

# 完成
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🎉 部署完成！                                               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📊 访问地址:${NC}"
echo "  https://$DOMAIN"
echo ""
echo -e "${GREEN}📝 有用的命令:${NC}"
echo "  查看日志: $SSH_CMD 'cd ~/myWebDrive/infrastructure/alicloud && docker compose -f docker-compose.production.yml logs -f'"
echo "  重启服务: $SSH_CMD 'cd ~/myWebDrive/infrastructure/alicloud && docker compose -f docker-compose.production.yml restart'"
echo "  停止服务: $SSH_CMD 'cd ~/myWebDrive/infrastructure/alicloud && docker compose -f docker-compose.production.yml down'"
echo ""

