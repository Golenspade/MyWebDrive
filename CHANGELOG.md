# Changelog

All notable changes to this repository will be documented in this file.

## admin-users-frontend - 2025-10-14

### Added
- feat(frontend): Admin 用户管理页 `/admin/users`（采用 shadcn/ui 组件，直连后端）
  - 列表/搜索/分页：GET `/api/v1/auth/admin/users?query=&page=&pageSize=`
  - 角色变更：PATCH `/api/v1/auth/admin/users/:id/role`
  - 查看/设置配额：GET `/api/v1/users/:id/storage`、PATCH `/api/v1/users/:id/quota`
  - Token 对话框：页面内置“设置令牌”，从 localStorage 读取/存储 Bearer Token 用于带鉴权请求

### Changed
- frontend(admin): 主导航新增 Users 入口；修复 usePathname 可能为 null 的类型问题
- frontend(admin): `/admin` 默认重定向到 `/admin/users`
- gateway: 对齐与确认转发 `/api/v1/auth/*`、`/api/v1/users/*` 到对应服务（保持直连后端，无占位符）

### Docs
- docs(env.example): 增加 `STORAGE_SKIP_METADATA=false`（生产闭环；本地演示可临时设为 true）

### Verify
- 后端已启动（gateway 9080）且管理员 Token 可用时：
  1. 前端 dev：`pnpm -C frontend/cruip-landing dev -p 4323`（或 `./manage-services.sh start-frontend` 使用 3100）
  2. 访问 `/admin/users`，通过“设置令牌”粘贴 Bearer Token
  3. 执行搜索/分页/改角色/查看与设置配额，接口均返回 200


## admin-apis-stage1-backend - 2025-10-14

### Added
- feat(auth): Admin users management endpoints
  - GET /api/v1/auth/admin/users — 分页/搜索用户列表（query/page/pageSize）
  - GET /api/v1/auth/admin/users/:id — 用户详情（id/name/email/role/createdAt）
  - PATCH /api/v1/auth/admin/users/:id/role — 角色调整（user/admin）
  - GET /api/v1/auth/admin/users/statistics?range=7d|30d — 用户统计（totalUsers/newUsers）
- feat(user): Admin 配额与用量
  - PATCH /api/v1/users/:id/quota — 设置存储配额（管理员权限）
  - GET /api/v1/users/:id/storage — 查询指定用户配额与用量
- feat(storage): 存储统计与下载活跃
  - GET /api/v1/storage/statistics — 总上传量（bytes/count）
  - GET /api/v1/storage/statistics/daily?days=30 — 日维度上传（completed 按 updatedAt 聚合）
  - GET /api/v1/storage/downloads/active — 当前下载并发与 IP 列表（基于 Redis 键 dl:*）
- feat(metadata): 文件统计（供聚合使用）
  - GET /api/v1/files/statistics — 文件总数与总大小（latest File.size 聚合）
- feat(gateway): /api/v1/admin/overview 聚合
  - totals: total_users、total_files、total_storage_bytes
  - today: uploads_count（其余占位为 0，可后续补充）
  - last7d: uploads_bytes（来自 storage/statistics/daily）

### Changed
- gateway: 使用下游服务新接口进行聚合，转发 Authorization 头部，失败时容错为 0。

### Verify
- 构建: make build / make quality-check 通过
- 路由:
  - GET http://localhost:9080/api/v1/admin/overview — 200，返回 non-zero（若已有数据）
  - GET http://localhost:9080/api/v1/auth/admin/users?page=1&pageSize=10 — 200
  - PATCH http://localhost:9080/api/v1/auth/admin/users/<id>/role — 200
  - PATCH http://localhost:9080/api/v1/users/<id>/quota — 200
  - GET http://localhost:9080/api/v1/storage/statistics — 200
  - GET http://localhost:9080/api/v1/storage/statistics/daily?days=7 — 200
  - GET http://localhost:9080/api/v1/files/statistics — 200

### Notes
- storage(dev): 新增 STORAGE_SKIP_METADATA 标志（默认 false；本地演示可设为 true）
  - finalize 将跳过元数据回调；并提供快速完成路径，便于生成非零上传统计
  - 配置：在 .env 增加 `STORAGE_SKIP_METADATA=true`，重启后端生效

- 所有新路由均 requireAuth + requireAdmin
- SoR 边界遵守：Auth 仅统计自身用户；文件与大小统计来自 Metadata；上传统计来自 Storage；聚合在网关完成。

