# Node.js/Next.js 迁移与实施计划（执行版）

> 进展快照（当前）
>
> - Monorepo: pnpm workspace 已就绪，`packages/common` 可被服务引用。
> - Node 服务（已实现：5/6；已运行验证：3/6）：
>   - Auth Service `services/auth` → 7081（运行中）
>   - User Service `services/user` → 7082（运行中）
>   - API Gateway Node `services/api-gateway-node` → 9080（可运行；如端口占用，临时使用 9090）
>   - Metadata Service `services/metadata` → 7083（Node 版本已实现并对齐接口，进入联调）
>   - Storage Service `services/storage` → 7084（Node 版本已实现：分片上传/合并/MD5/MinIO，进入联调）
>   - Sharing Service `services/sharing` → 7085（Node 版本已实现：公开/认证/下载代理，进入联调）
> - Next.js Dev（apps/web）→ 4000（运行中），已通过 rewrites 将 `/api/v1/*` 代理至 9080。
> - Go 版服务作为回滚与对照：Metadata 8083、Storage 8084、Sharing 8085（可按需切换）
>
> 本次更新要点：
> - 修复 Gateway 缺少类型问题并完成编译：新增 `@types/jsonwebtoken`、`@types/express`、`@types/node`、`@types/morgan`；
>   调整 `http-proxy-middleware@3` 配置为受支持形式并补充类型垫片（morgan）。
> - Next.js `.env.local` 指向 Node 网关：`API_BASE_URL=http://localhost:9080`；验证健康检查与鉴权链路通过。
> - 完成 Auth/User 的类型依赖与 Prisma 生成，类型检查通过。
> - 新增/完善 Metadata/Storage/Sharing 的 Node 实现（接口与 Go 契约对齐），进入联调阶段。
> - 网关已映射至 Node 端口；管理员聚合健康 `/api/v1/admin/health` 返回 200。

本文件用于指导将当前 Go 微服务后端迁移到 Node.js，并在前端开发阶段使用 Next.js 作为开发服务器。项目尚未部署，因此计划优先保证本地开发与端到端验证，部署在后续阶段统一处理。

---

## 目标与范围

- 后端从 Go 迁移到 Node.js（保留微服务架构与 API 契约）。
- 前端开发服务器选用 Next.js（可先作为 BFF 代理和页面渲染，渐进迁移现有 Vite 前端）。
- 保持现有接口路径与鉴权规则，确保前端与测试脚本可用。

---

## 基线现状

- 前端：`frontend/`（Vite + React）
- 后端：Go 微服务与 API 网关（Echo），SQLite 存储与可选 MinIO。
- OpenAPI 契约：`docs/openapi.yaml`
- 端到端脚本：`test_complete_flow.sh`、`test_guest_download.sh`、`test_invitation_flow.sh`、`test_invitation_system.sh`

### 当前运行端口（开发态）

- Next.js：4000（apps/web）
- Node API Gateway：9080（services/api-gateway-node）
- Node Auth：7081（services/auth）
- Node User：7082（services/user）
- Node Metadata：7083（已实现；Go 8083 可回滚）
- Node Storage：7084（已实现；Go 8084 可回滚）
- Node Sharing：7085（已实现；Go 8085 可回滚）

---

## 执行步骤（分阶段，可独立推进）

下面每个步骤都包含“任务清单”、“完成标准”、“建议命令/改动”。建议使用分支逐步合并，形成可回滚的里程碑。

### 1) 对齐 API 契约与环境变量

- 任务清单
  - 读取并确认 `docs/openapi.yaml` 与前端调用一致。
  - 盘点所有环境变量并建立对照表（用于 Node 与 Next）。
    - 服务 URL：`AUTH_SERVICE_URL`、`USER_SERVICE_URL`、`METADATA_SERVICE_URL`、`STORAGE_SERVICE_URL`、`SHARING_SERVICE_URL`
    - 鉴权：`JWT_SECRET`
    - 存储：`STORAGE_PATH`、`USE_MINIO`、`MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_USE_SSL`、`MINIO_BUCKET`
  - 确认健康检查与管理接口：`/health`、`/api/v1/admin/*`（若保留）。
- 完成标准
  - 输出 `docs/env.sample`（或 `.env.example`）示例文件，前后端共用键名清晰。

