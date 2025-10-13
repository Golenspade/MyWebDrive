# [ARCHIVED] MyWebDrive - 云存储服务（根目录版本，已归档）

基于微服务架构的云存储（网盘）服务。后端已全面迁移到 Node.js（Monorepo + pnpm），前端使用 Vite，并提供 Next.js 开发体验。

## 🚀 特性

- **微服务架构**: 模块化设计，易于扩展和维护
- **现代化技术栈**: Node.js + React + TypeScript + Vite
- **安全认证**: JWT令牌认证，支持访问令牌和刷新令牌
- **文件管理**: 完整的文件和文件夹操作功能
- **断点续传**: 基于TUS协议的可续传文件上传
- **响应式UI**: 现代化的用户界面，支持多种视图模式
- **容器化部署**: Docker和Kubernetes支持
- **API优先**: 完整的OpenAPI 3.0规范文档

## 📋 系统架构

### 后端微服务

后端已全面迁移为 Node 微服务：网关 9080、Auth 7081、User 7082、Metadata 7083、Storage 7084、Sharing 7085。

### 前端应用

- **React 18** - 用户界面框架
- **TypeScript** - 类型安全
- **Vite** - 快速开发和构建
- **Zustand** - 轻量级状态管理
- **TailwindCSS** - 现代化样式框架
- **React Query** - 数据获取和缓存

### 基础设施

- **SQLite** - 轻量级关系型数据库
- **MinIO** - S3兼容对象存储
- **Redis** - 缓存和会话存储
- **Docker** - 容器化
- **Kubernetes** - 容器编排

## 🛠️ 快速开始

### 环境要求

- Node.js 18+
- Docker & Docker Compose
- Make (可选)

### 开发环境设置（Node Monorepo）

1. **克隆仓库**
   ```bash
git clone https://github.com/Golenspade/MyWebDrive.git
   cd MyWebDrive
   # 可选：更快的浅克隆
   # git clone --depth=1 https://github.com/Golenspade/MyWebDrive.git
```

2. **安装依赖并设置开发环境**（pnpm workspace）
   ```bash
# 方式A：使用提供的环境示例
   cp docs/env.sample .env
   # 方式B：用脚本生成模板（可自定义输出文件名）
   ./manage-services.sh env:write .env.example

   pnpm -w install
   pnpm -w build
```

3. **启动 Node 服务（开发）**
   ```bash
# 一键启动后端（gateway + auth + user + metadata + storage + sharing）
./manage-services.sh start-backend
# 或前后端一起启动
./manage-services.sh start
```

6. **访问应用**
   - 前端: http://127.0.0.1:3100
   - API 网关 (Node): http://localhost:9080
   - MinIO控制台: http://localhost:9001 (minioadmin/minioadmin)

7. 端到端回归（Gateway 9080）
   ```bash
# 启动后端（包含网关）
   ./manage-services.sh start-backend

   # 运行回归脚本（切到 9080 网关）
   GATEWAY_PORT=9080 bash ./test_guest_download.sh
   GATEWAY_PORT=9080 bash ./test_invitation_flow.sh
   GATEWAY_PORT=9080 bash ./test_invitation_system.sh
```

## CORS/跨域

- 默认（开发态）: Node 网关开启宽松 CORS（`*`），前端（`frontend/cruip-landing`，端口 3100）直接请求 `/api/v1`，无需单独代理。
- 指定来源: 使用环境变量 `CORS_ALLOWED_ORIGINS` 以逗号分隔（示例：`http://127.0.0.1:3100`）。
- 前端网关地址: `frontend/cruip-landing/next.config.js` 中 `API_BASE_URL` 默认指向 `http://localhost:9080`，可通过 `.env.local` 覆盖。
- 生产建议: 显式设置允许来源域名，避免使用 `*`。

详见 `docs/CORS.md`。

### 生产部署

#### Docker Compose部署

```bash
# 构建镜像
make docker-build

# 启动所有服务
make docker-up
```

#### Kubernetes部署

```bash
# 部署到K8s集群
make k8s-deploy

# 检查部署状态
kubectl get pods -n mywebdrive
```

#### 阿里云部署

```bash
# 设置环境变量
export REGISTRY_URL=registry.cn-hangzhou.aliyuncs.com/your-namespace
export VERSION=v1.0.0

# 构建并推送镜像到阿里云
make alicloud-build

# 部署到阿里云
make alicloud-deploy
```

或者使用Docker Compose在阿里云ECS上部署：

```bash
# 复制配置文件
cd infrastructure/alicloud
cp env.example .env

# 编辑.env文件，填入实际配置
vim .env

# 部署
./deploy.sh production
```

## 📖 API文档

OpenAPI 文档正在按最新 SoR 边界与 Node 实现重写。历史版本暂存于 `docs/_archive/openapi.yaml`。如需端点速查，参见下方列表与各服务实现。

### 主要API端点

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/users/me` - 获取用户信息
- `POST /api/v1/folders` - 创建文件夹
- `GET /api/v1/folders/{id}/children` - 获取文件夹内容
- `POST /api/v1/storage/uploads` - 创建上传会话
- `PATCH /api/v1/storage/uploads/{id}` - 上传文件分片（支持 TUS `Upload-Offset`，或自定义 `X-Chunk-Index`）
- `HEAD /api/v1/storage/uploads/{id}` - 查询上传状态（返回 `Upload-Length` 与 `Upload-Offset`）

### 认证

所有受保护的端点都需要在请求头中包含JWT令牌：

```
Authorization: Bearer <access_token>
```

## 🏗️ 项目结构

```
mywebdrive/
├── services/                # Node 微服务（auth/user/metadata/storage/sharing/gateway）
├── packages/                # Node 共享包（common、observability 等）
├── frontend/                # 前端应用（Vite）
├── apps/                    # Next.js（可选，开发态）
├── docs/                    # 文档（OpenAPI、FAQ 等）
└── scripts|infrastructure   # 脚本与部署
```

## 🔭 日志与指标（Node 统一）

- 日志：`pino` 输出结构化 JSON，默认字段包含 `service`、`instance`、`env` 与请求 `req.id`；级别由 `LOG_LEVEL` 控制（默认 `info`）。
- 指标：`prom-client` 暴露 `/metrics`，包含：
  - `http_requests_total{method,route,status,service,instance}`
  - `http_request_duration_ms{method,route,status,service,instance}`（直方图）
  - 每个服务均提供 `/health`、`/metrics`；网关还提供 `/api/v1/admin/health` 汇总健康检查。
- 关联 ID：自动注入/透传 `x-request-id`，用于跨服务排障。
- 快速验证：
  ```bash
curl -s http://localhost:7081/metrics | head
  curl -H 'x-request-id: test-123' -i http://localhost:7083/health
```

## 🧪 测试

```bash
# 回归脚本（指向 Node 网关 9080）
GATEWAY_PORT=9080 bash ./test_guest_download.sh

# 运行前端测试
cd frontend && npm test
```

## 🔧 开发工具

### 有用的Make命令

```bash
make help           # 显示所有可用命令
make build          # pnpm 递归构建 (packages/services/apps)
make test           # pnpm 递归测试 (允许为空)
make docker-build   # 基于 Node 版 compose 构建
make docker-up      # 启动 Node 版 compose
make docker-down    # 停止 Node 版 compose
make format         # 前端/Node 代码格式化
make lint           # 前端/Node 代码检查
make quality-check  # 构建+测试+lint
```


## 🤝 贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

api/v1/folders/:folderId/move`（移动）
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
