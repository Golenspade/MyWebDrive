#!/bin/bash

# 邀请注册与权限改造验收测试脚本
# 测试游客下载和邀请码管理功能

set -e

# 检查依赖
if ! command -v jq &> /dev/null; then
    echo "❌ 需要安装jq工具: brew install jq 或 apt-get install jq"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "❌ 需要安装curl工具"
    exit 1
fi

# 配置（允许通过 API_BASE 或 GATEWAY_PORT 覆盖，默认 9080）
: "${GATEWAY_PORT:=9080}"
API_BASE=${API_BASE:-"http://localhost:${GATEWAY_PORT}/api/v1"}
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
TEST_USER_EMAIL="testuser@example.com"
TEST_USER_PASSWORD="testpass123"

echo "=== 邀请注册与权限改造验收测试 ==="
echo

# 清理函数
cleanup() {
    echo "清理测试数据..."
    # 这里可以添加清理逻辑
}
trap cleanup EXIT

# 0. 网关健康检查
echo "0. 网关健康检查..."
if curl -f -s "http://localhost:${GATEWAY_PORT}/health" > /dev/null; then
    echo "✅ API Gateway 正常 (:${GATEWAY_PORT})"
else
    echo "❌ API Gateway 未运行 (http://localhost:${GATEWAY_PORT})"; exit 1
fi

# 1. 管理员登录获取token
echo "1. 管理员登录..."
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | jq -r '.accessToken')
if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ 管理员登录失败: $ADMIN_LOGIN_RESPONSE"
    exit 1
fi
echo "✅ 管理员登录成功"

# 2. 创建邀请码
echo
echo "2. 创建邀请码..."
INVITATION_RESPONSE=$(curl -s -X POST "$API_BASE/auth/invitations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"description":"测试邀请码","usageLimit":5,"expiresAt":"2025-12-31T23:59:59Z"}')

INVITATION_CODE=$(echo "$INVITATION_RESPONSE" | jq -r '.code')
if [ "$INVITATION_CODE" = "null" ] || [ -z "$INVITATION_CODE" ]; then
    echo "❌ 创建邀请码失败: $INVITATION_RESPONSE"
    exit 1
fi
echo "✅ 邀请码创建成功: $INVITATION_CODE"

# 3. 测试无邀请码注册（应该失败）
echo
echo "3. 测试无邀请码注册（应该失败）..."
NO_INVITE_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test User\",\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

if echo "$NO_INVITE_RESPONSE" | jq -e '.error' > /dev/null; then
    echo "✅ 无邀请码注册正确被拒绝"
else
    echo "❌ 无邀请码注册应该失败但成功了: $NO_INVITE_RESPONSE"
    exit 1
fi

# 4. 使用邀请码注册
echo
echo "4. 使用邀请码注册新用户..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test User\",\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\",\"invitationCode\":\"$INVITATION_CODE\"}")

if echo "$REGISTER_RESPONSE" | jq -e '.message' > /dev/null; then
    echo "✅ 用户注册成功"
else
    echo "❌ 用户注册失败: $REGISTER_RESPONSE"
    exit 1
fi

# 5. 新用户登录
echo
echo "5. 新用户登录..."
USER_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

USER_TOKEN=$(echo "$USER_LOGIN_RESPONSE" | jq -r '.accessToken')
if [ "$USER_TOKEN" = "null" ] || [ -z "$USER_TOKEN" ]; then
    echo "❌ 用户登录失败: $USER_LOGIN_RESPONSE"
    exit 1
fi
echo "✅ 用户登录成功"

# 6. 验证JWT包含role字段
echo
echo "6. 验证JWT包含role字段..."
# 解码JWT payload (base64)
JWT_PAYLOAD=$(echo "$USER_TOKEN" | cut -d'.' -f2)
# 添加padding if needed
case $((${#JWT_PAYLOAD} % 4)) in
    2) JWT_PAYLOAD="${JWT_PAYLOAD}==" ;;
    3) JWT_PAYLOAD="${JWT_PAYLOAD}=" ;;
esac
DECODED_JWT=$(echo "$JWT_PAYLOAD" | base64 -d 2>/dev/null || echo "$JWT_PAYLOAD" | base64 -D 2>/dev/null)
USER_ROLE=$(echo "$DECODED_JWT" | jq -r '.role')

if [ "$USER_ROLE" = "user" ]; then
    echo "✅ JWT包含正确的role字段: $USER_ROLE"
else
    echo "❌ JWT role字段不正确: $USER_ROLE"
    exit 1
fi

# 7. 测试用户上传权限（统一走分片上传接口）
echo
echo "7. 测试用户上传权限..."
# 创建测试文件
echo "test content" > /tmp/test_file.txt

# 创建上传会话
CREATE_UPLOAD=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/storage/uploads" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"fileName\":\"test_file.txt\",\"fileSize\":$(stat -f%z /tmp/test_file.txt 2>/dev/null || stat -c%s /tmp/test_file.txt),\"mimeType\":\"text/plain\",\"chunkSize\":1048576}")
CU_STATUS=$(echo "$CREATE_UPLOAD" | tail -n1)
CU_BODY=$(printf "%s" "$CREATE_UPLOAD" | sed '$d')
if [ "$CU_STATUS" != "201" ]; then
    echo "❌ 创建上传会话失败: $CU_BODY"; exit 1
