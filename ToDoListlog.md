## 更新日志（计划 - 2025-10-19）
## 更新日志（2025-10-22）
- 前端构建修复（Next.js 15）：
  - signup 页面：使用 Suspense 包裹 useSearchParams，避免 CSR bailout 报错；改为 useEffect 读取查询参数并做空值保护。
  - 修正示例页 admin/dashboard-example 的外部依赖，避免构建期找不到 '@/registry/*' 与 demo 组件。
  - date-range-picker 组件：避免与 HTMLDivElement 的 onChange 冲突，收窄 Props 定义。
  - notifications 详情抽屉：Accordion 改为以 children 传入内容，并补充 id 属性。
  - publish/storage 页：移除 SelectTrigger 不支持的 id 属性；去除 Toast 的 variant 字段以匹配轻量实现。
  - upload 面板：统一 Button disabled 的布尔表达式，避免 boolean | null 类型错误。
  - API 客户端：新增 ApiClient.put 方法，满足发布接口调用。
- 构建验证：`pnpm -C frontend/cruip-landing build` 成功，所有路由生成正常。
- 后端验证：
  - 通过 docker 启动 Postgres（mywd-pg），按 .env 中 schema 分库执行 prisma db push 成功。
  - 启动所有服务并通过 /health 检查。
  - 端到端验证：管理员创建邀请码 → 新用户使用邀请码注册 → 登录 → 上传文件 → 创建公开分享 → 游客下载，全部通过。


- 面板细化（优先顺序）
  - 管理后台 /admin/users：
    - 搜索输入防抖（≈300ms），避免频繁请求
    - query/page/pageSize 与 URL 同步（可分享链接、刷新不丢状态）
    - 列表中补充用量/配额徽标（GET /api/v1/users/:id/storage），支持点击开配额对话框
    - 预留批量操作入口（批量角色变更 / 批量设定配额）
  - 用户面板 /account：
    - 文件列表操作：删除 / 重命名；操作后 Toast 成功/失败提示
    - 上传完成后自动刷新用量；错误重试与失败提示
    - 版本历史：回滚成功提示、刷新列表与版本视图
- 路由与鉴权
  - 受保护页面的 Loading/未授权 统一文案与状态组件（避免空白页“转圈”体验差）
  - 修复受保护路由重定向回环：在 /signin 与 /signup 时不再重定向，避免“无限转圈”；文件：frontend/cruip-landing/lib/hooks/use-protected.ts（加入 usePathname 判断）

- 运维建议（本地开发）
  - macOS 文件句柄：临时 ulimit -n 10000；持久化 sudo launchctl limit maxfiles 65536 200000


## 更新日志（2025-10-08-2255）
- 邀请码：前端注册接口支持 `invitationCode`，修正 `test_invitation_system.sh` 校验逻辑，确保端到端验证可复用。
- 配置：`docs/env.example` 与 `services/auth/.env.example` 补充邀码相关环境变量注释，README 指引生产启用步骤。
- UI：下载页 Logo 组件优先加载 PNG，失败回退 SVG。

## 更新日志（2025-09-30-2145）
- CI：更新 pnpm-lock.yaml，修复 ERR_PNPM_OUTDATED_LOCKFILE，Actions 通过（node-build-test）。
- Landing：Logo 组件默认使用 SVG，失败回退 PNG，消除 logo-07/08 404。
- Tag：2025-09-30-2145。


## 更新日志（2025-09-30）
- 文档系统：回退到 Nextra v3（Pages Router），目录迁移至 `frontend/cruip-landing/pages/docs/`。
- 配置调整：更新 `next.config.js`（withNextra v3）、`theme.config.jsx`，新增 `pages/_app.tsx`。
- 清理：删除 v4 遗留 `app/docs/*` 与 `mdx-components.ts`。
- 验证：/docs、/docs/txt2mp4 在本地开发环境返回 200 OK。
- 备注：打 annotated tag，名称使用日期格式，注释内（括号）写明本次变更摘要。


## 更新日志（2025-09-28）
- 下载目录数据核实：`/api/v1/catalog` 返回的 `webgal` / `l2dw` 两条为真实条目，但对应物理文件需位于仓库根 `assetsReal/` 才能通过 `/assets/...` 直链下载。
- 路由与映射：Node 网关将 `assetsReal/` 映射为 `/assets`（开发期）。前端 `next.config` 已把 `/assets/*` 代理到网关。
- 现状：本地 `assetsReal/` 仅有 `fonts/`，未见两包文件；需将以下文件拷回：
  - `assetsReal/WebGAL_Terre_MyGO3.0.0.zip`
  - `assetsReal/l2dw-1.4.21f1修复专注预览界面不换行不适配问题.7z`（URL 显示为已编码）
