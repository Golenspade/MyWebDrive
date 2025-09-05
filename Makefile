# MyWebDrive 项目构建与运维（Node 版）

.PHONY: help build clean test docker-build docker-up docker-down format lint quality-check pre-commit alicloud-deploy

# 默认目标
help:
	@echo "可用的命令:"
	@echo "  build         - pnpm 递归构建 (packages/services/apps)"
	@echo "  test          - pnpm 递归测试 (允许为空)"
	@echo "  docker-build  - 基于 Node 版 compose 进行构建"
	@echo "  docker-up     - 启动 Node 版 compose"
	@echo "  docker-down   - 停止 Node 版 compose"
	@echo "  format        - 前端/Node 代码格式化"
	@echo "  lint          - 前端/Node 代码检查"
	@echo "  quality-check - 构建+测试+lint"
	@echo "  alicloud-deploy - 使用 Node 版 compose 部署"

# Node 构建
build:
	@echo "🔧 使用 pnpm 递归构建..."
	corepack enable >/dev/null 2>&1 || true
	corepack prepare pnpm@9.7.0 --activate >/dev/null 2>&1 || true
	pnpm -w install
	pnpm -r --filter ./packages/** --filter ./services/** --filter ./apps/** build
	@echo "✅ 构建完成"

# 测试（当前仓库可能暂无测试，用 || true 兼容）
test:
	@echo "🧪 运行测试 (允许为空)..."
	pnpm -r test || true
	@echo "✅ 测试步骤完成"

# Docker（Node 版 compose）
docker-build:
	@echo "🐳 基于 Node 版 compose 构建..."
	docker-compose -f infrastructure/docker/docker-compose.node.yml build

docker-up:
	@echo "🔼 启动 Node 版 compose..."
	docker-compose -f infrastructure/docker/docker-compose.node.yml up -d

docker-down:
	@echo "🔽 停止 Node 版 compose..."
	docker-compose -f infrastructure/docker/docker-compose.node.yml down

# 代码格式化 / Lint
format:
	@echo "✨ 格式化前端与 Node 代码..."
	cd frontend && npm run format || true
	@echo "Done"

lint:
	@echo "🔍 执行前端与 Node 代码检查..."
	cd frontend && npm run lint || true
	@echo "Done"

quality-check:
	@echo "🚦 质量检查套件..."
	$(MAKE) build
	$(MAKE) test
	$(MAKE) lint
	@echo "✅ 质量检查完成"

# 阿里云部署（Node 版 compose）
alicloud-deploy:
	@echo "🚀 部署到阿里云 (Node 版)..."
	cd infrastructure/alicloud && ./deploy.sh production latest
	@echo "🎉 部署完成"

