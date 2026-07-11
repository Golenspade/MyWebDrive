# Core-first 切流与回滚手册

## 适用范围与不可变约束

本手册只适用于 `docker-compose.core.yml` 中的 Core API + Storage API + Storage Worker + Web + Nginx 拓扑。Nginx 是唯一公网入口；旧 Auth、User、Metadata、Sharing 和 Node Gateway 在切流后不得恢复写入。

当前生产仅有 seed 管理员和测试账户，因此本次决策为不迁移历史业务数据。这不等于免除备份：切流前仍必须同时创建 PostgreSQL 一致性快照、Redis 备份和对象桶版本/清单，并记录时间、校验值和保管位置。

## 切流前准入

1. 锁定一个 Git SHA `IMAGE_TAG`，构建并推送四个应用镜像：`core-api`、`storage`、`web`、`nginx`。保留 registry 返回的 multi-architecture digest，禁止 `latest` 或只记 tag。
2. 执行 `make quality-check` 、`scripts/smoke-core-e2e.sh` 和 `scripts/assert-no-sensitive-artifacts.sh`。任一失败都停止。
3. 核对 raw `POSTGRES_PASSWORD` / `REDIS_PASSWORD` 与 URL-encoded `CORE_DATABASE_URL` / `REDIS_URL`。确认四个 Core 密钥彼此不同且每个至少 32 UTF-8 字节。
4. 配置 `CORE_ADMIN_EMAILS` 白名单，只包含需要的规范化邮箱。第一次 OTP 验证会创建账户，所以切流前要用预期管理员邮箱完成一次演练。
5. 在隔离环境验证邮件供应商 HTTPS endpoint/token、发件人、反垃圾政策和延迟；Core 只负责 OTP 安全，上游负责邮箱合法性和可投递性。
6. 确认 MinIO/OSS 桶不对公网开放，访问密钥只授予 Storage；创建桶并运行读写删除探针。
7. 在一个空 Core 数据库顺序执行 `202607110001_core_init`、`202607110002_quota_expiry_index`、`202607110003_file_targets`、`202607110004_outbox_dedupe`，再次执行 `prisma migrate deploy` 验证幂等。不得执行任何旧服务 migration。

## 部署和切流

1. 将现有流量保持在旧环境，完成上述快照，并在变更单记录“零用户业务数据，不迁移”决策。
2. 使用四个 digest 创建 release manifest，运行 `infrastructure/alicloud/deploy.sh --manifest <manifest>`。部署工具必须先拉取 digest，再运行 `minio-init`和单一 `core-migrate`，最后启动应用。
3. 检查 Core、Storage API、Worker、Web、Nginx 健康状态；读取 Core `/version`，确认 `gitSha/buildId` 与 manifest 一致。
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

回滚只能选择上一份已验证 release manifest 中的四个 digest，通过 `rollback.sh <manifest>` 再调用同一 deploy 流程。回滚不得恢复旧 Auth/User/Metadata/Sharing/Gateway 写入，也不得把旧 migration 应用到 Core 数据库。如果新版本已创建数据，优先运行向前修复；不支持的 schema 回退必须先经过单独审批。

正式切流前，将快照恢复到与生产网络、桶和密钥隔离的演练环境；对备份执行校验，运行四个 Core migration，启动上一组 digest，检查 `/ready`、`/version` 和只读数量。恢复演练绝不连接生产 DNS、Redis 或对象桶。记录 RTO/RPO 后销毁隔离环境。
