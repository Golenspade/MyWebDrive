# 纯开发态文档收口与配额自动分配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把仓库从生产演练防御文档切到纯开发态，并实现按池减去预留后的 User/Superuser/Admin 加权配额自动分配。

**Architecture:** 文档先删后改，同步放宽 `verify-doc-authority` 与 repo-authority 契约。配额算法进 `services/core-api/src/quota/`，管理 API 进 admin router，OpenAPI 与 Admin 用户页接一键按钮。不做加密、K8s、UV、Dependabot、不起容器做生产演练。

**Tech Stack:** Node.js 20+, TypeScript, Express, Prisma 5, PostgreSQL, Vitest, Next.js 15, pnpm 9.7.0。

## Global Constraints

- 工作目录：`/Users/fankex/Developer/active/myWebDrive`，分支 `feat/dev-mode-quota-allocation`。
- 规格权威：`docs/superpowers/specs/2026-09-09-dev-mode-quota-allocation.md`。
- 2-space、single quotes、无分号、ESM、`.js` 后缀导入。
- 不提交密钥、`.env`、生成物。
- 不起 Docker 跑 `smoke-core-e2e.sh`。
- 每个任务先写失败测试再实现（TDD）。
- Conventional Commit，每个任务一次提交。

## File map

| Path | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-09-09-dev-mode-quota-allocation.md` | 本轮规格 |
| `README.md` `CLAUDE.md` `CONTRIBUTING.md` `SECURITY.md` `CONTEXT.md` `docs/manage-services.md` | 活跃开发文档 |
| `scripts/verify-doc-authority.mjs` 及其 test | 去掉 retirement clock 与 deploy 必引 |
| `services/core-api/src/quota/pool.ts` | 池重算 |
| `services/core-api/src/admin/router.ts` | pool GET / rebalance POST / superuser |
| `services/core-api/src/identity/otp.ts` | 三角色 + 创建时重算 |
| `docs/openapi.yaml` | 新路径 |
| `frontend/cruip-landing/app/admin/users/page.tsx` | 一键按钮 |

---

## Task 1: 删除过时文档并放宽文档契约

**Files:**
- Delete: `docs/_archive/`, `docs/reports/`, `archive/legacy-split-control-plane-2026-07-13/`, `archive/root-cleanup-2026-06-17/`, `archive/README.md`, `frontend/ARCHIVED.md`
- Delete completed historical plans except keep `docs/superpowers/specs/2026-07-10-core-api-storage-architecture-design.md`, `2026-07-12-admin-dashboard-analytics-design.md`, `2026-07-15-lightweight-dual-branch-git-workflow-design.md`, and this round's spec/plan
- Modify: `scripts/verify-doc-authority.mjs`, `scripts/verify-doc-authority.test.mjs`, `scripts/test-repo-authority-contract.sh`（去掉对 retirement clock 短语的强制；活跃文档不再必须引用 `deploy.sh`/`rollback.sh`）
- Modify: `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/manage-services.md` — 写成 Core-first 本地开发指南，删除 14 天时钟段落

**Steps:**
- [ ] 改 verifier 测试：不再要求 retirement clock；断言 manage-services 描述 `setup`/`start` 与 `127.0.0.1:8080`
- [ ] 改 verifier 实现使新测试失败（先红）
- [ ] 删过时目录与文件
- [ ] 改实现与活跃文档使 `pnpm run test:docs` 与 `node scripts/verify-doc-authority.mjs` 通过
- [ ] Commit `docs(repo): drop retirement-clock docs for local-first development`

---

## Task 2: 移出旧控制面源码

**Files:**
- Delete: `services/auth`, `services/user`, `services/metadata`, `services/sharing`, `services/api-gateway-node`
- Modify: `scripts/run-legacy-tests.sh` 改为打印「源码已移除，见 git history」并 exit 0 或 64（选 0 以免 quality 以外的习惯命令爆炸，但默认 quality 不调用它）
- Modify: `scripts/test-core-dev-contract.sh` / `test-repo-authority-contract.sh` 中仍要求 SOFT-RETIRED 文案的断言，改为「未知命令 exit 64」即可，不要求 archive 存在
- Modify: `pnpm-workspace.yaml` 若仍用 `services/*` 则删除后自然只剩 core-api/storage/email-provider

**Steps:**
- [ ] 确认默认 `pnpm run build:all` / `test:all` 过滤器已不含旧服务
- [ ] 删除五个旧服务目录
- [ ] 更新仍引用其路径的契约脚本
- [ ] 跑 `pnpm run test:docs` 与受影响的 bash 契约（不要跑 Docker smoke）
- [ ] Commit `chore(repo): remove leftover split control-plane sources`

---

## Task 3: Superuser 角色

**Files:**
- Modify: `services/core-api/src/auth/middleware.ts`, `admin/router.ts`, `identity/otp.ts`, `identity/session.ts` 若 role 联合类型在此
- Modify: admin role PATCH 允许 `superuser`
- Modify: corresponding `__tests__`

**Steps:**
- [ ] 失败测试：OTP 对 `CORE_SUPERUSER_EMAILS` 建 superuser；PATCH 接受 superuser；非 admin 不能 PATCH 角色
- [ ] 实现
- [ ] `pnpm --filter core-api test` 相关文件通过
- [ ] Commit `feat(core): add superuser role`

---

## Task 4: 池配额自动分配

**Files:**
- Create: `services/core-api/src/quota/pool.ts` 与 `pool.test.ts`
- Modify: `quota/service.ts`（复用 serializable + occupied 约束）
- Modify: `config.ts` 增加 `STORAGE_POOL_BYTES`、`STORAGE_PLATFORM_RESERVE_BYTES`
- Modify: `identity/otp.ts` 首次建用户后全员重算
- Modify: `uploads/router.ts` 手动 PATCH 增加池校验
- Modify: `admin/router.ts` GET pool / POST rebalance
- Modify: `docs/openapi.yaml`
- Modify: health/config 测试里的 env fixture

**Steps:**
- [ ] 纯函数/服务测试：权重 1/3/8、减去 reserved、overcommit 时 limit=occupied、字节守恒
- [ ] HTTP 测试：admin POST 写入、superuser GET 可以 POST 403、手动超池 409
- [ ] 实现
- [ ] Commit `feat(core): rebalance user quotas from remaining pool`

---

## Task 5: Admin 一键分配 UI

**Files:**
- Modify: `frontend/cruip-landing/lib/api/admin.ts`（或新 `quota.ts`）
- Modify: `frontend/cruip-landing/app/admin/users/page.tsx`
- Modify: 若有 dashboard-contract 测试则补路径字符串

**Steps:**
- [ ] 用户页主按钮调用 POST rebalance，显示池剩余与每位新限额
- [ ] 手动限额输入保留为次要
- [ ] Commit `feat(frontend): add one-click quota rebalance`

---

## Task 6: 收口剩余活跃文档与架构 spec §19

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-core-api-storage-architecture-design.md` 第 19 节改为指向已落地 + 本轮配额 spec
- Modify: `CONTEXT.md` 增加 Superuser、Storage Pool、Rebalance
- Modify: `CHANGELOG.md` 写成 Core-first 现状（可短）
- Modify: `docs/openapi.yaml` 与 `frontend/cruip-landing/README.md`
- Delete `docs/CHANGELOG.md` 若与根重复且内容过时

**Steps:**
- [ ] `pnpm run verify:docs` 通过
- [ ] Commit `docs(core): align remaining authority docs with local-first quota pool`
