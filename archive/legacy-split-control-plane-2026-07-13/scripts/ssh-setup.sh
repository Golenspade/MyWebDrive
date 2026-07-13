#!/bin/bash

# SSH密钥配置脚本
# 帮助你快速配置SSH免密登录

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔑 SSH密钥配置向导${NC}"
echo ""

# 获取服务器信息
read -p "请输入服务器IP地址: " SERVER_IP
read -p "请输入SSH用户名 [默认: root]: " SERVER_USER
SERVER_USER=${SERVER_USER:-root}
read -p "请输入SSH端口 [默认: 22]: " SERVER_PORT
SERVER_PORT=${SERVER_PORT:-22}

# 检查本地是否有SSH密钥
if [ ! -f ~/.ssh/id_rsa ]; then
    echo -e "${YELLOW}未找到SSH密钥，正在生成...${NC}"
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    echo -e "${GREEN}✅ SSH密钥生成完成${NC}"
else
    echo -e "${GREEN}✅ 找到现有SSH密钥${NC}"
fi

# 复制公钥到服务器
echo -e "${BLUE}正在配置免密登录...${NC}"
echo "请输入服务器密码："

ssh-copy-id -i ~/.ssh/id_rsa.pub -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP"

# 测试连接
echo -e "${BLUE}测试SSH连接...${NC}"
if ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" "echo '连接成功'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH免密登录配置成功！${NC}"
    echo ""
    echo "现在你可以使用以下命令部署："
    echo -e "${BLUE}  ./scripts/quick-deploy.sh $SERVER_IP${NC}"
    echo ""
    echo "或者使用完整部署脚本："
    echo -e "${BLUE}  ./scripts/deploy-to-server.sh $SERVER_IP${NC}"
else
    echo -e "${RED}❌ SSH连接测试失败${NC}"
    exit 1
fi

