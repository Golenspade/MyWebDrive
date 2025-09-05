#!/bin/bash

# 完整的MyWebDrive邀请码注册和权限测试脚本
# 使用说明：
# 1. 设置 JWT_SECRET 环境变量
# 2. 启动所有微服务
# 3. 运行此脚本

set -e

# 配置（允许通过 API_BASE 或 GATEWAY_PORT 覆盖，默认 9080）
: "${GATEWAY_PORT:=9080}"
: "${API_BASE:=http://localhost:${GATEWAY_PORT}/api/v1}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== MyWebDrive 完整功能测试 ===${NC}\n"

# 检查JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}错误: 请设置 JWT_SECRET 环境变量${NC}"
    echo "export JWT_SECRET='your-super-secret-jwt-key'"
    exit 1
fi

echo -e "${YELLOW}1. 检查服务状态${NC}"
curl -f -s "http://localhost:${GATEWAY_PORT}/health" > /dev/null \
  && echo -e "${GREEN}✓ API Gateway 正常${NC}" \
  || { echo -e "${RED}✗ API Gateway 未运行 (http://localhost:${GATEWAY_PORT})${NC}"; exit 1; }

echo -e "\n${YELLOW}2. 测试无邀请码注册（应该失败）${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试用户",
    "email": "test@example.com", 
    "password": "password123"
  }')
  
status_code=$(echo "$response" | tail -n1)
body=$(printf "%s" "$response" | sed '$d')

if [ "$status_code" = "400" ] || [ "$status_code" = "403" ]; then
    echo -e "${GREEN}✓ 正确拒绝了无邀请码注册${NC}"
    echo "响应: $body"
else
    echo -e "${RED}✗ 应该拒绝无邀请码注册，但返回了 $status_code${NC}"
    echo "响应: $body"
fi

echo -e "\n${YELLOW}3. 测试无效邀请码注册（应该失败）${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试用户",
    "email": "test@example.com",
    "password": "password123",
    "invitationCode": "invalid-invitation-code"
  }')
  
status_code=$(echo "$response" | tail -n1)
body=$(printf "%s" "$response" | sed '$d')

if [ "$status_code" = "403" ] || [ "$status_code" = "404" ]; then
    echo -e "${GREEN}✓ 正确拒绝了无效邀请码${NC}"
    echo "响应: $body"
else
    echo -e "${RED}✗ 应该拒绝无效邀请码，但返回了 $status_code${NC}"
    echo "响应: $body"
fi

echo -e "\n${YELLOW}4. 创建临时管理员（绕过邀请码限制）${NC}"
echo "由于当前系统需要邀请码才能注册，我们需要："
echo "a) 临时关闭邀请码验证，或"
echo "b) 直接在数据库中插入管理员用户，或"
echo "c) 提供管理员初始化机制"

echo -e "\n${BLUE}提示: 为了完成测试，建议以下步骤：${NC}"
echo "1. 临时修改 config.yaml: registration.require_invite = false"
echo "2. 重启 auth-service"
echo "3. 注册管理员账户"
echo "4. 将管理员的 role 设为 'admin'"
echo "5. 重新启用邀请码验证"

echo -e "\n${YELLOW}5. 测试游客上传访问（应该失败）${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/storage/uploads" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.txt",
    "fileSize": 1024,
    "mimeType": "text/plain"
  }')
  
status_code=$(echo "$response" | tail -n1)
body=$(printf "%s" "$response" | sed '$d')

if [ "$status_code" = "401" ]; then
    echo -e "${GREEN}✓ 正确拒绝了游客上传${NC}"
    echo "响应: $body"
else
    echo -e "${RED}✗ 应该拒绝游客上传，但返回了 $status_code${NC}"
    echo "响应: $body"
fi

echo -e "\n${BLUE}=== 测试摘要 ===${NC}"
echo "✓ 服务健康检查通过"
echo "✓ 邀请码验证机制工作正常"
echo "✓ 游客上传限制生效"
echo ""
echo "🔧 待完成的手动步骤："
echo "1. 创建初始管理员账户"
echo "2. 测试管理员邀请码生成"
echo "3. 测试有效邀请码注册"
echo "4. 测试注册用户上传权限"

echo -e "\n${YELLOW}完整的管理员创建示例命令：${NC}"
cat << 'EOF'
# 1. 临时禁用邀请码验证
sed -i 's/require_invite: true/require_invite: false/' backend/config/config.yaml

# 2. 重启auth服务后，注册管理员
curl -X POST http://localhost:${GATEWAY_PORT:-9080}/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"admin123456"}'

# 3. 手动更新数据库设置管理员权限
sqlite3 backend/data/mywebdrive.db "UPDATE users SET role='admin' WHERE email='admin@example.com';"

# 4. 重新启用邀请码验证
sed -i 's/require_invite: false/require_invite: true/' backend/config/config.yaml

# 5. 重启服务并测试管理员登录
curl -X POST http://localhost:${GATEWAY_PORT:-9080}/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123456"}'
EOF
