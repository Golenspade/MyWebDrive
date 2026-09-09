# 纯开发态文档收口与配额自动分配

- 状态：已批准（产品所有者 2026-09-09 口头确认，本文件为权威）
- 日期：2026-09-09
- 决策：当前仓库按 **纯开发状态** 维护；远端生产部署约 2026-09 月底至 10 月停用，不把生产切流演练当作完成条件。存储配额按环境池容量减去预留后，在 User / Superuser / Admin 之间加权平滑分配。一键自动是主路径，手动 PATCH 保留。

## 1. 非目标

- 不做客户端端到端加密。
- 不做 Kubernetes；运行面最多是 ECS + Compose。
- 不做访客 UV。
- 不处理 Dependabot PR。
- 不起容器、不跑 `smoke-core-e2e.sh`、不验证部署结构或生产 digest 回滚。
- 不把「生产部署 → 回滚 → 再部署」evidence 当作本轮交付。

## 2. 生产演练 evidence 端点（只读清单）

这些是 `scripts/smoke-core-e2e.sh`、`docs/runbooks/core-cutover-and-rollback.md` 与契约脚本声明的端点。本轮只记录，不执行。

### 2.1 边界与探活

| 方法 | 路径 | 期望 | 来源 |
|---|---|---|---|
| GET | `/healthz` | 200，Nginx 公网边界 | smoke、host nginx 契约 |
| GET | `/api/v1/internal` | 404 | smoke、cutover 契约 |
| GET | `/api/v1/internal/*` | 404 | smoke、nginx 阻断 |
| GET | Core `http://127.0.0.1:8080/ready` | 依赖正常 200，依赖中断非 200 | smoke、release 契约 |
| GET | Analytics `http://127.0.0.1:8081/ready` | 200 | smoke |
| GET | Storage API `http://127.0.0.1:7084/ready` | 200 | smoke |
| GET | Storage Worker `http://127.0.0.1:7085/ready` | 200 | smoke |
| GET | Email provider `http://127.0.0.1:8090/ready` 或 fake `8025/healthz` | 200 | compose healthcheck |
| GET | Prometheus `/-/ready` | 200 | compose |
| GET | Web `/` | 200 | compose |
| GET | Core `/version` | 200，`gitSha`/`buildId` 与 manifest 一致 | runbook、deploy.sh |
| GET | `/live`、`/metrics` | 运维，不对公网 OpenAPI | app.ts |

### 2.2 身份与会话

| 方法 | 路径 | 期望 |
|---|---|---|
| POST | `/api/v1/auth/email/request` | 202 |
| POST | `/api/v1/auth/email/verify` | 200，Set-Cookie `mwd_refresh` |
| POST | `/api/v1/auth/refresh` | 200 |
| GET | `/api/v1/auth/me` | 200 |
| POST | `/api/v1/auth/logout` | 204 |

### 2.3 配额、上传、文件、分发

| 方法 | 路径 | 期望 |
|---|---|---|
| GET | `/api/v1/quota` | 200 |
| POST | `/api/v1/upload-intents` | 201 |
| PUT | `/api/v1/storage/uploads/{objectKey}/parts/{n}` | 204，Bearer 为 upload grant |
| POST | `/api/v1/storage/uploads/{objectKey}/complete` | 202 |
| GET | `/api/v1/files` | 200，出现新版本 |
| GET | `/api/v1/files/{fileId}/versions` | 200 |
| POST | `/api/v1/files/{fileId}/download-ticket` | 200 |
| GET | `/api/v1/storage/objects/{objectKey}` | 200 一次，重放 401 |
| POST | `/api/v1/files/{fileId}/shares` | 201 |
| POST | `/api/v1/shares/{token}/download-ticket` | 并发只成功一次（maxDownloads=1） |
| PUT | `/api/v1/files/{fileId}/publication` | 200 |
| GET | `/api/v1/publications` | 200 |
| POST | `/api/v1/publications/{slug}/download-ticket` | 200 |

### 2.4 Dashboard

| 方法 | 路径 | 期望 |
|---|---|---|
| GET | `/api/v1/admin/dashboard/business?range=today` | 200，Prometheus 停止后仍 200 |
| GET | `/api/v1/admin/dashboard/system?range=today` | 200，Prometheus 停止后降级仍 200 |

仓库内 **没有** `docs(release): record deployment and rollback evidence` 产物。本轮不补生产演练证据。

## 3. 文档与旧代码政策

当前是纯开发状态：

