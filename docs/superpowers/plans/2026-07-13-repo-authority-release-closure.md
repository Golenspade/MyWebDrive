# 仓库权威统一与生产闭环计划

> 执行要求：使用 `superpowers:subagent-driven-development`，每个任务由新的实现 Subagent 顺序完成，并在进入下一项前通过规格审查与质量审查。

## 一、目标与完成标准

本轮把仓库从“新旧架构并存、文档与实现不完全一致”收敛为唯一的 **Core-first** 工作路线，并建立从本地开发、代码质量、完整 E2E、CI 发布到生产回滚的闭环。

完成标准：

- 默认构建、测试、开发、文档和部署只指向当前 Core-first 架构。
- `apps/web` 删除；旧 Auth/User/Metadata/Sharing/Gateway 退出默认工作流。
- 旧服务源码软退役一周期：完成一次成功发布后保留 14 天，再单独评估物理删除。
- README、AGENTS、CONTEXT、OpenAPI 与真实实现一致。
- Nothing UI 有可自动执行的结构、无障碍和视觉回归约束。
- CI 在发布镜像前通过真实 Docker Compose 全栈 E2E。
- 新版本完成生产部署、旧版本回滚、再部署新版本的完整演练，并留下脱敏证据。

## 二、执行与审查机制

- 在当前 linked worktree 中使用分支 `codex/repo-authority-release-closure`，不再创建嵌套 worktree。
- 每项任务使用一个全新的实现 Subagent，顺序执行，禁止多个写入型 Subagent 并发修改同一工作区。
- 每项任务完成后进行规格审查和质量审查；不通过则修正后重新审查。
- 每项任务采用独立 Conventional Commit；最后增加一次全分支综合审查。
- 若执行期间 `origin/main` 前进，先 rebase，再重跑全部门禁。

## 三、实施清单

### Task 1: 清理工作区权威边界

- 删除 `apps/web` 及其脚本、文档、workspace filter 和开发入口引用。
- 将 Auth、User、Metadata、Sharing、旧 Gateway 从默认 build、typecheck、lint、test 和开发流程中移除。
- 保留旧服务源码及显式 `test:legacy`、必要的 `legacy:*` 入口；调用时输出软退役警告。
- 将旧 split-control-plane compose、部署和运维入口迁入归档目录，禁止当前脚本或 CI 调用。
- 清除已跟踪的 `dist`、`.next`、`*.tsbuildinfo`、Prisma generated client、原生库、PID 文件和前端 `package-lock.json`。
- 修复 `.gitignore`，新增生成物追踪检查。
- 默认根脚本只覆盖 common、observability、core-api、email-provider、storage 和主前端。

验证：冻结安装；默认 build/typecheck/test 不解析旧服务或 `apps/web`；生成物追踪为空；显式 legacy 测试仍可发现。

提交：`chore(repo): retire legacy workspace surfaces`

### Task 2: 建立唯一 Core-first 本地开发入口

- 新增以生产 Core compose 为基础的开发 overlay，仅覆盖本地构建、loopback 端口、fake email 和开发环境变量。
- 重写 `manage-services.sh`，公开 `setup`、`start`、`stop`、`status`、`logs`、`config`、`smoke`、`quality`、`reset --confirm` 和 `legacy:<command>`。
- `start-backend` 等旧默认命令返回 64，提示改用 `start`。
- 首次启动在忽略目录生成稳定的随机本地密钥；`stop` 不删除密钥；破坏性重置要求 `--confirm`。
- 默认地址为 `http://127.0.0.1:8080`；fake email 仅绑定 loopback。
- 增加 shell contract test，验证帮助、退出码、compose、服务列表、退役命令和重置确认。

提交：`feat(dev): make Core-first topology the default`

### Task 3: 统一文档、术语和 OpenAPI 权威

- 重写 README、AGENTS 的现状、架构、开发命令、测试、生产部署和软退役说明。
- 将 Dashboard 专用 CONTEXT 迁到专门文档，根 CONTEXT 改为全项目术语权威。
- OpenAPI 仅描述真实公开的身份、文件、上传意图、分享、发布、下载、Dashboard 和 Storage 接口。
- 将 `/internal/*`、`/metrics`、`/live`、`/ready`、`/version` 标为内部或运维接口。
- 增加锁定版本的 OpenAPI 校验与 `verify:docs` 权威检查，禁止旧 register/password-login/Gateway 表述重新进入活跃文档。
- 历史报告保持历史真实性；仍在活跃文档区的旧方案迁入归档并标记 superseded。