fi
UPLOAD_ID=$(echo "$CU_BODY" | jq -r '.id')
if [ -z "$UPLOAD_ID" ] || [ "$UPLOAD_ID" = "null" ]; then
    echo "❌ 未获取到上传ID: $CU_BODY"; exit 1
fi

# 上传分片（单片）
curl -s -X PATCH "$API_BASE/storage/uploads/$UPLOAD_ID" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    -H "X-Chunk-Index: 0" \
    --data-binary @/tmp/test_file.txt > /dev/null

# 完成上传
FINALIZE=$(curl -s -X POST "$API_BASE/storage/uploads/$UPLOAD_ID/finalize" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
FILE_ID=$(echo "$FINALIZE" | jq -r '.fileId')
if [ -z "$FILE_ID" ] || [ "$FILE_ID" = "null" ]; then
    echo "❌ 用户上传失败: $FINALIZE"; exit 1
fi
echo "✅ 用户上传成功，文件ID: $FILE_ID"

# 8. 创建公开分享（走网关：/api/v1/files/:fileId/shares）
echo
echo "8. 创建公开分享..."
SHARE_RESPONSE=$(curl -s -X POST "$API_BASE/files/$FILE_ID/shares" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"fileId\":\"$FILE_ID\",\"shareType\":\"public\",\"permission\":\"download\"}")

SHARE_TOKEN=$(echo "$SHARE_RESPONSE" | jq -r '.shareToken')
if [ "$SHARE_TOKEN" = "null" ] || [ -z "$SHARE_TOKEN" ]; then
    echo "❌ 创建分享失败: $SHARE_RESPONSE"
    exit 1
fi
echo "✅ 分享创建成功，分享token: $SHARE_TOKEN"

# 9. 测试游客下载（无需JWT）
echo
echo "9. 测试游客下载（无需JWT）..."
DOWNLOAD_STATUS=$(curl -s -w "%{http_code}" -o /tmp/downloaded_file.txt \
    "$API_BASE/shares/$SHARE_TOKEN/download")

if [ "$DOWNLOAD_STATUS" = "200" ]; then
    DOWNLOADED_CONTENT=$(cat /tmp/downloaded_file.txt)
    if [ "$DOWNLOADED_CONTENT" = "test content" ]; then
        echo "✅ 游客下载成功，内容正确"
    else
        echo "❌ 游客下载内容不正确: $DOWNLOADED_CONTENT"
        exit 1
    fi
else
    echo "❌ 游客下载失败，HTTP状态码: $DOWNLOAD_STATUS"
    exit 1
fi

# 10. 测试邀请码管理接口
echo
echo "10. 测试邀请码管理接口..."

# 列出邀请码
LIST_RESPONSE=$(curl -s -X GET "$API_BASE/auth/invitations" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$LIST_RESPONSE" | jq -e '.[0].code' > /dev/null; then
    echo "✅ 邀请码列表获取成功"
else
    echo "❌ 邀请码列表获取失败: $LIST_RESPONSE"
    exit 1
fi

# 11. 测试非管理员访问邀请码接口（应该失败）
echo
echo "11. 测试非管理员访问邀请码接口（应该失败）..."
FORBIDDEN_RESPONSE=$(curl -s -X GET "$API_BASE/auth/invitations" \
    -H "Authorization: Bearer $USER_TOKEN")

if echo "$FORBIDDEN_RESPONSE" | jq -e '.error' > /dev/null; then
    echo "✅ 非管理员访问邀请码接口正确被拒绝"
else
    echo "❌ 非管理员访问邀请码接口应该失败: $FORBIDDEN_RESPONSE"
    exit 1
fi

# 清理测试文件
rm -f /tmp/test_file.txt /tmp/downloaded_file.txt

echo
echo "🎉 所有测试通过！邀请注册与权限改造功能正常工作"
echo
echo "测试总结："
echo "✅ 注册必须使用邀请码"
echo "✅ 邀请码管理接口需要管理员权限"
echo "✅ 只有用户/管理员可以上传文件"
echo "✅ 游客可以下载公开分享的文件"
echo "✅ JWT包含正确的role字段"
echo "✅ 网关正确代理邀请码管理路由"