### 2) 初始化 Node Monorepo（可选但推荐）

- 任务清单
  - 在仓库根目录建立基于 pnpm/npm/yarn workspaces 的 monorepo：
    - `packages/common`：错误模型、响应封装、JWT 工具、类型定义。
    - `services/api-gateway-node`：Node 版网关。
    - 后续服务：`services/auth`、`services/user`、`services/metadata`、`services/sharing`、`services/storage`。
  - 统一 `tsconfig.base.json`、ESLint、Prettier、Jest/Vitest。
- 完成标准
  - `pnpm -w install && pnpm -w build` 或等价命令成功；`packages/common` 被 `services/*` 正常引用。
- 建议命令
  - 初始化：`npm init -y` 或 `pnpm init -y`；配置 workspaces；按需添加 TypeScript、构建与测试脚本。

### 3) 建立 Next.js 开发服务器（BFF/SSR）并统一开发端口

- 模式选择
  - A. 渐进式：保留 `frontend/` 作为 UI 源，新增 `apps/web`（Next.js）作为开发服务器与 BFF 代理；先用 Next 代理到 Go 网关，后续逐页迁移到 Next。
  - B. 一步到位：直接用 Next.js 重建前端，替代 `frontend/`。
- 任务清单（以 A 为例）
  - 创建 `apps/web`，启用 App Router（Next 14+）。
  - 统一端口：Next 作为单入口，代理 API 与 UI
    - 在 `apps/web/next.config.js` 使用 `beforeFiles + fallback`：
      - `beforeFiles`：`/api/v1/:path* -> ${API_BASE_URL}/api/v1/:path*`
      - `fallback`：`/:path* -> ${VITE_DEV_SERVER}/:path*`（将除 Next 自身路由/资源外的请求转发给 Vite）
    - `.env.local` 示例（当前已使用 Node 网关 9080）：
      ```env
      API_BASE_URL=http://localhost:9080
      VITE_DEV_SERVER=http://localhost:3000
      ```
    - 工作区加入 `frontend/`，在根脚本用 pnpm 并行启动 Next 与 Vite，浏览器仅访问 `http://localhost:4000` 即可。
    - 注意：Vite HMR 的 WebSocket 透传在 Next fallback 下可能存在兼容性边界；若出现 HMR 问题，可临时在调试 UI 时直连 `http://localhost:3000`，或保留两端口并仅将 API 经由 Next 统一。
  - 可选：在 `app/api/*` 下增加轻量 BFF Route Handlers（如刷新 token、统一错误处理）。
- 完成标准
  - `next dev` 可正常渲染页面，前端请求经 Next 代理到现有网关，`test_*` 脚本可针对 Next 开发服务器运行（如需，设置 `BASE_URL`）。
- 建议命令
  - `npx create-next-app@latest apps/web --ts --eslint --app`（或手动建立目录与配置）。

### 4) 脚手架 Node API 网关（保持契约）

- 任务清单（当前实现为 Express，后续可按需替换为 Fastify）
  - 中间件：CORS、请求日志（morgan）、RequestID、Prometheus 指标（`prom-client`）。
  - 鉴权：`jsonwebtoken` 校验 Bearer；payload 至少包含 `user_id`、`role`。
  - 反向代理：`http-proxy-middleware@3` 映射 `/api/v1/*` 至各服务。
  - 环境变量：与 Go 网关一致（服务 URL、`JWT_SECRET`、CORS）。
- 完成标准（已达成）
  - `services/api-gateway-node` 能在 9080 启动，Next 通过其访问 Node/Go 下游；类型检查通过。

### 5) 将 Next 代理切换到 Node 网关

- 任务清单
  - `.env.local` 中 `API_BASE_URL` 指向 `http://localhost:8080`（Node 网关端口视实现）。
  - 回归核心流：注册/登录、上传/下载、分享访问。
- 完成标准
  - 切换透明且可随时回滚到 Go 网关（仅需改 `API_BASE_URL`）。

### 6) 迁移 auth-service（优先）

- 任务清单
  - 接口：注册、登录、刷新、登出、邀请码 CRUD。
  - 安全：`argon2`/`bcrypt` 哈希，`jsonwebtoken` 发放/校验。
  - 数据库：保留 SQLite 起步；使用 Prisma 或 Knex；对照 Go 版迁移脚本 `backend/auth-service/migrations/001_create_users_table.sql`。
