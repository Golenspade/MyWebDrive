# Core-first 切流与回滚手册

## 适用范围与不可变约束

本手册只适用于 `docker-compose.core.yml` 中的 Core API + Analytics Worker + Email Provider + Storage API + Storage Worker + Prometheus + Web + Nginx 拓扑。Nginx 是唯一公网入口；旧 Auth、User、Metadata、Sharing 和 Node Gateway 在切流后不得恢复写入。

当前生产仅有 seed 管理员和测试账户，因此本次决策为不迁移历史业务数据。这不等于免除备份：切流前仍必须同时创建 PostgreSQL 一致性快照、Redis 备份和对象桶版本/清单，并记录时间、校验值和保管位置。

## 切流前准入

1. 锁定一个 Git SHA `IMAGE_TAG`，构建并推送六个应用镜像：`core-api`、`email-provider`、`storage`、`prometheus`、`web`、`nginx`。Analytics Worker 复用 `core-api` digest。保留 registry 返回的 multi-architecture digest，禁止 `latest` 或只记 tag。
2. 执行 `make quality-check` 、`scripts/smoke-core-e2e.sh` 和 `scripts/assert-no-sensitive-artifacts.sh`。任一失败都停止。
3. 核对 raw `POSTGRES_PASSWORD` / `REDIS_PASSWORD` 与 URL-encoded `CORE_DATABASE_URL` / `REDIS_URL`。确认四个 Core 密钥彼此不同且每个至少 32 UTF-8 字节。
4. 配置 `CORE_ADMIN_EMAILS` 白名单，只包含需要的规范化邮箱。第一次 OTP 验证会创建账户，所以切流前要用预期管理员邮箱完成一次演练。
5. 在隔离环境验证邮件供应商 HTTPS endpoint/token、发件人、反垃圾政策和延迟；Core 只负责 OTP 安全，上游负责邮箱合法性和可投递性。
6. 确认 MinIO/OSS 桶不对公网开放，访问密钥只授予 Storage；创建桶并运行读写删除探针。
7. 在一个空 Core 数据库顺序执行当前仓库全部 Core migration，包括 Dashboard Analytics 与 Download Attempt migration；再次执行 `prisma migrate deploy` 验证幂等。不得执行任何旧服务 migration。

## 部署和切流

1. 将现有流量保持在旧环境，完成上述快照，并在变更单记录“零用户业务数据，不迁移”决策。
2. 新版本以 CI 通过的不可变标签执行 `IMAGE_TAG=sha-<40hex>` 后运行 `infrastructure/alicloud/deploy.sh "$IMAGE_TAG"`。部署脚本会解析六个 tag 的唯一 registry digest、拉取 digest，并把 `IMAGE_TAG`、由标签派生的 40 位 `GIT_SHA` 与六个 digest 写入新的 release manifest；随后运行 `minio-init` 和单一 `core-migrate`，最后启动应用。`--manifest` 仅用于回滚或已有记录的恢复操作所选择的既有历史 manifest（existing historical manifest），禁止为新版本手工拼装 manifest 或绕过 digest 解析。
3. 检查 Core、Analytics Worker、Email Provider、Storage API、Storage Worker、Prometheus、Web、Nginx 健康状态；读取 Core `/version`，确认 `gitSha/buildId` 与 manifest 一致。
4. 在切换 DNS/负载均衡前完成生产只读 smoke：Nginx `/healthz`、公开 publication 空态、`/api/v1/internal/*` 固定 404。
5. 小流量切入后完成一次真实邮箱 OTP、会话刷新、小文件上传、私有下载票据和登出。在扩大流量前确认日志不包含邮箱、OTP、access/refresh/grant、Cookie 或 Authorization 值。

## 硬失败条件

出现以下任一情况必须停止切流或回滚到上一组完整 Core digest：迁移不幂等；`/ready` 在依赖正常时非 200；依赖中断时仍返回 200；`/version` 与 manifest 不符；Storage grant 可重放；上传无版本/配额提交；内部路由对公网可见；旧服务出现在活跃 compose；日志出现敏感值；无法确认部署锁归属。

## 部署锁的手工 stale 流程

锁位于 `${DEPLOY_STATE_DIR}/.deploy.lock`，不得由脚本自动删除 stale 锁。遇到锁冲突时：

1. 读取锁目录中的 `owner`，核对主机、PID、操作和开始时间。
2. 在该主机确认 PID 不存在，并检查 Docker/Compose 中没有 deploy、pull、migration 或 rollback 正在运行。任一证据不清楚就保留锁并升级。
3. 在事故记录中写入 owner 内容、调查证据和将要重试的 release manifest。
4. 将整个 `.deploy.lock` 原子移动到带 UTC 时间戳的归档目录，再由操作员手工删除锁路径。最后使用已记录的 manifest 重试。

## digest 回滚和隔离恢复演练

回滚只能选择上一份已验证 release manifest 中的不可变 digest，通过 `rollback.sh <release-tag>` 再调用同一 deploy 流程。`ANALYTICS_WORKER_CONTAINER_IMAGE_ID` 记录运行时 container image ID，并作为历史 release 是否支持 Worker 的 support marker；它不是第七个 registry digest，也不是用来选择 Worker 镜像的输入。部署脚本以该键是否存在判断旧 release 是否支持 Analytics Worker；存在时 Worker 仍复用 manifest 的 `CORE_API_IMAGE` digest，缺失时回滚会先停止该 Worker，绝不把旧 Core 镜像当 Worker 强制启动。回滚不得恢复旧 Auth/User/Metadata/Sharing/Gateway 写入，也不得把旧 migration 应用到 Core 数据库。如果新版本已创建数据，优先运行向前修复；不支持的 schema 回退必须先经过单独审批。

正式切流前，将快照恢复到与生产网络、桶和密钥隔离的演练环境；对备份执行校验，运行四个 Core migration，启动上一组 digest，检查 `/ready`、`/version` 和只读数量。恢复演练绝不连接生产 DNS、Redis 或对象桶。记录 RTO/RPO 后销毁隔离环境。
