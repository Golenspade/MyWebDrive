# MyWebDrive - 云存储服务

基于微服务架构的云存储（网盘）服务。后端已全面迁移到 Node.js（Monorepo + pnpm），前端使用 Next.js（`frontend/cruip-landing`）。

## 🚀 特性

- **微服务架构**: 模块化设计，易于扩展和维护
- **现代化技术栈**: Node.js + React + TypeScript + Next.js
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
- **Next.js 15** - 前端应用框架
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
   # 方式A：使用提供的环境示例（最新）
   cp docs/env.example .env
   # 方式B：用脚本生成模板（可自定义输出文件名）
   ./manage-services.sh env:write .env.example

   pnpm -w install
   pnpm -w build
   ```

3. **启动 Node 服务（开发）**
   ```bash
# 一键启动后端（gateway + auth + user + metadata + storage + sharing）
./manage-services.sh start-backend
# 或前后端一起启动（后端 + frontend/cruip-landing）
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

> 需要在生产环境强制邀请码注册时，将 `REGISTRATION_REQUIRE_INVITE=true` 写入运行时环境变量，并用管理员账号调用 `/api/v1/auth/invitations` 创建首批邀请码。可运行 `pnpm --filter services/auth prisma:seed` 快速生成默认管理员和初始邀请码。

> 生产预览：`./manage-services.sh start-frontend-prod` 会先构建 `frontend/cruip-landing` 再以 `next start` 启动，默认监听 `FRONTEND_PORT`。

## 下载目录（方案 A）开发期用法

- 把文件放到仓库根目录 `assetsReal/`（可带子目录）
- 导入方式（二选一）
  - 映射清单导入：`pnpm -C services/metadata catalog:import`（清单：`assetsReal/catalog-import.json`）
  - 自动扫描导入：`pnpm -C services/metadata catalog:scan`（从文件名/目录推断 slug/version/os/arch/channel/category）
- 目录 API：`GET http://localhost:9080/api/v1/catalog`
- 灰度开关：仅返回打了 `catalog:public=true` 的条目
- 下载直链：开发期由网关将 `assetsReal/` 映射为 `/assets`，前端可直接下载；上线时将 `catalog:url` 换为 OSS/CDN 直链即可

更多细节见 `docs/catalog-plan-A.md`。

## CORS/跨域

- 默认（开发态）: Node 网关开启宽松 CORS（`*`），前端（`frontend/cruip-landing`，端口 3100）直连 `/api/v1`，无需额外代理配置。
- 指定来源: 使用环境变量 `CORS_ALLOWED_ORIGINS` 以逗号分隔（示例：`http://127.0.0.1:3100`）。
- 前端在 `frontend/cruip-landing/next.config.js` 中读取 `API_BASE_URL`，可在 `.env.local` 或启动脚本中覆盖。
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

**方式一：一键部署（推荐）**

从本地直接部署到阿里云服务器：

```bash
# 1. 配置SSH免密登录
chmod +x scripts/ssh-setup.sh
./scripts/ssh-setup.sh

# 2. 一键部署到服务器
chmod +x scripts/quick-deploy.sh
./scripts/quick-deploy.sh <你的服务器IP>
```

详细说明请查看 [一键部署指南](DEPLOY_GUIDE.md)

**方式二：完整部署脚本**

```bash
# 交互式配置和部署
chmod +x scripts/deploy-to-server.sh
./scripts/deploy-to-server.sh setup
./scripts/deploy-to-server.sh
```

**方式三：手动部署**

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
├── frontend/                # 前端应用（cruip-landing / Next.js）
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