### Issues Encountered & Solutions
1) user 服务插入位置错误导致路由嵌入到 `me/storage` 处理器内部
- 症状：插入的 Admin 路由出现在 `app.get('/api/v1/users/me/storage'...)` try 块中
- 解决：删除错误块（行 116–144），改为在错误处理中间件之前插入 Admin 路由
- 文件：services/user/src/index.ts

2) storage 服务统计路由一度插入到文件下载路由/`app.listen` 回调内部
- 症状：`/api/v1/storage/statistics*` 被插在 `files/:fileId` 路由的 try 内，之后又被插入到 `app.listen` 回调中
- 解决：两次修正，最终将统计与活跃下载路由移动到错误处理器之前，确保在顶层注册
- 文件：services/storage/src/index.ts



## notifications-mvp-and-hydration-fix - 2025-10-14

### Added
- feat(frontend): Notifications MVP 页面 `/admin/notifications`
  - 列表筛选/搜索/高级筛选（服务来源、未读）、分页、行级操作、导出 JSON、详情右侧抽屉（Sheet）、原始 JSON 折叠与复制
  - 顶部工具栏支持“模拟告警”“刷新”与“返回管理面板”按钮
- feat(frontend): 新增通用 `Sheet` 组件 `components/ui/sheet.tsx`
- feat(admin): 更新主导航 `MainNav`（高亮当前路由，提供 Overview 与 Notifications 快捷入口）
- feat(admin): 新增 `/admin` 路由重定向到 `/admin/invitations`

### Fixed
- fix(frontend): 修复 Notifications 页 SSR 水合不匹配（Hydration failed）
  - 根因：服务器端渲染阶段使用 `Math.random()/Date.now()` 生成 mock 数据，导致服务端与客户端初始渲染不一致（未读计数/时间字符串变化）
  - 方案：初始 state 设为空数组，使用 `useEffect` 在客户端挂载后生成模拟数据，确保 SSR 与客户端首次渲染一致
  - 位置：`frontend/cruip-landing/app/admin/notifications/page.tsx`

### Docs
- docs: 添加 `AGENTS.md`（仓库贡献与约定指南）

### Verify
- 前端：`./manage-services.sh start-frontend` 后访问 `http://127.0.0.1:3100/admin/notifications`
- 后端：`./manage-services.sh start-backend`，`http://127.0.0.1:9080/health` 返回 200

### Maintenance
- 清理前端缓存以排查 SSR 水合问题：
  - 删除缓存：`rm -rf frontend/cruip-landing/.next frontend/cruip-landing/out frontend/cruip-landing/tsconfig.tsbuildinfo`
  - 然后重启前端：`./manage-services.sh stop-frontend && ./manage-services.sh start-frontend`
- 新增辅助脚本：`scripts/start-frontend-dev.sh`
  - 自动设置 `API_BASE_URL` 指向网关端口
  - 尝试提升 `ulimit -n`，并默认启用 `WATCHPACK_POLLING` 以缓解 EMFILE
  - 用法：`bash scripts/start-frontend-dev.sh` 或 `PORT=3200 bash scripts/start-frontend-dev.sh`
- 新增辅助脚本：`scripts/start-backend-dev.sh`
  - 通过 `manage-services.sh start-backend` 启动所有 Node 服务
  - 启动前检测 Redis 可达性（若不可达，提示启动方式）
  - 等待网关 `/health` 就绪并打印当前状态与日志路径
  - 用法：`bash scripts/start-backend-dev.sh`（可设置 `GATEWAY_PORT`）

### Troubleshooting
- 开发环境频繁出现 `Watchpack Error (watcher): Error: EMFILE: too many open files, watch`
  - 原因：系统文件描述符上限过低，Next/webpack 监听文件数超限
  - 立即缓解（当前终端生效）：
    - `ulimit -n 10000` 后再启动前端
    - 或使用轮询模式减少原生 watcher：`WATCHPACK_POLLING=true WATCHPACK_POLL_INTERVAL=1000 pnpm exec next dev -H 127.0.0.1 -p 3100`
  - macOS 持久化方案（建议）：
    - `sudo launchctl limit maxfiles 65536 200000`，重启终端
    - 确认：`ulimit -n` 输出应 ≥ 10000

## frontend-admin-dashboard-setup - 2025-10-14

