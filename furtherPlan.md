## MyWebDrive 扩展方案与实施文档（需求与架构改造评估）

### 1. 目标与范围
- 核心目标
  - 以 Markdown 为主的内容存储与安全渲染（前台可读）
  - 支持外链型内容（视频/文章等）推荐，点击跳转到原作者支持页面（记录点击量）
  - Live2D 资源的静态 PNG 预览（不加载模型）
  - 登录用户的投票/评分系统（防刷、幂等）
  - 作者与作品的双向关联：作者页列出其作品，作品页指向作者
  - 内容类型多样化：图文、纯文、视频、技术、工具、社区美术资源等
- 非目标（当前阶段）
  - 不做服务端重型转码或 Live2D 在线渲染
  - 不做全局搜索引擎（可预留接口）
  - 不做复杂社交系统（关注/订阅/评论等可后续扩展）

### 2. 整体架构与服务边界调整
- 现状：API Gateway + 多微服务（auth/user/metadata/storage/sharing）+ 前端
- 建议的两种演进路径
  - 选项A（短期）：在 metadata-service 中扩展“内容中心”职责（Author/Work/Tag/Link），另新增 rating-service
  - 选项B（中长期）：新增 content-service（作者/作品/标签/外链），rating-service 独立；metadata-service 回归文件/目录元数据
- 推荐策略：先采用选项A最小变更，后续流量与复杂度上升再拆出 content-service

### 3. 数据模型（核心实体与关系）
- Author（作者）
  - 字段：id, name, bio, avatar_url, socials(json), created_at, updated_at
  - 与 user 的关系：可一对一/一对多（“用户即作者”或作者团队）
- Work（作品）
  - 字段：id, author_id, title, summary, content_type(enum: markdown | url | live2d | image_pack | video_external | other), storage_ref(file_id), external_url, preview_image_ref(file_id), tags(json or link-table), license(enum), source_attribution(text/url), click_out_count(int), visibility(enum: public | unlisted | private), created_at, updated_at, published(bool)
- Tag / WorkTag（标签与多对多关系）
  - Tag: id, name, category(optional)
  - WorkTag: work_id, tag_id
- LinkPreview（可选缓存）
  - url, title, description, site_name, thumbnail_url, fetched_at, status
- Rating（评分，独立 rating-service）
  - id, work_id, user_id, score(int/float), comment(optional), created_at
  - 约束：unique(work_id, user_id)
- RatingAggregate（聚合缓存）
  - work_id, avg_score, score_count, updated_at

迁移策略：在 metadata-service 中新增表与索引（短期）；未来迁移到 content-service 时保留兼容视图或数据迁移脚本。

### 4. 存储与文件策略
- Markdown（.md）与 Live2D 预览 PNG 均走 storage-service（已有上传/分片/下载接口）
- Work.storage_ref/preview_image_ref 存储关联的 file_id
- Live2D 资源作为 zip 包等二进制存储；仅展示 PNG 预览（前端懒加载、限尺寸、强缓存）
- 不做后端图片压缩/转码，预览图由上传者提供（节省资源与成本）

### 5. API 设计（经 API Gateway 转发）
- Authors
  - GET /api/v1/authors?query=&page=
  - GET /api/v1/authors/:authorId
  - GET /api/v1/authors/:authorId/works
  - POST/PATCH /api/v1/authors（登录与权限控制）
- Works
  - GET /api/v1/works?type=&tag=&author=&sort=&page=
  - GET /api/v1/works/:id
  - POST /api/v1/works（创建作品：支持 md file_id / external_url / preview png file_id）
  - PATCH /api/v1/works/:id（更新元信息/关联/发布状态）
  - GET /api/v1/works/:id/go（外链跳转：服务端计数 + 302 至 external_url）
- Link Preview（可选）
  - GET /api/v1/link-preview?url=（返回OG元信息/缩略图，带SSR防护）
- Ratings（独立 rating-service）
  - POST /api/v1/works/:id/ratings（登录用户评分，重复评分覆盖或限制）
  - GET /api/v1/works/:id/ratings（聚合 + 分页用户评分）
- Gateway 路由与中间件
  - 对写操作（POST/PATCH）与评分接口加 JWT 鉴权与限流
  - 对外链跳转接口（/go）加防滥用保护（频控/统计）

### 6. 前端改造（关键页面与组件）
- 内容渲染
  - Markdown：react-markdown/remark + 高亮（shiki/prism），严格 DOMPurify 消毒（限制 HTML）
  - 外链卡片：LinkCard 组件（标题/描述/站点/缩略图），点击触发 /works/:id/go
  - Live2D：仅展示 PNG 预览，懒加载 + 固定最大尺寸 + 强缓存头
- 页面
  - 作品列表：支持按类型/标签/作者过滤，按评分/最新排序
  - 作品详情：Markdown/外链卡片预览、评分聚合、作者信息、更多作品
  - 作者页：作者资料、社交、作品列表、评分统计
  - 发布/编辑作品表单：上传 md、上传预览图、填写外链、选择标签与类型
  - 评分 UI：登录检查、一人一次（可覆盖），提交后刷新聚合
- 状态管理
  - worksStore, authorsStore, ratingsStore（沿用现有 store 模式）
