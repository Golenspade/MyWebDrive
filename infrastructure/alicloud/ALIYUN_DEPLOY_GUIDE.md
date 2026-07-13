# MyWebDrive Core-first 阿里云部署指南

本文件只描述当前生产权威路径。旧的拆分式 Auth/User/Metadata/Sharing/Gateway
编排已经 **SOFT-RETIRED**，不得再作为部署或回滚入口。

## 权威文件

- 生产编排：`infrastructure/alicloud/docker-compose.core.yml`
- 部署入口：`infrastructure/alicloud/deploy.sh`
- 回滚入口：`infrastructure/alicloud/rollback.sh`
- 环境模板：`infrastructure/alicloud/env.example`
- 发布契约：`scripts/verify-core-release-contract.sh`
- 隔离式端到端验证：`scripts/smoke-core-e2e.sh`

生产编排只接受已经发布的不可变镜像。发布标签必须是完整 Git SHA 形成的
`sha-<40 lowercase hex>`，部署脚本会进一步把标签解析并记录为镜像摘要。

## 发布前验证

在有 Docker Compose v2 的可信构建机上，从仓库根目录执行：

```bash
corepack pnpm install --frozen-lockfile
./manage-services.sh quality
./manage-services.sh smoke
```

Smoke 会构建本地镜像、创建隔离项目和临时卷，并在退出时清理；不要对生产
Compose 项目直接运行它。

## 服务器准备

1. 安装 Docker Engine 与 Compose v2。
2. 仅向公网开放 SSH、HTTP 和 HTTPS；数据库、Redis、MinIO、Core、Storage、
   Prometheus 与 Web 容器端口保持在私有网络中。
3. 创建可写的发布状态目录（默认 `/var/lib/mywebdrive/releases`），并将仓库
   中的权威 Compose、部署脚本和 Nginx 配置交付到固定发布目录。
4. 从 `infrastructure/alicloud/env.example` 创建
   `infrastructure/alicloud/.env`，填入生产值并限制文件权限。不得提交该文件。

至少需要配置镜像仓库、数据库/Redis/MinIO 凭据，以及 Core session、OTP、
Storage grant、Core callback 和内部邮件 provider 的随机密钥。持久 AccessKey
不应传给邮件容器；生产邮件适配器使用批准的 ECS RAM role 与 IMDSv2。

先验证配置可以完整解析：

```bash
export IMAGE_TAG=sha-0123456789abcdef0123456789abcdef01234567
docker compose \
  --env-file infrastructure/alicloud/.env \
  -f infrastructure/alicloud/docker-compose.core.yml \
  config -q
```

## 部署

CI 发布完同一个 `IMAGE_TAG` 的 Core、Email、Storage、Web、Nginx 和 Prometheus
镜像后，在生产主机的发布目录执行：

```bash
export IMAGE_TAG=sha-0123456789abcdef0123456789abcdef01234567
bash infrastructure/alicloud/deploy.sh "$IMAGE_TAG"
```

部署脚本会以 fail-closed 方式完成配置校验、镜像拉取与摘要解析、对象存储
初始化、Core migration、依赖健康检查、服务启动、`/version` 校验，以及
`current.env` 与历史 manifest 的原子记录。并发部署会以退出码 `75` 拒绝。

部署后至少验证：

```bash
curl --fail --silent --show-error https://mygoavemujica.top/healthz
curl --fail --silent --show-error https://mygoavemujica.top/api/v1/auth/me
```

第二个请求在未登录时可以返回认证错误；关键是请求由当前 Core-first 路由
处理，而不是旧 Gateway。

## 状态与日志

所有人工排查命令都必须显式使用权威 Compose 文件与环境文件：

```bash
docker compose \
  --env-file infrastructure/alicloud/.env \
  -f infrastructure/alicloud/docker-compose.core.yml \
  ps

docker compose \
  --env-file infrastructure/alicloud/.env \
  -f infrastructure/alicloud/docker-compose.core.yml \
  logs --tail=200 core-api storage-api nginx
```

不要用 `compose down --volumes`、卷清理或系统级 prune 处理发布故障。先保留
容器状态、日志和发布 manifest，再决定回滚。

## 回滚

回滚目标必须已经存在于发布状态目录的历史 manifest 中：

```bash
export TARGET_TAG=sha-0123456789abcdef0123456789abcdef01234567
bash infrastructure/alicloud/rollback.sh "$TARGET_TAG"
```

回滚脚本验证目标 manifest 后，会复用 `infrastructure/alicloud/deploy.sh` 的
同一套不可变镜像、迁移、健康检查和状态记录流程。缺少 manifest、摘要不合法
或目标标签不匹配时必须停止，不能临时改用旧编排。

## 安全边界

- `.env`、发布 manifest 中的敏感值和数据库备份不得进入 Git。
- Nginx 对外只暴露同源 Web/API 路由；内部 API 与 Prometheus 不对公网开放。
- 日志格式不得记录 URL、查询串、Authorization、cookie 或分享 token。
- 备份与恢复由独立、经过演练的运维流程负责，发布脚本不会删除持久卷。
