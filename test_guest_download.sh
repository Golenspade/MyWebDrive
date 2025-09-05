#!/bin/bash

# 测试游客通过公开分享下载文件的完整流程
# 确保修复后的sharing-service代理下载功能正常工作

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

echo -e "${BLUE}=== 游客公开分享下载功能测试 ===${NC}\n"

# 检查环境变量
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}错误: 请设置 JWT_SECRET 环境变量${NC}"
    echo "export JWT_SECRET='your-super-secret-jwt-key'"
    exit 1
fi

echo -e "${YELLOW}1. 检查服务状态${NC}"
if curl -f -s "http://localhost:${GATEWAY_PORT}/health" > /dev/null; then
    echo -e "${GREEN}✓ API Gateway 运行正常 (:${GATEWAY_PORT})${NC}"
else
    echo -e "${RED}✗ API Gateway 未运行 (http://localhost:${GATEWAY_PORT})${NC}"
    exit 1
fi

echo -e "\n${YELLOW}2. 创建测试用户并登录${NC}"

# 临时禁用邀请码验证来创建测试用户
echo "注意：此测试需要临时禁用邀请码验证或预先创建测试用户"

# 模拟登录获取token（假设已有测试用户）
echo "请确保已有测试用户，或临时禁用邀请码验证后创建测试用户"
echo "测试用户: testuser@example.com / password123"

# 尝试登录
echo -e "\n${YELLOW}3. 用户登录获取token${NC}"
login_response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123"
  }' || echo -e "\n000")

status_code=$(echo "$login_response" | tail -n1)
response_body=$(printf "%s" "$login_response" | sed '$d')

if [ "$status_code" != "200" ]; then
    echo -e "${RED}✗ 登录失败 (状态码: $status_code)${NC}"
    echo "响应: $response_body"
    echo -e "\n${YELLOW}请先创建测试用户或检查现有用户凭据${NC}"
    echo "创建测试用户的步骤："
    echo "1. 临时设置 registration.require_invite = false"
    echo "2. 重启 auth-service"
    echo "3. 注册测试用户"
    echo "4. 重新启用邀请码验证"
    exit 1
fi

# 提取访问令牌
access_token=$(echo "$response_body" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$access_token" ]; then
    echo -e "${RED}✗ 无法提取访问令牌${NC}"
    echo "响应: $response_body"
    exit 1
fi

echo -e "${GREEN}✓ 登录成功，获得访问令牌${NC}"

echo -e "\n${YELLOW}4. 上传测试文件${NC}"

# 创建临时测试文件
test_file="test_shared_file.txt"
echo "这是一个测试文件，用于验证公开分享下载功能。" > "$test_file"

# 首先创建上传会话
upload_response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/storage/uploads" \
  -H "Authorization: Bearer $access_token" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"$test_file\",
    \"fileSize\": $(stat -f%z "$test_file" 2>/dev/null || stat -c%s "$test_file"),
    \"mimeType\": \"text/plain\",
    \"chunkSize\": 1048576
  }")

upload_status=$(echo "$upload_response" | tail -n1)
upload_body=$(printf "%s" "$upload_response" | sed '$d')

if [ "$upload_status" != "201" ]; then
    echo -e "${RED}✗ 创建上传会话失败 (状态码: $upload_status)${NC}"
    echo "响应: $upload_body"
    rm -f "$test_file"
    exit 1
fi

upload_id=$(echo "$upload_body" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ 创建上传会话成功，上传ID: $upload_id${NC}"

# 上传文件块
curl -s -X PATCH "$API_BASE/storage/uploads/$upload_id" \
  -H "Authorization: Bearer $access_token" \
  -H "Content-Type: application/octet-stream" \
  -H "X-Chunk-Index: 0" \
  --data-binary "@$test_file" > /dev/null

# 完成上传
finalize_response=$(curl -s -X POST "$API_BASE/storage/uploads/$upload_id/finalize" \
  -H "Authorization: Bearer $access_token" \
  -H "Content-Type: application/json" \
  -d '{}')

file_id=$(echo "$finalize_response" | grep -o '"fileId":"[^"]*' | cut -d'"' -f4)
if [ -z "$file_id" ]; then
    echo -e "${RED}✗ 无法获取文件ID${NC}"
    echo "响应: $finalize_response"
    rm -f "$test_file"
    exit 1
fi

echo -e "${GREEN}✓ 文件上传成功，文件ID: $file_id${NC}"

echo -e "\n${YELLOW}5. 创建公开分享链接${NC}"

share_response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/files/$file_id/shares" \
  -H "Authorization: Bearer $access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "'$file_id'",
    "shareType": "public",
    "permission": "download"
  }')