### Added
- frontend: 添加完整的 shadcn/ui dashboard-01 示例到 `/admin/invitations`
  - 创建 `app/admin/invitations/page.tsx`（基于官方 shadcn dashboard 示例）
  - 下载并适配所有必需的 dashboard 组件到 `app/admin/components/`：
    - `main-nav.tsx` - 主导航组件
    - `user-nav.tsx` - 用户下拉菜单
    - `team-switcher.tsx` - 团队切换器
    - `search.tsx` - 搜索组件
    - `date-range-picker.tsx` - 日期范围选择器
    - `overview.tsx` - 图表概览（使用 recharts）
    - `recent-sales.tsx` - 最近销售列表
- frontend: 添加缺失的 shadcn/ui 组件：
  - `command.tsx` - 命令面板组件（用于 team-switcher）
  - `popover.tsx` - 弹出层组件
  - 更新 `dropdown-menu.tsx` - 添加所有必需的导出（Label, Separator, Group, Shortcut）
  - 更新 `card.tsx` - 添加 CardDescription 导出

### Changed
- frontend: 注释掉 `next.config.js` 中的 `output: 'export'` 配置
  - **原因**: `output: 'export'` (静态导出模式) 与 `rewrites` 和 `middleware` 冲突
  - **影响**: 开发环境无法使用 API 代理（`/api/v1/*` → `http://localhost:9080`）和路由中间件
  - **解决方案**: 开发环境注释掉此配置，启用 rewrites 和 middleware；生产环境根据部署方式决定
  - **位置**: frontend/cruip-landing/next.config.js:14
- frontend: 批量修正所有 dashboard 组件的 import 路径
  - 从 `@/registry/new-york/ui/*` 改为 `@/components/ui/*`
  - 从 `@/app/(app)/examples/dashboard/components/*` 改为 `@/app/admin/components/*`

### Fixed
- frontend: 修复 shadcn UI 组件导出不完整问题
  - **问题1**: `dropdown-menu.tsx` 缺少 `DropdownMenuLabel`、`DropdownMenuSeparator`、`DropdownMenuGroup`、`DropdownMenuShortcut` 导出
  - **解决**: 使用 `npx shadcn@latest add dropdown-menu --overwrite -y` 重新安装完整版本
  - **问题2**: `card.tsx` 缺少 `CardDescription` 导出
  - **解决**: 使用 `npx shadcn@latest add card --overwrite -y` 重新安装
  - **问题3**: `command.tsx` 组件缺失
  - **解决**: 使用 `npx shadcn@latest add command -y --overwrite` 安装
- frontend: 清除 Next.js 构建缓存以解决模块解析错误
  - **问题**: 添加组件后仍然报 "Module not found: Can't resolve '@/components/ui/command'"
  - **症状**: fallback-build-manifest.json 文件不存在错误
  - **解决**: 删除 `.next` 目录并重新启动开发服务器
  - **命令**: `rm -rf .next && pnpm dev`

### Dependencies
- frontend: 新增依赖（通过 shadcn CLI 自动安装）：
  - `cmdk@^1.1.1` - Command 组件依赖
  - `@radix-ui/react-popover@^1.1.15` - Popover 组件
  - `date-fns@^4.1.0` - 日期处理（date-range-picker 使用）
  - `recharts@2.15.4` - 图表库（overview 组件使用）

### Issues Encountered & Solutions

#### Issue 1: 静态导出与 API 代理冲突
- **错误信息**:
  ```
  ⚠ Specified "rewrites" will not automatically work with "output: export"
  ⨯ Middleware cannot be used with "output: export"
  ```
- **根本原因**: Next.js 的静态导出模式（`output: 'export'`）不支持服务器端功能（rewrites, middleware, API routes）
- **影响范围**: 无法在开发环境使用 `/api/v1/*` 代理到后端 9080 端口
- **解决方案**:
  1. 开发环境：注释掉 `output: 'export'`（启用 rewrites）
  2. 生产环境：根据部署方式（SSR vs 静态）决定是否启用
- **文件**: `frontend/cruip-landing/next.config.js:11-14`
- **备注**: 添加了详细的 FIXME 注释说明问题和解决方案

#### Issue 2: shadcn 组件版本不一致
- **问题**: 项目中已有的 `dropdown-menu.tsx` 和 `card.tsx` 是旧版本或简化版，缺少必需的导出
- **错误示例**:
  ```
  Attempted import error: 'DropdownMenuLabel' is not exported from '@/components/ui/dropdown-menu'
  ```
- **解决步骤**:
  1. 使用 `--overwrite -y` 标志强制覆盖现有文件
  2. 重新安装完整版本的组件
  3. 验证所有必需的导出存在
- **受影响组件**: dropdown-menu, card, command