- 快速验证：在 `assetsReal/` 建 `test.txt` 后访问 `http://localhost:9080/assets/test.txt`，若可见则映射正常。
- 风险与建议：
  - 避免在此仓库执行 `git clean -fdx` 之类清理（会清掉 `.gitignore` 忽略目录中的大文件）。
  - 建议将真实分发包放在仓库外部持久目录，并用目录符号链接至 `assetsReal/`；或给网关增加 `ASSETS_DIR` 环境变量以指向外部目录。


## 更新日志（2025-09-27）
- 下载中心 方案 A 已落地：后端 Catalog API（/api/v1/catalog）、灰度开关（catalog:public=true）、网关直链 /assets。
- 新增导入与扫描脚本：services/metadata/src/scripts/catalog-import.ts、catalog-scan.ts，支持 assetsReal → 数据库自动建档与贴标签。
- 前端下载页已接入后端目录，优先使用 /api/v1/catalog，若无数据回退示例数据。
- 为未来阿里云 OSS 预留：将标签 catalog:url 指向 OSS/CDN 直链即可无缝切换。


我来帮你整理和优化这些需求，按照逻辑分类并排序：

## **一、品牌识别系统**

### 1. **Logo 体系**
- **1.1** 设计并更换网站主 Logo
- **1.2** 更新网站 favicon.ico
- **1.3** 整理合作伙伴 Logo 展示矩阵：
    - 核心引擎：WebGAL Logo、东山引擎 Logo、MyGO 专版引擎 Logo
    - 工具生态：Live2D Watcher Logo、AnoGO Logo
    - 社区平台：BestDori Logo、Bilibili Logo、Lofter Logo、小红书 Logo、NGA Logo
    - 建议：贴吧 Logo 可选择"百度贴吧"或特定的"MyGO吧"/"邦邦吧"

## **二、首页视觉优化**

### 2. **头部区域**
- **2.1** 调整 Landing Page 五张头图至最佳尺寸和布局
- **2.2** 设计中文主标题和副标题（字体：思源宋体）
    - 建议主标题：「一站式视觉小说创作平台」
    - 建议副标题：「从创意到发布，让故事触达每一位读者」
- **2.3** 导航按钮中文化：
    - 主按钮：「写下故事」
    - 次按钮：「了解更多」

### 3. **内容展示区**
- **3.1** Global Part 中文化，突出平台优势：
    - 一站式工具链
    - 跨平台分发
    - 社区资源共享
    - 完整技术支持
- **3.2** 格言部分翻译为中文（保持文化韵味）
- **3.3** "Create your next project" 板块改为中文，链接到文档中心

## **三、功能服务体系**

### 4. **下载中心**（优先级高）
- **4.1** WebGAL 引擎下载专区
    - 标准版
    - MyGO 专版
    - 东山定制版
- **4.2** 配套工具下载
    - Live2D Watcher
    - AnoGO
    - Bandori Craft
    - 东山工具集
- **4.3** 资源库系统
    - 改模资源预览
    - 分类下载管理
    - 版本控制

### 5. **文档中心**（优先级高）
- **5.1** 快速入门指南
- **5.2** 完整 API 文档
- **5.3** 视频教程系列
- **5.4** 最佳实践案例
- **5.5** 常见问题解答

## **四、实施优先级建议**

### **第一阶段**（立即执行）
1. 更换主 Logo 和 favicon
2. 首页中文化（标题、按钮、内容）
3. 调整头图布局

### **第二阶段**（一周内）
4. 搭建下载中心框架
5. 整理现有文档
6. 合作伙伴 Logo 展示区

### **第三阶段**（两周内）
7. 完善资源预览系统
8. 补充教程内容
9. 优化用户体验流程

## **五、文案优化建议**

### **主页文案框架**
```
主标题：一站式视觉小说创作平台
副标题：从创意到发布，让故事触达每一位读者

核心价值：
• 完整工具链 - 从脚本到发布的全流程支持
• 资源共享 - 海量素材与改模资源
• 社区驱动 - 活跃的创作者生态
• 跨平台 - 一次创作，多端发布

行动召唤：
[写下故事] → 进入创作工具
[了解更多] → 查看完整文档
```

### **Logo 展示说明文案**
```
"携手顶尖引擎与社区平台
 为创作者提供最完善的生态支持"
```