- 完成标准
  - 端到端脚本 `test_invitation_flow.sh`、`test_invitation_system.sh` 通过；Next 侧功能无感迁移。

### 7) 迁移 user-service

- 任务清单
  - 接口：`/me` GET/PATCH、`/me/storage`。
  - 依赖：JWT 中的 `user_id`、`role`。
- 完成标准
  - 前端个人中心与配额页面正常；端到端通过。

### 8) 迁移 metadata-service

- 任务清单
  - 接口：文件/文件夹 CRUD、移动、版本列表、版本恢复。
  - 数据：设计 Prisma schema；确保与 storage/sharing 的引用一致。
- 完成标准
  - 文件树/详情/移动/版本恢复在前端全通过。

### 9) 迁移 sharing-service

- 任务清单
  - 接口：创建/列举/撤销分享；公开 token访客访问与下载（免鉴权）。
- 完成标准
  - 公开链接可用，权限隔离正确。

### 10) 迁移 storage-service（最后）

- 任务清单
  - 上传：创建会话、分片上传、查询状态、合并（流式合并与 MD5 计算）。
  - 存储：本地 `STORAGE_PATH` 或 MinIO（`minio` npm SDK）。
  - 下载：按 fileId 读取（本地或 MinIO），校验权限。
  - 性能：处理背压与大文件（避免阻塞事件循环）。
- 完成标准
  - 断点续传、MD5 校验一致、压力下稳定；端到端通过。

### 11) 统一日志与指标

- 任务清单
  - 日志：`zap` → `pino`（结构化 JSON），贯穿 RequestID、user_id。
  - 指标：`prom-client` 导出直方图与计数器；如需管理页概览，提供聚合查询 API 或接 Prometheus + Grafana 面板。
- 完成标准
  - 各服务日志/指标一致，便于排障与观测。

### 12) 文档、清理与发布前准备

- 任务清单
  - 更新 README、运行脚本、`.env.example`、运维 FAQ。
  - 清理 Go 服务 Dockerfile/二进制与 k8s 清单（保留一版回滚说明）。
  - 准备部署说明（容器化、K8s、或简单 PM2/单机部署）。
- 完成标准
  - 仅 Node/Next 服务在线即可跑通端到端；回滚预案明确。

---

## Next.js 集成要点（开发阶段）

- 路由策略
  - 首选通过 `rewrites` 将 `/api/v1/*` 代理到 API 网关；避免在 Next 里重复实现所有后端接口。
  - 可在 `app/api/*` 增设 BFF 路由用于：统一错误、SSR 预取、刷新 token 等。
- 会话与鉴权
  - 浏览器侧维持 `accessToken`/`refreshToken`（与现有前端一致）。
  - SSR 需要访问受保护数据时，可在 BFF 端读取 Cookie 并转发 Bearer Token。
- 本地环境变量
  - `apps/web/.env.local`：
    ```env
    API_BASE_URL=http://localhost:9080
    JWT_SECRET=开发期不在 Next 校验，仅转发
    ```

---

## 快速运行（当前可用）

- 安装依赖（建议使用 pnpm；如无全局 pnpm，可用 npx 方式）：
  - `npx -y pnpm@9.7.0 install`
- 启动服务（分终端）：
  - Auth：`pnpm --filter ./services/auth dev`
  - User：`pnpm --filter ./services/user dev`
  - Gateway：
    - `export GATEWAY_PORT=9080`
    - `export AUTH_SERVICE_URL=http://localhost:7081`
    - `export USER_SERVICE_URL=http://localhost:7082`
    - `export METADATA_SERVICE_URL=http://localhost:7083` # 如使用 Node 版 Metadata
    - `export STORAGE_SERVICE_URL=http://localhost:7084` # 如使用 Node 版 Storage
    - `export SHARING_SERVICE_URL=http://localhost:7085` # 如使用 Node 版 Sharing
    - `export JWT_SECRET=dev_super_secret_change_me`（或使用根 `.env`）
    - `pnpm --filter ./services/api-gateway-node dev`（或 `npx tsx watch src/index.ts`）
  - Next：`pnpm --filter ./apps/web dev`（确保 `apps/web/.env.local` 指向 `http://localhost:9080`）

