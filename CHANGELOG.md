# Changelog

All notable changes to this repository will be documented in this file.

## readyfordeploy - 2025-10-09

### Changed
- infra(alicloud): 将 Node 服务在 docker-compose 中的 command 改为“仅启动 dist”，移除运行期安装/构建逻辑，提升稳定性与启动速度。
- infra(node): 为所有 Node 服务容器设置 `PNPM_NODE_LINKER=isolated`，避免 workspace 根级 hoist/link 带来的不稳定。

### Added
- scripts: 新增一次性构建脚本 `scripts/build-all-node.sh`（Node 20 容器内执行），完成：
  - packages/* 与 services/* 的 `pnpm install`
  - Prisma Client 生成
  - TypeScript 强制全量构建（`tsc -b --force`）
  - 包含 `services/api-gateway-node` 的安装与构建

### Fixed
- esm/prisma: 修复 NodeNext ESM 下的 Prisma Client 导入路径，`auth/metadata/storage` 改为 `../prisma/client/index.js`。
- ts(metadata): 移除两处无用的 `@ts-expect-error` 注释，消除 TS2578 报错。

### Chore
- common: 增加 devDependencies（`typescript`、`@types/node`、`rimraf`），保证包内可独立构建与清理。

### Verify
- 服务器容器健康检查均返回 200：
  - 9080 网关、7081 Auth、7082 User、7083 Metadata、7084 Storage、7085 Sharing
- 验证命令（服务器）：`curl http://localhost:{9080|7081|7082|7083|7084|7085}/health`

### Notes
- 本次变更使得部署流程为：先执行 `./scripts/build-all-node.sh` 进行一次性构建，再 `docker compose up -d` 启动服务。
- 适用于切换到新服务器的场景：先拉取仓库 → 运行构建脚本 → 启动 compose。

## Unreleased

### Added
- scripts: `manage-services.sh start-frontend-prod`（构建并以 `next start` 方式启动 frontend/cruip-landing，输出日志到 `logs/frontend.log` 与 `logs/frontend.build.log`）。

### Changed
- docs: README、MIGRATION_TO_NODE、CORS 等文档统一说明前端改为 `frontend/cruip-landing`（Next.js），默认端口调整为 3100。
- env: `.env` 与 `docs/env.example` 增加 `FRONTEND_HOST/FRONTEND_PORT/API_BASE_URL` 示例，CORS 说明改为指向新的前端。
- scripts: `manage-services.sh` 的 `start-frontend` 改为 Next dev，停止逻辑清理 PID 文件。

### Verify
- `./manage-services.sh status`



## 2025-10-01-1636 - 2025-10-01

### Added
- docs: 新增前端路由与跳转清单（docs/site-map.md），覆盖 frontend/cruip-landing 的 App Router、/docs 站点与跳转元素。
- docs: 新增文档页（/docs/guide/low-cost-cinematic-pipeline.mdx），整理“低成本高画面制作（摇轮椅）”工作流。

### Changed
- docs: 更新指南分区导航（pages/docs/guide/_meta.js），加入“低成本高画面制作（摇轮椅）”入口。

### Verify
- 文档结构本地检查：/docs/guide/low-cost-cinematic-pipeline 路由存在；docs/site-map.md 内容与代码库一致。

### Notes
- Tag: 2025-10-01-1636。

## 2025-09-30-2220 - 2025-09-30

### Added
- docs: 搭建完整教学文档结构（pages/docs/ 下 getting-started、guide、resources、api、best-practices、faq）。
- docs: 新增 API 认证与示例页面（api/authentication.mdx、api/examples.mdx）。
- docs: 新增最佳实践子页（performance.mdx、workflow.mdx、quality.mdx）。
- docs: 重写文档首页（/docs/index.mdx）提供快速导航与重要链接。

### Changed
- docs: 更新主侧边导航（_meta.js）与图标，结构更清晰。

### Fixed
- docs: 修复 Nextra _meta 校验错误（补齐缺失页面导致的 500）。

### Verify
- 本地启动 Next 开发服务器，/docs、/docs/guide、/docs/best-practices、/docs/api 均返回 200。

### Notes
- Tag: 2025-09-30-2220。
- 仅本地提交与打 tag（未推送远程）。


## 2025-09-30-2145 - 2025-09-30

### Fixed
- ci: 更新 pnpm-lock.yaml，修复 ERR_PNPM_OUTDATED_LOCKFILE（CI 安装依赖步骤恢复通过）。
- landing: 首页 Logo 组件默认使用 SVG，失败回退 PNG，消除 logo-07/08 的 404。

### Notes
- Tag: 2025-09-30-2145。
- Workflow: node-build-test Success。


## 2025-09-30

### Docs/Infra
- docs: 回退至 Nextra v3（迁移文档至 `pages/docs/`；删除 v4 遗留：`app/docs/*` 与 `mdx-components.ts`）。
- config: 更新 `next.config.js`（withNextra v3）与 `theme.config.jsx`；新增 `pages/_app.tsx` 以满足 Nextra v3 要求。
- docs: 迁移 `txt2mp4` 文档到 `pages/docs/txt2mp4/`；新增 `NEXTRA_V3_MIGRATION.md` 与 `docs/NEXTRA_QUICK_START.md`。
- verify: 本地开发环境验证 `/docs` 与 `/docs/txt2mp4` 响应 200 OK。

## 2025-09-28

### Docs/Infra
- catalog/docs: Clarify that download assets using `/assets/...` are served from repository root `assetsReal/` via Node gateway static mapping. Provide quick verification (`/assets/test.txt`) and recovery guidance.
- ops: Advise avoiding `git clean -fdx` on this repo when using local large artifacts under `assetsReal/` (ignored by Git). Recommend using an external persistent directory with a directory symlink to `assetsReal/`, or making the gateway static dir configurable via env (e.g., `ASSETS_DIR`).

### Notes
- User confirmed two real catalog entries: `webgal` and `l2dw`. Their files should be located at `assetsReal/WebGAL_Terre_MyGO3.0.0.zip` and `assetsReal/l2dw-1.4.21f1修复专注预览界面不换行不适配问题.7z` respectively. Current working copy does not contain these files; they must be copied back for the links to work.
- Frontend CSS/ShimmerButton experiment was rolled back to avoid global style overrides; no net UI change committed.


## release-20250927-2230 - 2025-09-27

### Changed
- frontend(web + landing): adopt self-hosted CN typography via next/font/local; default body font Noto Sans SC, display font ZCOOL XiaoWei restricted to `h1` and explicit `.heading` only.
- frontend(landing): enforce Bento card headings to body font for consistency.
- frontend(landing): globe section titles updated to "随时 随地" and subtitle to "全平台工具链解决方案".

### Removed
- frontend(landing): remove badges strip (Next.js/React/Tailwind/AOS/TypeScript/Vercel) section.

### Added
- docs: `docs/typography-and-landing-updates.md` with usage, fallback, and rollback guidance.

### Chore
- gitignore: ignore `assetsReal/` to prevent large artifacts being tracked.
- repo: cleaned repository history to remove oversized files under `assetsReal/`; force-pushed `main`.

### Notes
- After history rewrite, collaborators must resync: `git fetch --all --tags --prune` then `git reset --hard origin/main` (if no local work) or rebase accordingly.

## Unreleased - 2025-09-25

### Changed
- refactor(auth,user): Establish clear SoR boundaries. Auth owns credentials/role; User owns profile and quotas. Remove duplicate user fields to prevent drift.
- chore(prisma): Standardize per-service local Prisma Client output and local imports (Auth/User/Sharing) to avoid cross-service schema overwrites and align with NodeNext resolution.
- fix(storage): Remove duplicate Transform import; drop invalid Worker option `type: 'module'`. Build now passes.
- docs(readme): Reference new docs/env.example; clarify OpenAPI rewrite status.
- chore(gitignore): Replace with standard monorepo ignores (dist, prisma client, dev .db, logs, .tsbuildinfo).
- chore(git): Untrack generated artifacts now covered by .gitignore.

### Added
- chore(auth,sharing): Minimal `bcryptjs` module declaration to satisfy TS without extra deps.
- docs: Minimal OpenAPI (SoR-aligned) at `docs/openapi.yaml`.
- docs: Add `docs/env.example` with per-service `DATABASE_URL` guidance.
- feat(metadata): Catalog API endpoints `/api/v1/catalog` and `/api/v1/catalog/:slug` (Plan A) aggregating `catalog:*` tags with grayscale `catalog:public=true`.
- feat(gateway): Dev static mapping `/assets` -> repo `assetsReal`; proxy `/api/v1/catalog` -> metadata.
- feat(metadata): Import script `src/scripts/catalog-import.ts` and auto-scan script `src/scripts/catalog-scan.ts` for assetsReal → DB tags.
- feat(frontend): Download page fetches backend catalog with fallback to sample data.

### Fixed
- fix(frontend): Restore valid Vite React `package.json` (was accidentally overwritten).

### Notes
- Initialized fresh SQLite DBs for each service with `prisma db push` (no data migration needed).
- All services build successfully after the changes.


## v0.1.0 - 2025-09-08

### Added
- docs: Add docs/manage-services.md with quick start, commands, and env variables guidance.
- deps(storage): Add ioredis to support Redis-based download concurrency gating (storage service).

### Changed
- chore(ops): Enhance manage-services.sh
  - Corepack-pnpm setup helper (pnpm@9.7.0) and new commands: `setup`, `install`, `build`.
  - Environment helpers: `env:print` and `env:write` to print/write recommended env templates.
  - Start frontend dev with `pnpm dev` instead of `npm run dev` for consistency with workspace.
  - Pass through key env vars to storage service: `REDIS_URL`, `DOWNLOAD_CONCURRENCY_LIMIT`, `DOWNLOAD_Mbps`, `OWNER_COOKIE_SECRET`, `OWNER_COOKIE_TTL_SEC`.

### Notes
- Upcoming work (not part of this tag):
  - Implement Aliyun OSS STS issuance endpoint and frontend ali-oss multipart upload (keep TUS as fallback).
  - Refactor storage service into smaller modules to meet ≤200 lines/file guideline.
  - Fix/standardize .gitignore to avoid tracking build artifacts and IDE files.
