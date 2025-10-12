#!/bin/bash

# MyWebDrive 快速部署脚本（简化版）
# 使用方法: ./quick-deploy.sh <服务器IP>

set -e

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVER_IP="$1"

if [ -z "$SERVER_IP" ]; then
    echo "使用方法: ./quick-deploy.sh <服务器IP>"
    echo "示例: ./quick-deploy.sh 123.45.67.89"
    exit 1
fi

echo -e "${BLUE}🚀 开始快速部署到服务器: $SERVER_IP${NC}"

# 默认配置
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/MyWebDrive}"

echo -e "${BLUE}📦 推送代码到服务器...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'build' \
    --exclude 'logs' \
    --exclude 'data' \
    --exclude '.env' \
    --exclude 'infrastructure/alicloud/.env' \
    -e "ssh -p $SERVER_PORT" \
    ./ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo -e "${BLUE}🔧 在服务器上部署...${NC}"
ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
cd /opt/MyWebDrive/infrastructure/alicloud

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "创建.env文件..."
    cp env.example .env
    echo "⚠️  请编辑 /opt/MyWebDrive/infrastructure/alicloud/.env 文件"
fi

# 给脚本执行权限
chmod +x deploy.sh rollback.sh backup-restore.sh

# 首次/每次部署前构建后端 dist 产物（在宿主机用 Docker 进行一次性构建）
cd /opt/MyWebDrive
./scripts/build-all-node.sh

# 执行部署
cd /opt/MyWebDrive/infrastructure/alicloud
./deploy.sh production latest
ENDSSH

echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "访问信息:"
echo "  API网关: http://$SERVER_IP:9080"
echo "  前端应用: http://$SERVER_IP"
echo ""
echo "查看日志:"
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $REMOTE_DIR/infrastructure/alicloud && docker-compose -f docker-compose.node.yml logs -f'"
