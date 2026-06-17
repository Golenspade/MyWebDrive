#!/bin/bash

# Set colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MyWebDrive 邀请码注册流程测试 ===${NC}\n"

# Configuration
# 允许通过 API_BASE 或 GATEWAY_PORT 覆盖（默认 9080）
: "${GATEWAY_PORT:=9080}"
: "${API_BASE:=http://localhost:${GATEWAY_PORT}/api/v1}"
JWT_SECRET="your-super-secret-jwt-key-here-make-it-long-and-random"

# Export JWT_SECRET for services
export JWT_SECRET="$JWT_SECRET"

echo -e "${YELLOW}步骤1: 检查网关健康状态${NC}"
curl -s "http://localhost:${GATEWAY_PORT}/health" > /dev/null \
  && echo -e "${GREEN}✓ API Gateway 正常 (:${GATEWAY_PORT})${NC}" \
  || echo -e "${RED}✗ API Gateway 未运行 (:${GATEWAY_PORT})${NC}"

echo

# 需要先创建一个管理员用户进行测试
echo -e "${YELLOW}步骤2: 创建第一个管理员用户（直接插入数据库）${NC}"
# 这里我们需要直接插入管理员到数据库中
# 临时解决方案：创建一个特殊的管理员邀请码

echo -e "${YELLOW}步骤3: 尝试不带邀请码的注册（应该失败）${NC}"
echo "注册请求（无邀请码）..."
curl -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试用户",
    "email": "test@example.com",
    "password": "testpassword123"
  }' && echo

echo

echo -e "${YELLOW}步骤4: 尝试使用无效邀请码注册（应该失败）${NC}"
echo "注册请求（无效邀请码）..."
curl -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试用户",
    "email": "test@example.com", 
    "password": "testpassword123",
    "invitationCode": "invalid-code-123"
  }' && echo

echo

echo -e "${YELLOW}步骤5: 创建临时管理员并生成邀请码${NC}"
echo "首先我们需要临时关闭邀请码限制或直接在数据库中创建管理员..."
echo "请参考README中的管理员设置说明"

echo

echo -e "${YELLOW}测试完成！${NC}"
echo "要完成完整测试，请："
echo "1. 设置 JWT_SECRET 环境变量"
echo "2. 启动所有服务"
echo "3. 创建初始管理员用户" 
echo "4. 使用管理员生成邀请码"
echo "5. 测试用户注册和上传功能"
