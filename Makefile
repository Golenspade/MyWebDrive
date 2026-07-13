# MyWebDrive 项目构建与运维（Node 版）

.PHONY: help build clean test lint quality-check alicloud-deploy

# 默认目标
help:
	@echo "可用的命令:"
	@echo "  build         - 构建 Core-first 权威工作区"
	@echo "  test          - Core、Storage 与主前端测试"
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
	pnpm run build:all
	@echo "✅ 构建完成"

test:
	@echo "🧪 运行测试..."
	pnpm run test:all
	@echo "✅ 测试步骤完成"

lint:
	@echo "🔍 执行代码检查..."
	pnpm run lint:all
	@echo "Done"

quality-check:
	@echo "🚦 质量检查套件..."
	pnpm run build:all
	pnpm run typecheck
	pnpm run lint:all
	pnpm run test:all
	pnpm run verify:generated
	bash scripts/verify-core-release-contract.sh infrastructure/alicloud/docker-compose.core.yml
	bash scripts/test-core-release-contract.sh
	bash scripts/test-core-cutover-contract.sh
	@echo "✅ 质量检查完成"

# 阿里云部署（Node 版 compose）
alicloud-deploy:
	@test -n "$(IMAGE_TAG)" || (echo "IMAGE_TAG is required" >&2; exit 1)
	cd infrastructure/alicloud && ./deploy.sh "$(IMAGE_TAG)"
	@echo "🎉 部署完成"