### Metadata Service（Node）本地启动

- 目录：`services/metadata`
- 环境：
  - `export JWT_SECRET=dev_super_secret_change_me`
  - `export METADATA_PORT=7083`
  - `export METADATA_DATABASE_URL=file:./metadata.db`
- 启动：
  - `pnpm --filter ./services/metadata dev`
- 网关指向：
  - `export METADATA_SERVICE_URL=http://localhost:7083`
- 已对齐的路由（与 Go 版一致）：
  - `POST   /api/v1/folders`（创建文件夹）
  - `GET    /api/v1/folders/:folderId/children`（列目录；`root` 表示根目录）
  - `PATCH  /api/v1/folders/:folderId`（重命名）
  - `DELETE /api/v1/folders/:folderId`（软删，递归）
  - `POST   /api/v1/folders/:folderId/move`（移动）
  - `GET    /api/v1/files/:fileId`（获取）
  - `PATCH  /api/v1/files/:fileId`（重命名）
  - `DELETE /api/v1/files/:fileId`（软删）
  - `POST   /api/v1/files/:fileId/move`（移动）
  - `GET    /api/v1/files/:fileId/versions`（版本列表）
  - `POST   /api/v1/files/:fileId/versions/:versionId/restore`（版本恢复，最小实现）

## 验证清单（在浏览器中）

- 健康检查：
  - `http://localhost:4000/api/v1/auth/health` → `auth-service-node`
  - `http://localhost:4000/api/v1/users/health` → `user-service-node`
- 登录获取 token（浏览器控制台）：
  ```js
  const login = await fetch('/api/v1/auth/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email:'admin@local', password:'admin123456' })
  }).then(r=>r.json())
  ```
- 受保护接口：
  ```js
  await fetch('/api/v1/users/me', { headers:{ Authorization:'Bearer '+login.accessToken } }).then(r=>r.json())
  await fetch('/api/v1/admin/health', { headers:{ Authorization:'Bearer '+login.accessToken } }).then(r=>r.json())
  ```

---

## 迁移进度评估（当前）

- 架构层：100%（Monorepo、工具链、`packages/common`）
- 基础服务：75%（Auth/User 完成；Metadata/Storage/Sharing 已有 Node 实现并进入联调）
- 网关层：90%（Node Gateway 可用，已映射至各 Node 服务）
- 前端集成：80%（Next.js 就绪并可代理 API）

### 待办与里程碑

- 近期修复（已完成）
  - Gateway 依赖与类型缺失（`jsonwebtoken`/types、`http-proxy-middleware` 配置、morgan 类型）。
  - Auth/User：补齐类型依赖并执行 Prisma 生成，类型检查通过。
  - 新增 Metadata/Storage/Sharing 的 Node 版本（主要路由与契约对齐），进入联调。
  - 注意：Metadata/Storage 需补 `@types/morgan`；Storage 需确保执行过 `prisma generate`。
- 下一阶段（2–3 周）
  - 联调与端到端验证：优先打通“上传 → 版本写入 → 分享下载”闭环（Metadata/Storage/Sharing）。
  - Storage 性能与稳定性：分片/背压/MD5 计算的 worker_threads/子进程优化。
  - 文档完善与回归脚本覆盖。
- 验证与回归
  - 使用现有 `test_*.sh` 端到端脚本针对 Next(4000)+Gateway(9080) 执行。
  - 确认与 `docs/openapi.yaml` 契约一致。

---

## 风险与回滚

- 按服务逐步迁移，并保持代理可回滚（Next 改 `API_BASE_URL` 即可切换网关）。
- Storage 合并与 MD5 计算是 CPU 密集点；必要时使用 worker_threads 或分离为子进程。
- 确保端到端脚本在每个里程碑都能跑通。

---

## 验收清单（每阶段通用）

- 功能：关键路径（注册/登录、上传/下载、分享）可用。
- 接口：状态码与错误格式与 OpenAPI 一致。
- 安全：JWT 校验、角色判定与权限隔离正确。
- 观测：日志完整、基础指标可查询。
- 回滚：一键切回上一阶段（环境变量或服务路由）。

