# MyWebDrive

MyWebDrive 是一个 Node.js、TypeScript 与 Next.js 构建的云存储平台。当前仓库
采用 Core-first 架构：统一控制平面负责身份、用户、元数据、分享、配额与管理
能力，Storage 负责对象传输，私有 Email Provider 负责邮件投递。

## 当前仓库权威（2026-07-13）

- 控制平面：`services/core-api`
- 存储 API/Worker：`services/storage`
- 私有邮件适配器：`services/email-provider`
- 主前端：`frontend/cruip-landing`
- 生产编排：`infrastructure/alicloud/docker-compose.core.yml`
- 部署/回滚：`infrastructure/alicloud/deploy.sh`、`rollback.sh`

旧的拆分式 Auth/User/Metadata/Sharing/Gateway 运行时已经
**SOFT-RETIRED**。这些历史源码不属于默认构建、测试、迁移或部署路径；不要
根据目录仍然存在就启动旧栈。

## 主要能力

- 邮箱验证码登录、session/refresh 轮换与角色管理
- 文件夹、文件版本、配额、分享链接和公开下载
- 分片上传、后台合并、对象存储与下载授权
- 管理员业务/运营指标与 Prometheus 可观测性
- Next.js 同源 Web/API 访问与 Core-first Nginx 路由
- 不可变镜像、迁移先行、健康检查和 manifest 驱动回滚

## 环境要求

- Node.js 20+
- Corepack 与 pnpm 9.7.0
- Docker Engine 与 Docker Compose v2（端到端 smoke 必需）

## 快速验证

严格按 lockfile 安装依赖：

```bash
corepack pnpm install --frozen-lockfile
```

运行默认权威的构建、类型、lint、测试和发布契约：

```bash
./manage-services.sh quality
```

运行隔离式 Core-first 容器 smoke：

```bash
./manage-services.sh smoke
```

Smoke 会构建本地镜像并使用临时 Compose 项目和卷，完成认证、配额、上传、
分享、管理指标、健康检查与路由验证后清理资源。

`manage-services.sh` 目前只是兼容性防护入口。可用命令如下：

```bash
./manage-services.sh help
```

本地多服务启动尚未形成新的 Core-first 合同，因此没有默认启动命令。任何旧
生命周期命令都会输出 `SOFT-RETIRED` 并以退出码 `64` 停止，不会启动旧服务。

## 开发质量门

需要缩小验证范围时可以直接运行：

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
bash scripts/test-repo-authority-contract.sh
bash scripts/test-core-release-contract.sh
bash scripts/test-core-cutover-contract.sh
bash scripts/test-generated-artifacts-contract.sh
```

历史测试只能显式运行 `pnpm run test:legacy`，其结果不代表当前发布权威。

## 项目结构

```text
services/
  core-api/         # 统一控制平面、Core Prisma schema 与 analytics worker
  storage/          # Storage API 与后台 worker
  email-provider/   # Compose 私网内邮件适配器
packages/
  common/           # 共享类型与配置工具
  observability/    # 日志、HTTP 观测与指标
frontend/
  cruip-landing/    # Next.js 主前端
infrastructure/
  alicloud/         # Core-first Compose、Nginx、部署与回滚
scripts/            # fail-closed 合同与隔离 smoke
docs/runbooks/      # 切换与回滚操作手册
```

## 数据与运行边界

- `services/core-api/prisma` 是控制平面唯一权威 schema/migration 历史。
- Production migration 由部署脚本在 Core 启动前执行。
- Storage 通过专用 grant/callback secret 与 Core 协作，不共享数据库所有权。
- Email Provider 不公开主机端口，生产云权限使用批准的 ECS role 与 IMDSv2。
- 浏览器只使用同源 `/api/v1/...`；不得恢复旧 Gateway base URL 或前端 rewrite。
- Prisma client、原生 engine、`dist`、`.next` 与 `.tsbuildinfo` 均为生成物，
  不得提交。

## 生产部署

生产发布使用已经由 CI 推送的不可变镜像，标签格式必须为
`sha-<40 lowercase hex>`。部署前先阅读：

- [阿里云 Core-first 部署指南](infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md)
- [Core 切换与回滚 runbook](docs/runbooks/core-cutover-and-rollback.md)

发布脚本会验证 Compose、执行对象存储初始化和 Core migration、等待依赖健康、
验证版本，并原子记录镜像摘要与历史 manifest。回滚只能选择已有 manifest 的
版本；不要绕过发布锁、健康检查或通过删除持久卷恢复部署。

## 安全与贡献

- 不得提交 `.env`、密钥、token、数据库备份或生成产物。
- 对外日志不得记录 URL/query、Authorization、cookie 或分享 token。
- 保持改动聚焦，遵循 `AGENTS.md` 的 TypeScript、测试和 Git 约定。
- Authority、release、migration 与 lifecycle 行为必须先添加失败合同/测试，再
  修改实现。

本项目采用 MIT License，详见 [LICENSE](LICENSE)。