#### Issue 3: Next.js 模块缓存问题
- **症状**:
  - 新添加的组件文件存在，但编译时仍然报 "Module not found"
  - 大量 `fallback-build-manifest.json` 文件不存在错误
- **根本原因**: Next.js 构建缓存未及时更新，仍然使用旧的模块映射
- **解决方案**: 完全清除 `.next` 目录并重启开发服务器
- **验证**: 重启后页面返回 HTTP 200，所有组件正常加载

### Verify
- ✅ 前端服务器启动: `http://localhost:4323`
- ✅ 管理员面板访问: `http://localhost:4323/admin/invitations` 返回 200
- ✅ 后端服务正常: `http://localhost:9080/health` 返回 healthy
- ✅ 所有 shadcn UI 组件导入无错误
- ✅ Dashboard 示例页面完整渲染（包含导航、卡片、图表、表格）

### Notes
- Dashboard页面当前使用 shadcn 官方示例的模拟数据，尚未连接后端API
- 页面布局和所有UI组件已按官方示例完整实现，可直接在此基础上进行定制
- 后续工作：
  1. 将 dashboard 数据替换为邀请码管理的实际数据
  2. 实现前后端API连接（参考 `docs/FRONTEND_BACKEND_CONNECTION_DESIGN.md`）
  3. 添加邀请码的创建、撤销等操作功能

## deploy-un-2025-10-13-1022 - 2025-10-13

Snapshot for post-deploy (not published to server). Tagged as `deploy-un-2025-10-13-1022`.

### Added
- docs: Add `AGENTS.md` contributor guide (repository guidelines, structure, commands, style, PR rules).

### Changed
- docs: Update references to archived migration doc in `CLAUDE.md` and `docs/OPS_FAQ.md`.
- gitignore: Ignore `.ops/` (local ops keys/scripts) and internal augment artifacts (`.augment_*.txt`, `*.augment.log`).

### Archived/Move
- MIGRATION_TO_NODE.md → `docs/_archive/MIGRATION_TO_NODE_root.md` (history only)
- README_FRONTEND_BEFORE.md → `docs/_archive/README_FRONTEND_BEFORE.md`
- frontend/FRONTEND_COMPLETED.md → `docs/_archive/FRONTEND_COMPLETED_VITE.md`
- furtherPlan.md → `docs/_archive/furtherPlan.md`
- Template docs (`frontend/_templates/tailwind-landing-page-template/*`) → `docs/_archive/templates/`
- Fonts README (apps/web, landing) → `docs/_archive/fonts/`
- Internal augment artifacts → `docs/_archive/internal/`

## 2025-10-12

### Fixed
- ops: quick-deploy.sh 保护服务器 `.env`（避免 rsync `--delete` 覆盖），并在部署前执行 `scripts/build-all-node.sh` 以确保 `services/*/dist` 存在。

### Changed
- infra(alicloud): 为 `storage` 服务注入 `REDIS_URL=redis://redis:6379/0`，避免容器内默认连 `localhost:6379` 导致下载限流失败时被拒绝。

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
 - fix(frontend): 访问 /admin/* 返回 404（Nextra 默认 pageExtensions 未包含 TS/TSX）
   - 根因：`withNextra` 默认优先 MD/MDX 扩展，未识别 `app/` 下的 `*.tsx` 路由文件
 - 方案：在 `next.config.js` 中显式设置 `pageExtensions: ["md","mdx","tsx","ts","jsx","js"]`
  - 位置：`frontend/cruip-landing/next.config.js`
 - fix(frontend): 明确启用 App Router（Nextra 包装下未生效导致 app/ 下路由 404）
 - 方案：`experimental: { appDir: true }`
  - 位置：`frontend/cruip-landing/next.config.js`
 - fix(frontend): 根路径 `/` 返回 404
 - 方案：新增 `app/page.tsx` 将根路径重定向到 `/admin/notifications`
  - 位置：`frontend/cruip-landing/app/page.tsx`
- fix(frontend): Nextra 包装下 /admin/* 仍 404（临时桥接 Pages Router）
  - 方案：新增 Pages 路由桥接到 App 页面：
    - 已回滚此临时桥接方案以解决 Next 15 路由冲突
    - 保留 App Router 路由：`app/page.tsx`、`app/admin/*`
    - 移除冲突文件：`pages/index.tsx`、`pages/admin/*`
  - 备注：当前以 App Router 为主，Docs 仍走 Pages（/docs/**），两者路由不重叠即可
