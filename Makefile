# MyWebDrive 项目构建与运维（Node 版）

.PHONY: help build test lint quality-check alicloud-deploy

# 默认目标
help:
	@echo "可用的命令:"
	@echo "  build         - 构建 Core-first 权威工作区"
	@echo "  test          - Core、Storage 与主前端测试"
	@echo "  lint          - 前端/Node 代码检查"
	@echo "  quality-check - Core-first 完整 fail-closed 质量门"
	@echo "  alicloud-deploy - 使用 Core-first 生产发布脚本"

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
	pnpm run verify:docs
	pnpm run build:all
	pnpm run typecheck
	pnpm run lint:all
	pnpm run test:all
	pnpm run verify:generated
	bash scripts/test-repo-authority-contract.sh
	bash scripts/test-core-dev-contract.sh
	bash scripts/verify-core-release-contract.sh infrastructure/alicloud/docker-compose.core.yml
	bash scripts/test-core-release-contract.sh
	bash scripts/test-core-cutover-contract.sh
	@echo "✅ 质量检查完成"

# 阿里云 Core-first 部署
alicloud-deploy:
	@test -n "$(IMAGE_TAG)" || (echo "IMAGE_TAG is required" >&2; exit 1)
	cd infrastructure/alicloud && ./deploy.sh "$(IMAGE_TAG)"
	@echo "🎉 部署完成"