- 体验与性能
  - 懒加载/分页；列表仅展示摘要；图片占位符与优先级优化

### 7. 安全与合规
- XSS（Markdown 渲染）
  - 过滤/禁用危险 HTML 标签与属性；代码块高亮需转义
  - 图片域名白名单（可选），阻止 JS 注入
- SSRF（Link Preview 抓取）
  - 校验 URL：只允许 http/https；禁止内网/环回地址；限制重定向与内容体积；设置请求超时
  - 失败结果缓存（防抖/退避）
- 评分防刷
  - JWT 鉴权 + IP/设备限流 + 冷却期（简单有效）；后续可加入风控服务
- 版权与来源
  - 数据模型中加入 license 与 source_attribution；跳转文案“支持原作者”
  - 留出下架与投诉接口（后续）

### 8. 性能与成本控制
- 仅使用 PNG 预览图片，不加载 Live2D 模型
- 前端懒加载与分页；预览文本按摘要显示；图片限尺寸/压缩（由上传者提供）
- 后端不做重型转码；Link Preview 仅抓取 HTML 头信息/OG 标签
- 评分聚合缓存（写时更新或定期刷新）；关键列表加缓存与限流

### 9. 观测与运维
- 日志：请求日志（网关与服务）、关键业务事件（评分、跳转、发布）
- 指标：评分数、平均分、点击跳出、作品发布量、作者活跃度、资源上传量
- 健康检查：/health；错误告警阈值
- 任务脚本：数据库迁移、数据种子、服务管理（已有 manage-services.sh）

### 10. 实施路线图（分阶段）
- 阶段1：数据模型与基础 CRUD
  - 在 metadata-service 扩展 Author/Work/Tag/Link；完成迁移/索引
  - 新增 Works/Authors API；前端作品列表/详情/作者页雏形（纯链接渲染）
- 阶段2：上传与关联
  - 支持 md、预览图上传并关联 file_id；作品发布流程联通
- 阶段3：评分系统（rating-service）
  - 评分提交/获取/聚合；前端评分 UI；聚合展示
- 阶段4：Link Preview（可开关）
  - 服务端拉取 OG 信息与缩略图缓存，SSR 防护；前端 LinkCard 富卡片
- 阶段5：优化与风控
  - 限流、日志、监控指标；基础管理后台/导出报表（可先命令行/脚本）

### 11. 验收标准（样例）
- Markdown 文件上传后在详情页安全渲染，禁用危险 HTML，无 XSS
- 外链作品点击后经 /go 记录点击并 302 跳转到源站
- Live2D 作品展示 PNG 预览，加载性能稳定
- 登录用户对作品评分成功，重复评分按规则处理（覆盖或限制）
- 作者页可列出所有作品；作品页可导航到作者
- 列表可按类型/标签/作者/评分/时间过滤排序
- 基本 SSRF/XSS/限流策略生效并有日志可审计

### 12. 风险与应对
- metadata-service 职责膨胀：接口与仓储层解耦，预留未来拆分 content-service 的迁移计划
- Link Preview SSRF 风险：如来不及实现安全抓取，阶段性改为“用户手填标题/缩略图”
- 成本压力：强制上传者提供预览图；限制文件体积与数量；无需在线渲染

### 13. 待定问题（需决策）
- 作者与用户关系模型：是否允许团队作者/多个用户维护同一作者实体
- 评分规则：是否允许覆盖评分与是否允许评价文本；匿名规则
- 标签体系：是否采用固定分类 + 用户标签混合
- 可见性：作品默认是否公开；是否支持 unlisted 与 private
- Link Preview：是否维护域名白名单/黑名单

---

## 我的部分（AI协作计划与可交付物）

我将以“最小安全变更 + 快速可用”的原则推进：

- 架构与数据
  - 完善 Author/Work/Tag/Link 模型设计与迁移脚本（SQLite 版本）
  - 为 rating-service 设计表结构（ratings、rating_aggregates）与接口草案
  - 输出 API 合约（OpenAPI 增量草案）
- 网关与服务改造
  - 网关新增路由与中间件策略（JWT、限流）
  - 在 metadata-service 中增量实现 Works/Authors/Tags 基础 CRUD
  - rating-service 骨架与聚合策略（写时更新或定时刷新）
  - Link Preview 安全抓取方案与开关（可降级为手工输入）
- 前端支持
  - 页面信息架构 IA 与状态管理方案（stores 划分与接口调用）
  - Markdown 渲染安全策略与组件选型建议（react-markdown + DOMPurify）
  - LinkCard 规范（字段、降级、交互）
  - 评分控件交互流程（幂等、防刷、UI 状态）
- 工程与运维
  - 更新 manage-services.sh 支持新服务（如 rating-service）
  - 提供迁移/回滚脚本与种子数据脚本建议
  - 日志与指标建议清单（便于后续接入 Prometheus/Grafana）
- 保障与质量
  - 验收用例清单与端到端验证流程
  - 安全基线清单（XSS/SSRF/限流/授权/字段校验）
- 文档交付
  - 本文档（需求 + 架构 + 数据 + API + 路线图 + 验收标准）
  - 后续提供增量 API 文档与迁移手册