提交：`docs(architecture): align repository authority with Core-first`

### Task 4: 收敛 Nothing UI 视觉契约

- 新增 Nothing UI 扫描器及 `node:test` 单元测试。
- 扫描主前端 `app` 和 `components`，禁止正向投影、非白名单 gradient/mask、token 文件外原始十六进制颜色和旧品牌 token。
- 点阵背景仅允许在基础样式的显式白名单声明。
- 修复活跃组件中的投影，删除没有应用入口的旧 demo UI，清除旧品牌 token 和无调用工具类。
- 增加 `verify:ui`，并纳入 `quality` 与 CI。

提交：`refactor(frontend): enforce Nothing UI contract`

### Task 5: 建立浏览器与完整全栈发布门禁

- 主前端加入锁定版本的 Playwright 与 axe，仅使用 Chromium。
- 固定桌面 `1440×900`、移动 `390×844`，覆盖 `/`、`/signin`、`/download`、`/admin/overview`。
- 使用测试 fake email 通过真实 UI 完成 OTP 登录，不添加生产测试后门。
- axe 不允许 critical 或 serious 违规。
- 视觉基线覆盖首页 light/dark、登录、下载、管理员概览及首页/登录移动端。
- 验证健康状态与 Prometheus 停止后的降级行为。
- 改造 `smoke-core-e2e.sh`：支持 `SMOKE_REUSE_IMAGES=1` 和 `SMOKE_BROWSER_GATE=1`，CI 不删除发布所需镜像。
- CI 顺序为质量门禁、六镜像构建、完整 Compose E2E、浏览器/axe/视觉回归，全部成功后才发布镜像。
- 失败时上传脱敏 Playwright 报告、截图、compose 日志和服务状态。

提交：`ci(release): gate image publishing on full Core smoke`

### Task 6: 全分支验证、合并与生产演练

- 运行冻结安装、默认 build/typecheck/lint/test、文档、OpenAPI、Nothing UI、生成物、compose、Docker E2E 和浏览器门禁。
- 全分支规格与代码质量审查通过后，更新 `origin/main`；必要时 rebase 并重跑全部门禁。
- 优先 fast-forward 合并；若分支保护阻止，则创建 ready PR，等待 required checks 并合并。
- 等待合并后的精确 main SHA CI 全绿，仅发布其不可变镜像标签。
- 生产执行：记录旧版本 → 部署新版本 → 验收 → 精确回滚旧版本并验收 → 重新部署新版本并最终验收。
- 真实 OTP 仅在需要时由用户提供，不记录验证码。
- 上传约 32 字节的 `acceptance-<shortsha>.bin` 并验证私有下载和 Dashboard 增量。
- 临时停止 Prometheus 验证 Business Analytics 和 System Health 降级，然后立即恢复。
- 提交脱敏发布证据，不包含邮箱、OTP、token、cookie、grant、对象密钥或服务器密钥。

提交：`docs(release): record deployment and rollback evidence`

## 四、公共接口变化

- 不新增或修改产品 HTTP 路由；OpenAPI 与现有实现对齐。
- 新的仓库公共操作接口：
  - `./manage-services.sh start|stop|status|logs|config|smoke|quality`
  - `./manage-services.sh reset --confirm`
  - `./manage-services.sh legacy:<command>`
  - `pnpm run verify:docs`
  - `pnpm run verify:ui`
  - `pnpm run test:e2e`
- 旧默认开发命令明确失败；`apps/web` 正式删除；旧微服务只保留显式 legacy 接口。

## 五、约束与默认决定

- 不引入数据库 schema 或 migration 变更；若发现必须修改，停止并另行制定迁移方案。
- Legacy 物理删除条件：最终新版本成功发布且完成回滚演练后，连续 14 天无回滚、流量或运维依赖。
- GitHub Runner 是完整 Docker E2E 的最终权威；本地 Docker daemon 未运行不降低 CI 要求。
- Playwright 首轮仅支持 Chromium。
- 首轮视觉基线经审查后成为权威版本，后续更新必须显式批准。
- 生产验收文件保持最小并脱敏登记。
- 密钥、OTP、cookie 和临时授权不得进入 Git、CI artifact 或发布报告。
