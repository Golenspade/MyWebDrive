# MyWebDrive

MyWebDrive 是一个 Node.js、TypeScript 与 Next.js 构建的文件存储和分发平台。当前仓库采用 Core-first 架构：Core 负责身份、文件、上传意图、配额、分享、发布和 Dashboard；Storage 负责对象传输与后台存储工作；Web 通过同源 Nginx 入口访问公开 API。

## 当前权威

- 控制平面：`services/core-api`
- 存储 API 与 Worker：`services/storage`
- 私有邮件投递适配器：`services/email-provider`
- 主前端：`frontend/cruip-landing`
- 控制平面 schema 与 migrations：`services/core-api/prisma`
- 本地编排：`infrastructure/alicloud/docker-compose.core.yml` + `infrastructure/docker-compose.core-dev.yml`
- 生产编排：`infrastructure/alicloud/docker-compose.core.yml`
- 生产部署与回滚：`infrastructure/alicloud/deploy.sh`、`infrastructure/alicloud/rollback.sh`

曾经的拆分式控制平面已 **SOFT-RETIRED**，其归档副本仅用于观察，不属于默认构建、测试、迁移、开发或发布路径。

## 本地开发

要求 Node.js 20+、Corepack、Docker Engine，以及 Docker Compose 2.24.4+。首次准备并启动完整 Core-first 栈：

```bash
./manage-services.sh setup
./manage-services.sh start
```

应用入口为 <http://127.0.0.1:8080>，Compose project 固定为 `mywebdrive-core-dev`。完整命令说明见 [`docs/manage-services.md`](docs/manage-services.md)：

```text
setup
start
stop
status
logs [service]
config
smoke
quality
reset --confirm
legacy:help | legacy:status
```

`reset` 只在显式提供 `--confirm` 时删除本地容器和卷。Legacy 兼容面只允许 `legacy:help` 和不调用归档脚本的 socket-only `legacy:status`；其他 `legacy:*` 命令退出 64。

## 验证矩阵

```bash
pnpm run build:all       # 权威 workspace 构建
pnpm run typecheck       # TypeScript project references
pnpm run lint:all        # 各活跃 package 的 lint
pnpm run test:all        # 活跃 package、生成物合同
pnpm run test:docs       # 文档权威 verifier 测试
pnpm run verify:docs     # verifier + OpenAPI lint
./manage-services.sh quality
./manage-services.sh smoke
```

`quality` 是无需启动容器的完整 fail-closed 质量门；`smoke` 使用 `scripts/smoke-core-e2e.sh` 构建隔离容器、临时卷并在结束时清理。历史测试只能显式运行 `pnpm run test:legacy`，不代表当前权威。

## API 与术语

- 公共 HTTP 合同：[`docs/openapi.yaml`](docs/openapi.yaml)
- 项目术语：[`CONTEXT.md`](CONTEXT.md)
- Dashboard 语义：[`docs/context/dashboard-analytics.md`](docs/context/dashboard-analytics.md)

公开 API 包括邮箱一次性验证码、Session 刷新、文件与版本、上传意图与配额、分享、发布、Dashboard，以及 grant 授权的 Storage 传输。`/api/v1/internal/*`、`/metrics`、`/live`、`/ready` 和 `/version` 是私有或运维接口，不属于公共 OpenAPI。

## 生产发布

生产只接受 CI 已发布的不可变镜像。按 [`infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md`](infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md) 准备环境，并使用：

```bash
bash infrastructure/alicloud/deploy.sh "sha-<40-lowercase-hex>"
bash infrastructure/alicloud/rollback.sh "sha-<40-lowercase-hex>"
```

发布合同由 `infrastructure/alicloud/docker-compose.core.yml` 和 `scripts/smoke-core-e2e.sh` 支撑。不要绕过 migration、发布锁、健康/版本校验或 manifest 选择；不要通过删除持久卷回滚。

## 软退役观察与删除资格

归档运行时仅供只读或对照观察，不得承载新开发、迁移、部署或生产写入。退役计时尚未开始；只有最终生产部署、回滚和重新部署验收成功并记录 UTC 完成时间后才开始。最早物理删除时间是该记录时间之后连续 14 个无依赖的 24 小时周期。完整规则与证据要求见 [`docs/manage-services.md`](docs/manage-services.md)。

## 安全与贡献

不得提交 `.env`、凭据、token、数据库备份或生成产物。贡献前阅读 [`AGENTS.md`](AGENTS.md)、[`CONTRIBUTING.md`](CONTRIBUTING.md) 与 [`SECURITY.md`](SECURITY.md)，并运行 `./manage-services.sh quality`。

本项目采用 MIT License，详见 [`LICENSE`](LICENSE)。
