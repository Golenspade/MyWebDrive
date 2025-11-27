#!/bin/bash
# 快速测试搜索功能 - 只启动必要的服务

set -e

# 加载环境变量
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  echo "✓ Loaded .env"
fi

# 确保端口配置正确
export AUTH_PORT=7091
export USER_PORT=7092
export METADATA_PORT=7093
export STORAGE_PORT=7094
export SHARING_PORT=7095
export GATEWAY_PORT=9090

export AUTH_SERVICE_URL=http://localhost:7091
export USER_SERVICE_URL=http://localhost:7092
export METADATA_SERVICE_URL=http://localhost:7093
export STORAGE_SERVICE_URL=http://localhost:7094
export SHARING_SERVICE_URL=http://localhost:7095

echo "=== Killing old processes ==="
pkill -f "tsx watch.*services" || true
sleep 2

echo "=== Starting services ==="
mkdir -p logs

# Auth
echo "Starting Auth on :7091..."
cd services/auth
pnpm dev > ../../logs/auth-test.log 2>&1 &
AUTH_PID=$!
cd ../..
sleep 2

# User
echo "Starting User on :7092..."
cd services/user
pnpm dev > ../../logs/user-test.log 2>&1 &
USER_PID=$!
cd ../..
sleep 2

# Metadata
echo "Starting Metadata on :7093..."
cd services/metadata
pnpm dev > ../../logs/metadata-test.log 2>&1 &
META_PID=$!
cd ../..
sleep 3

# Gateway
echo "Starting Gateway on :9090..."
cd services/api-gateway-node
pnpm dev > ../../logs/gateway-test.log 2>&1 &
GW_PID=$!
cd ../..
sleep 3

echo ""
echo "=== Health Checks ==="
curl -fsS http://localhost:7091/health && echo "✓ Auth (7091)" || echo "✗ Auth FAIL"
curl -fsS http://localhost:7092/health && echo "✓ User (7092)" || echo "✗ User FAIL"
curl -fsS http://localhost:7093/health && echo "✓ Metadata (7093)" || echo "✗ Metadata FAIL"
curl -fsS http://localhost:9090/health && echo "✓ Gateway (9090)" || echo "✗ Gateway FAIL"

echo ""
echo "=== Service PIDs ==="
echo "Auth: $AUTH_PID"
echo "User: $USER_PID"
echo "Metadata: $META_PID"
echo "Gateway: $GW_PID"

echo ""
echo "=== Logs ==="
echo "Auth:     tail -f logs/auth-test.log"
echo "User:     tail -f logs/user-test.log"
echo "Metadata: tail -f logs/metadata-test.log"
echo "Gateway:  tail -f logs/gateway-test.log"

echo ""
echo "Services running. Press Ctrl+C to stop all."
wait