---

## 后续部署（项目尚未部署，可择机执行）

- 容器化：各服务使用 `node:20-alpine` 多阶段 Dockerfile；`NODE_ENV=production`；`npm ci --omit=dev`。
- 进程管理：本地/单机可用 `pm2`；K8s 见现有清单的等价 Node 版本（镜像、端口、探针）。
- 监控：Prometheus 抓取 `/metrics`，Grafana 面板。

---

## 附：快速开始建议顺序

1. 建立 Next 开发服务器（apps/web）并代理到现有 Go 网关；前端继续可用。
2. 脚手架 Node 网关并在 Next 切换代理到 Node 网关；通过端到端测试。
3. 迁移 auth → user → metadata → sharing → storage，每步都回归测试。
4. 统一日志/指标，清理 Go 资产，准备部署脚本与文档。

---

如需，我可以在 `services/api-gateway-node` 与 `apps/web` 目录下先行提交骨架代码与脚本（Next + Fastify），并附 `.env.example` 与本地启动指南。
- ### Storage Service（Node）本地启动

- 目录：`services/storage`
- 环境：
  - `export JWT_SECRET=dev_super_secret_change_me`
  - `export STORAGE_PORT=7084`
  - `export STORAGE_PATH=./storage`
  - 可选对象存储（MinIO）：
    - `export USE_MINIO=true`
    - `export MINIO_ENDPOINT=localhost:9000`
    - `export MINIO_ACCESS_KEY=...`
    - `export MINIO_SECRET_KEY=...`
    - `export MINIO_USE_SSL=false`
    - `export MINIO_BUCKET=mywebdrive`
  - 与元数据服务集成：
    - `export METADATA_SERVICE_URL=http://localhost:7083`
- 启动：
  - `pnpm --filter ./services/storage dev`
- 网关指向：
  - `export STORAGE_SERVICE_URL=http://localhost:7084`
- 已对齐的路由（与 Go 版一致）：
  - `POST   /api/v1/storage/uploads`（创建上传会话）
  - `PATCH  /api/v1/storage/uploads/:uploadId`（分片上传，字段：chunkIndex + chunk 文件）
  - `HEAD   /api/v1/storage/uploads/:uploadId`（会话存在检查）
  - `GET    /api/v1/storage/uploads/:uploadId`（获取会话状态）
  - `POST   /api/v1/storage/uploads/:uploadId/finalize`（合并分片+MD5）
    - 支持请求体 `expectedMd5` 用于一致性校验；若与服务端计算值不一致，返回 422 且不提交至持久存储（本地/MinIO）。
    - 完成后：存储服务会调用 `POST /api/v1/files/:fileId/versions`（Metadata）记录版本与存储路径
  - `DELETE /api/v1/storage/uploads/:uploadId`（取消会话）
  - `GET    /api/v1/storage/files/:fileId`（下载，要求服务间 JWT）

### Sharing Service（Node）本地启动

- 目录：`services/sharing`
- 环境：
  - `export JWT_SECRET=dev_super_secret_change_me`
  - `export SHARING_PORT=7085`
  - `export SHARING_DATABASE_URL=file:./sharing.db`
  - `export STORAGE_SERVICE_URL=http://localhost:7084`
- 启动：
  - `pnpm --filter ./services/sharing dev`
- 网关指向：
  - `export SHARING_SERVICE_URL=http://localhost:7085`
- 已对齐的路由（与 Go 版一致）：
  - 公开：
    - `GET    /api/v1/shares/:shareToken`（分享信息）
    - `POST   /api/v1/shares/:shareToken/access`（密码校验，返回短期 accessToken）
    - `GET    /api/v1/shares/:shareToken/download`（访客下载，经存储服务代理；若设置密码，需携带 `x-share-access-token` 或 `?access_token=`）
    - 说明：共享服务使用服务间 JWT 调用存储下载接口。
  - 认证：
    - `POST   /api/v1/files/:fileId/shares`（创建分享）
    - `GET    /api/v1/files/:fileId/shares`（列出文件分享）
    - `PATCH  /api/v1/shares/:shareId`（更新分享）
    - `DELETE /api/v1/shares/:shareId`（撤销分享）
    - `GET    /api/v1/shares`（我的所有分享）