- 活跃文档只描述 Core-first 本地开发：`./manage-services.sh setup|start|stop|status|logs|quality`，站点 `http://127.0.0.1:8080`。
- 删除过于防御性的「retirement clock / 14 天 / UTC 完成时间戳」规则，以及把它写进 verifier 的测试。
- `docs/_archive/`、`docs/reports/`、`archive/legacy-*`、已完成的旧 superpowers 实施计划从工作树删除；需要时从 git history 取回。
- 旧 Auth/User/Metadata/Sharing/Gateway 源码不进默认工作流。本轮将它们移出工作树（同样可从 git history 恢复），并去掉 `test:legacy` 作为仓库权威的一部分。
- 生产 compose / deploy.sh 可以留在树中作为历史入口，但活跃文档不再把它们写成必须完成的演练。文档权威 verifier 不再要求每个活跃文档引用 `deploy.sh` / `rollback.sh`。

## 4. 角色模型

`User.role` 取值：`user` | `superuser` | `admin`。

| 角色 | 权重（默认） | 能力 |
|---|---|---|
| `user` | 1 | 自己的文件、配额、分享 |
| `superuser` | 3 | user + 只读用户列表与配额预览；不能改别人角色，不能一键重算全站配额 |
| `admin` | 8 | 全部管理面，含一键自动分配与手动 PATCH |

首次验证：`CORE_ADMIN_EMAILS` → `admin`；`CORE_SUPERUSER_EMAILS` → `superuser`；其余 → `user`。Admin 邮箱优先于 Superuser。

## 5. 配额自动分配

参考：

- Google Workspace：组织池 + 可选 per-user cap；无 cap 时个人可吃光池。单机 ECS 不能过订，因此本产品用 **硬分区**：`sum(limit) <= pool - platformReserve`。
- ZFS / ONTAP：quota 是天花板，reservation 是从池里先扣掉的保证。本产品的 `QuotaAccount.reservedBytes` 是进行中的 upload intent 占用，必须从可分配量里减去。
- 默认配额（ONTAP default user quota）只作为「池尚未配置时」的回退，不再当长期权威。

### 5.1 池

- `STORAGE_POOL_BYTES`：环境物理/逻辑池（必填，非负十进制）。
- `STORAGE_PLATFORM_RESERVE_BYTES`：平台预留（默认 `0`），用于文件系统 slop，不参与用户限额。

### 5.2 一键算法（可重入、可预览）

对所有 `status=active` 用户，在可串行化事务中：

1. 释放已过期 reservation（现有 `releaseExpiredReservations`）。
2. `occupied_i = committed_i + reserved_i`。
3. `allocable = STORAGE_POOL_BYTES - STORAGE_PLATFORM_RESERVE_BYTES - sum(occupied)`。
4. 若 `allocable < 0`：每个 `limit_i = occupied_i`，返回 `overcommitted: true`，不抛致命错误（已占用不能被限额割掉）。
5. 否则按角色权重把 `allocable` 分给各用户作为 **headroom**（Hamilton 最大余数，字节为整数）：
   - `limit_i = occupied_i + share_i`
   - `sum(share) = allocable`
6. 跳过 `status != active` 的账户（其 limit 不变）。
7. 写 ledger `kind = 'pool_rebalance'`，`businessRef = 'pool-rebalance:<runId>:<userId>'`。

新用户首次 OTP 成功：先按当时池与现有用户做一次 **该用户插入后的局部重算**，或给一个临时 `min(defaultUserQuotaBytes, remainingAllocable)`，再由管理员一键重算对齐。选择：创建时调用同一分配函数（全员重算），避免新用户拿走固定 10GiB 把池撑爆。

### 5.3 API

- `GET /api/v1/admin/quota/pool`（admin, superuser 只读）→ 池、预留合计、allocable、拟议限额（不写入）。
- `POST /api/v1/admin/quota/rebalance`（仅 admin）→ 执行算法并返回每位用户新旧限额。
- `PATCH /api/v1/admin/users/:userId/quota` 继续存在（手动）。若 `limit` 使 `sum(limit) > pool - platformReserve`，返回 409 `pool exceeded`。

### 5.4 前端

Admin 用户页主按钮：「按池自动分配」。手动输入限额为次要操作。Superuser 能看池预览，不能点执行。

## 6. 完成标准

- 活跃文档与 verifier 不再要求 retirement clock。
- 工作树不包含 `docs/_archive`、`docs/reports`、legacy split-control-plane archive。
- 角色含 `superuser`；一键重算减去 occupied（含 reserved）；测试覆盖权重、过订、手动超池 409。
- 未要求生产 smoke 变绿作为本轮完成条件。