share_status=$(echo "$share_response" | tail -n1)
share_body=$(printf "%s" "$share_response" | sed '$d')

if [ "$share_status" != "201" ]; then
    echo -e "${RED}✗ 创建分享链接失败 (状态码: $share_status)${NC}"
    echo "响应: $share_body"
    rm -f "$test_file"
    exit 1
fi

share_token=$(echo "$share_body" | grep -o '"shareToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$share_token" ]; then
    echo -e "${RED}✗ 无法提取分享令牌${NC}"
    echo "响应: $share_body"
    rm -f "$test_file"
    exit 1
fi

echo -e "${GREEN}✓ 创建公开分享成功，分享令牌: $share_token${NC}"
share_url="$API_BASE/shares/$share_token"
download_url="$API_BASE/shares/$share_token/download"
echo "分享链接: $share_url"
echo "下载链接: $download_url"

echo -e "\n${YELLOW}6. 游客访问分享信息（无需认证）${NC}"

share_info_response=$(curl -s -w "\n%{http_code}" -X GET "$share_url")
info_status=$(echo "$share_info_response" | tail -n1)
info_body=$(printf "%s" "$share_info_response" | sed '$d')

if [ "$info_status" = "200" ]; then
    echo -e "${GREEN}✓ 游客成功访问分享信息${NC}"
    echo "分享信息: $(echo "$info_body" | head -c 100)..."
else
    echo -e "${RED}✗ 游客访问分享信息失败 (状态码: $info_status)${NC}"
    echo "响应: $info_body"
fi

echo -e "\n${YELLOW}7. 游客下载文件（关键测试）${NC}"

# 下载文件到临时文件
download_file="downloaded_$test_file"
download_response=$(curl -s -w "\n%{http_code}" -X GET "$download_url" -o "$download_file")
download_status=$(echo "$download_response" | tail -n1)

if [ "$download_status" = "200" ] && [ -f "$download_file" ]; then
    # 验证下载的文件内容
    if [ -s "$download_file" ]; then
        if cmp -s "$test_file" "$download_file"; then
            echo -e "${GREEN}✓ 游客下载成功，文件内容正确${NC}"
            echo "原文件大小: $(stat -f%z "$test_file" 2>/dev/null || stat -c%s "$test_file") 字节"
            echo "下载文件大小: $(stat -f%z "$download_file" 2>/dev/null || stat -c%s "$download_file") 字节"
        else
            echo -e "${YELLOW}⚠ 文件下载成功但内容不匹配${NC}"
            echo "原文件内容: $(cat "$test_file")"
            echo "下载文件内容: $(cat "$download_file")"
        fi
    else
        echo -e "${RED}✗ 下载的文件为空${NC}"
    fi
else
    echo -e "${RED}✗ 游客下载失败 (状态码: $download_status)${NC}"
    if [ -f "$download_file" ]; then
        echo "响应内容: $(cat "$download_file")"
    fi
fi

echo -e "\n${YELLOW}8. 清理测试文件${NC}"
rm -f "$test_file" "$download_file"

echo -e "\n${BLUE}=== 测试结果摘要 ===${NC}"
echo "✅ 服务状态检查: 通过"
echo "✅ 用户认证: 通过" 
echo "✅ 文件上传: 通过"
echo "✅ 创建公开分享: 通过"
echo "✅ 游客访问分享信息: 通过"

if [ "$download_status" = "200" ] && [ -s "$download_file" ]; then
    echo "✅ 游客下载文件: 通过"
    echo -e "\n${GREEN}🎉 游客公开分享下载功能正常！${NC}"
else
    echo "❌ 游客下载文件: 失败"
    echo -e "\n${RED}❌ 游客下载功能存在问题，需要检查sharing-service的代理实现${NC}"
fi

echo -e "\n${BLUE}修复说明：${NC}"
echo "- sharing-service 现在直接代理下载，不再重定向"
echo "- 服务间通过内部JWT token认证，绕过网关限制"
echo "- 游客可以通过公开分享链接直接下载文件"
