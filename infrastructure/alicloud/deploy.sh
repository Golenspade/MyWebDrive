#!/bin/bash

# 阿里云部署脚本
# 使用方法: ./deploy.sh [环境] [版本]
# 例如: ./deploy.sh production v1.0.0

set -e

# 默认参数
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
COMPOSE_FILE="docker-compose.node.yml"

echo "🚀 开始部署 MyWebDrive 到阿里云..."
echo "环境: $ENVIRONMENT"
echo "版本: $VERSION"

# 检查必要的文件
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在，请先复制 env.example 为 .env 并配置"
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ 错误: $COMPOSE_FILE 文件不存在"
    exit 1
fi

# 创建必要的数据目录
echo "📁 创建数据目录..."
sudo mkdir -p /data/{sqlite,redis,minio}
sudo chmod 755 /data/{sqlite,redis,minio}

# 设置版本环境变量
export VERSION=$VERSION

# Node 版 compose 基于本地源码运行，无需拉取镜像
echo "📦 跳过镜像拉取（Node 版 compose 使用本地 workspace）"

# 停止现有服务
echo "🛑 停止现有服务..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# 启动服务
echo "🔄 启动服务 (Node 版)..."
docker-compose -f $COMPOSE_FILE up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 运行 Prisma 生成与迁移（best-effort）
echo "🧭 生成 Prisma 客户端并执行 migrate deploy..."
for svc in auth user metadata storage sharing; do
  echo "   > prisma migrate for $svc"
  docker-compose -f $COMPOSE_FILE exec -T $svc sh -lc \
    "corepack enable && corepack prepare pnpm@9.7.0 --activate && \
     pnpm --filter ./services/$svc prisma:generate && \
     (pnpm --filter ./services/$svc run migrate:deploy || pnpm --filter ./services/$svc run db:push || true)" || true
done

# 健康检查（Node 端口）
echo "🔍 执行健康检查..."
services=("api-gateway-node:9080" "auth:7081" "user:7082" "metadata:7083" "storage:7084" "sharing:7085")

for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -f -s "http://localhost:$port/health" > /dev/null; then
        echo "✅ $service_name 健康检查通过"
    else
        echo "❌ $service_name 健康检查失败"
        docker-compose -f $COMPOSE_FILE logs $service_name
    fi
done

# 显示运行状态
echo "📊 服务状态:"
docker-compose -f $COMPOSE_FILE ps

echo "🎉 部署完成!"
echo ""
echo "📋 访问信息:"
echo "  - 前端应用: http://localhost"
echo "  - API网关: http://localhost:9080"
echo "  - MinIO控制台: http://localhost:9001"
echo ""
echo "📝 查看日志: docker-compose -f $COMPOSE_FILE logs -f [服务名]"
echo "🛑 停止服务: docker-compose -f $COMPOSE_FILE down"
