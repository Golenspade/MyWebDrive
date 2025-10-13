# MyWebDrive 项目分析总览

本文档基于自动化分析，提供了对 `MyWebDrive` 项目的全面概览，内容涵盖前端应用与所有后端微服务的内部结构与资源引用关系。

---

## I. 前端应用 (`frontend/cruip-landing`)

项目的主要用户界面，一个使用 Next.js 构建的现代化、功能丰富的 Web 应用。

### A. 页面路由与结构

#### 📄 页面一：主页 (`/`)

- **文件路径**: `app/(marketing)/page.tsx`
- **用途**: 项目的营销门面和入口。

```
[页面: 主页 /]
│
├── 🌍 [全局资源: (marketing)/layout.tsx & root layout.tsx]
│   │   (假定继承了根布局的全局字体和CSS)
│   ├── 📄 CSS: /app/css/style.css
│   ├── ண்ட் Font: Noto Sans SC, ZCOOL XiaoWei, Ma Shan Zheng
│   └── 🧩 组件: <Header />, <Footer /> (由布局文件提供)
│
├── 🔼 [组件: <Hero />] (components/hero-home.tsx)
│   ├── 🎨 [背景/插图: <PageIllustration />]
│   │   ├── 🖼️ 图像: /images/stripes.svg
│   │   └── 🎨 效果: 多个通过 CSS 实现的模糊圆形背景
│   │
│   ├── 🖼️ [头像网格]
│   │   ├── 🖼️ 图像: /images/anon.png
│   │   ├── 🖼️ 图像: /images/soyo.png
│   │   ├── 🖼️ 图像: /images/tomori.png
│   │   ├── 🖼️ 图像: /images/taki.png
│   │   └── 🖼️ 图像: /images/rana.png
│   │
│   ├── 🧩 [文本动画: <SplitText />] (components/SplitText.tsx)
│   │   ├── 📜 文本: "写下属于你的二创"
│   │   ├── 📜 文本: "无需担心技术问题，mygo.studio为你提供一站式解决方案"
│   │   └── ⚙️ 库: GSAP (用于实现文字逐字动画)
│   │
│   ├── 🧩 [按钮: <ShimmerButton />] (components/ui/shimmer-button.tsx)
│   │   ├── 📜 文本: "写下你的第一笔"
│   │   └── 🔗 路由链接: /download
│   │
│   └── 🖼️ [英雄图片区域 (模拟代码编辑器)]
│       └── 📜 文本 (CSS 动画)
│
├── 🏢 [组件: <BusinessCategories />] (components/business-categories.tsx)
│   │   (这是一个纯静态内容的组件，包含一些SVG图标和文本)
│
├── 🌐 [组件: <GlobeDemo />] (components/globe-demo.tsx)
│   │   (这是一个复杂的3D地球组件)
│   └── ⚙️ 库:
│       ├── react-three/fiber (Three.js的React渲染器)
│       ├── react-three/drei (Three.js的辅助工具)
│       ├── three (核心3D库)
│       └── three-globe (用于绘制地球)
│
├── 🍱 [组件: <BentoDemo />] (components/bento-demo.tsx)
│   │   (这是一个Bento网格布局，展示多个卡片)
│   └── ⚙️ 库:
│       ├── framer-motion (用于卡片动画)
│       └── clsx, tailwind-merge (样式工具)
│
├── 📜 [组件: <MarqueeDemo />] (components/marquee-demo.tsx)
│   │   (这是一个无限滚动的Logo墙)
│   ├── 🖼️ 图像: 多个品牌Logo图片
│   └── ⚙️ 库:
│       ├── framer-motion (用于滚动动画)
│       └── clsx, tailwind-merge (样式工具)
│
└── 📞 [组件: <Cta />] (components/cta.tsx - Call to Action)
    ├── 🖼️ 图像: /images/stripes-dark.svg
    └── 🔗 链接: "必先利其器"
```

#### 🔐 页面二、三、四：认证页面

- **路径**: `app/(auth)/*`
- **用途**: 提供完整的用户认证流程。
- **共享布局**: 所有认证页面共享一个布局 (`app/(auth)/layout.tsx`)，该布局采用左右分栏设计，左侧为表单，右侧为带动画的特色插图。

```
[页面: 登录页 /signin]
│
└── LAYOUT 🧩 [布局: (auth)/layout.tsx]
    │
    ├── 🔼 [组件: <Header>]
    │   └── 🧩 子组件: <Logo />
    │
    ├── 🎨 [背景效果]
    │   ├── 🎨 CSS模糊圆形背景
    │   └── 🖼️ 图像: /images/auth-bg.svg (右侧面板的背景图案)
    │
    ├── 🖼️ [右侧插图面板]
    │   └── 📜 文本 (CSS 动画): 模拟一个npm登录和发布的命令行界面
    │
    └── CHILD 👶 [子页面内容]
        │
        ├── 📝 [标题: <h1>]
        │   └── 📜 文本: "登录到您的账户"
        │
        └── 📝 [表单: <form>]
            ├── 📥 输入框: 邮箱 (Email)
            ├── 📥 输入框: 密码 (Password)
            ├── 🔘 按钮: "登录"
            └── 🔗 路由链接: "忘记密码" -> /reset-password
```

```
[页面: 注册页 /signup]
│
└── LAYOUT 🧩 [布局: (auth)/layout.tsx]
    │   (继承登录页的所有布局、背景和插图资源)
    │
    └── CHILD 👶 [子页面内容]
        │
        ├── 📝 [标题: <h1>]
        │   └── 📜 文本: "创建您的账户"
        │
        └── 📝 [表单: <form>]
            ├── 📥 输入框: 姓名 (Name)
            ├── 📥 输入框: 邮箱 (Email)
            ├── 📥 输入框: 手机号 (Phone)
            ├── 📥 输入框: 密码 (Password)
            ├── 🔘 按钮: "注册"
            ├── 📜 分隔符: "或"
            ├── 🔘 按钮: "使用 GitHub 继续"
            └── 📜 服务条款:
                ├── 🔗 链接: "Terms of Service"
                └── 🔗 链接: "Privacy Policy"
```

```
[页面: 重置密码页 /reset-password]
│
└── LAYOUT 🧩 [布局: (auth)/layout.tsx]
    │   (继承登录页的所有布局、背景和插图资源)
    │
    └── CHILD 👶 [子页面内容]
        │
        ├── 📝 [标题: <h1>]
        │   └── 📜 文本: "Reset password"
        │
        └── 📝 [表单: <form>]
            ├── 📥 输入框: 邮箱 (Email)
            └── 🔘 按钮: "Reset Password"
```

#### 🚀 页面五：下载页 (`/download`)

- **文件路径**: `app/(default)/download/page.tsx`
- **用途**: 一个功能完善的软件分发“橱窗”页面。
- **布局**: 采用**全屏应用式布局**，不显示网站通用的页头和页脚。

```
[页面: 下载页 /download]
│
└── LAYOUT 🧩 [布局: (default)/layout.tsx]
    │   (此布局在 /download 路径下会隐藏 Header 和 Footer)
    │
    └── CHILD 👶 [组件: <AppCatalogPage />] (components/download/catalog-page.tsx)
        │
        ├── 🌐 [API 请求]
        │   └── 🔗 /api/v1/catalog (用于获取软件列表)
        │
        ├── 🔼 [组件: <HeaderBar />] (页面内自定义的页头)
        │   ├── 🔗 路由链接: "/", "/docs"
        │   ├── 🖼️ 图标: <Package2 />, <Github /> (来自 lucide-react)
        │   └── 🧩 UI组件: <Badge />, <Button />
        │
        ├── ✨ [组件: <HeroBar />] (页面内自定义的介绍区)
        │   ├── 🖼️ 图标: <ShieldCheck />, <Cpu />, <Layers3 />, <Apple />, <Monitor />, <Terminal />
        │   └── 📜 文本: "软件分发 橱窗"
        │
        ├── 🔍 [组件: <FilterBar />] (筛选工具栏)
        │   ├── 🖼️ 图标: <Search />, <Settings2 />
        │   └── 🧩 UI组件: <Input />, <Button />, <Select />
        │
        ├── 🗂️ [组件: <Tabs />] (分类标签页)
        │   └── 🧩 UI组件: <TabsList />, <TabsTrigger />
        │
        ├── 📦 [组件列表: <ProjectCard />] (软件卡片列表)
        │   │   (通过 .map() 循环渲染)
        │   ├── 🖼️ 图标: <Download />, <Copy />, <ExternalLink />
        │   └── 🧩 UI组件: <Card />, <Badge />, <DropdownMenu />, <Button />, <Tooltip />
        │
        └── ⚙️ [底层/浮层组件]
            ├── 🧩 <Separator /> (分割线)
            ├── 🧩 <Dialog /> (点击卡片详情时弹出的对话框)
            │   └── 🧩 子组件: <ProjectModal />
            ├── 🧩 <TooltipProvider /> (为所有工具提示提供上下文)
            └── 🧩 <Toast /> (复制安装命令时弹出的提示)
```

#### 📝 页面六、七：内容页面 (占位符)

- **路径**: `app/(default)/article/page.tsx` 和 `app/(default)/tutorials/page.tsx`
- **用途**: 为未来的“文章中心”和“教程中心”预留的占位页面。

```
[页面: 文章页 /article]
│
└── LAYOUT 🧩 [布局: (default)/layout.tsx]
    │
    ├── 🔼 [组件: <Header />]
    │
    ├── CHILD 👶 [子页面内容]
    │   ├── 📝 [标题: <h1>]
    │   │   └── 📜 文本: "文章中心（占位）"
    │   └── 📝 [段落: <p>]
    │       └── 📜 文本: "这里将展示文章 / 评测 / 公告 等内容的聚合列表..."
    │
    └── 🔽 [组件: <Footer />]
```

```
[页面: 教程页 /tutorials]
│
└── LAYOUT 🧩 [布局: (default)/layout.tsx]
    │
    ├── 🔼 [组件: <Header />]
    │
    ├── CHILD 👶 [子页面内容]
    │   ├── 📝 [标题: <h1>]
    │   │   └── 📜 文本: "教程中心（占位）"
    │   └── 📝 [段落: <p>]
    │       └── 📜 文本: "这里将展示教程文章与入门指南..."
    │
    └── 🔽 [组件: <Footer />]
```

#### 📚 页面八：文档页面 (`/docs`)

- **路径**: `pages/docs/*`
- **用途**: 展示项目文档。
- **技术**: 由 **Nextra** 框架驱动，将 Markdown (`.md/.mdx`) 文件自动渲染成带侧边栏、搜索等功能的专业文档页面。

### B. 中间件 (`middleware.ts`)

- **功能**: 处理中文 URL 路径，提供更友好的访问方式。

```
[中间件 /middleware.ts]
│
└── MATCHER 🚦 [匹配器]
    │   (此中间件只对特定路径生效)
    ├── /注册
    └── /登录
│
└── LOGIC 🧠 [处理逻辑]
    ├── IF (请求路径是 /注册)
    │   └── ➡️ 重定向到 /signup
    │
    ├── IF (请求路径是 /登录)
    │   └── ➡️ 重定向到 /signin
    │
    └── ELSE (其他所有请求)
        └── ✅ 继续处理，不做任何修改
```

---

## II. 后端微服务 (`services/`)

后端采用微服务架构，各个服务职责分离，通过 API 网关统一对外提供服务。

### 🔀 A. API 网关 (`api-gateway-node`)

- **核心职责**: **请求路由**、**集中认证**、**服务聚合**。
- **技术**: `Express.js` + `http-proxy-middleware`。

```
[服务: API 网关]
│
├── ⚙️ [初始化]
│   ├── 框架: Express.js
│   ├── 环境变量: 读取下游服务的地址 (AUTH, USER, METADATA 等) 和 JWT 密钥。
│   └── 端口: 9080
│
├── 🧩 [中间件]
│   ├── 日志: 记录所有HTTP请求。
│   ├── CORS: 允许跨域请求。
│   ├── 指标: 收集 Prometheus 指标。
│   └── 认证: `requireAuth` 和 `requireAdmin` 用于验证 JWT 和管理员权限。
│
├── 📍 [自有路由]
│   ├── /health: 网关自身的健康检查接口。
│   ├── /metrics: 暴露 Prometheus 指标。
│   ├── /api/v1/admin/health: (需管理员) 聚合所有下游服务的健康状态。
│   └── /api/v1/admin/overview: (需管理员) 聚合系统概览数据（目前为占位符）。
│
└── 🔀 [代理路由]
    │   (根据 URL 路径将请求转发到对应的下游微服务)
    │
    ├── /api/v1/auth/**       ->  认证服务
    ├── /api/v1/users/**      ->  用户服务
    ├── /api/v1/catalog/**    ->  元数据服务
    ├── /api/v1/files/**      ->  元数据服务
    ├── /api/v1/storage/**    ->  存储服务
    └── /api/v1/shares/**     ->  共享服务
```

### 🔑 B. 认证服务 (`auth`)

- **核心职责**: 用户身份的注册与验证，以及邀请码系统的管理。

```
[服务: 认证服务]
│
├── 💾 [数据库模型: prisma/schema.prisma]
│   ├── 👤 表: User (用户认证信息)
│   └── ✉️ 表: InvitationCode (邀请码)
│
├── ⚙️ [初始化]
│   ├── 框架: Express.js
│   ├── 数据库: Prisma Client
│   └── 端口: 7081
│
└── 📍 [API 路由]
    ├── /health: 健康检查。
    │
    ├── POST /api/v1/auth/register: 用户注册 (支持邀请码)。
    ├── POST /api/v1/auth/login: 用户登录 (返回双令牌)。
    ├── POST /api/v1/auth/refresh: 刷新 Access Token。
    ├── POST /api/v1/auth/logout: 用户登出。
    ├── POST /api/v1/auth/owner-login: 特殊的所有者登录 (通过 Cookie)。
    │
    └── ✉️ [邀请码管理 (需管理员权限)]
        ├── POST /invitations: 创建邀请码。
        ├── GET  /invitations: 列出邀请码。
        └── POST /invitations/:code/revoke: 禁用邀请码。
```

### 👤 C. 用户服务 (`user`)

- **核心职责**: 管理用户的个人资料和业务相关属性（如存储配额）。

```
[服务: 用户服务]
│
├── 💾 [数据库模型: prisma/schema.prisma]
│   └── 👤 表: User (用户业务信息)
│       └── 字段: id, name, storageQuota, storageUsed
│
├── ⚙️ [初始化]
│   ├── 框架: Express.js
│   ├── 数据库: Prisma Client
│   └── 端口: 7082
│
└── 📍 [API 路由]
    ├── /health: 健康检查。
    │
    ├── GET /api/v1/users/me: 获取当前用户信息 (若不存在则自动创建)。
    ├── PATCH /api/v1/users/me: 更新当前用户信息。
    └── GET /api/v1/users/me/storage: 获取存储空间使用情况。
```

### 📚 D. 元数据服务 (`metadata`)

- **核心职责**: **网盘核心**，管理文件和文件夹的目录树、版本、标签等信息。

```
[服务: 元数据服务]
│
├── 💾 [数据库模型: prisma/schema.prisma]
│   ├── 📄 表: File (文件/文件夹的元数据)
│   ├── 📜 表: FileVersion (文件版本历史)
│   ├── 🏷️ 表: FileTag (文件标签)
│   └── 👣 表: FileAccessLog (文件访问日志)
│
├── ⚙️ [初始化]
│   ├── 框架: Express.js
│   ├── 数据库: Prisma Client
│   └── 端口: 7083
│
└── 📍 [API 路由]
    ├── 📦 [软件目录 (公共)]
    │   └── GET /api/v1/catalog: 动态生成软件目录。
    │
    ├── 📁 [文件夹管理 (需认证)]
    │   └── 提供创建、读取、更新、删除、移动文件夹的完整API。
    │
    ├── 📄 [文件管理 (需认证)]
    │   └── 提供获取、重命名、删除、移动文件的API。
    │
    ├── 📜 [版本管理 (需认证)]
    │   ├── GET /versions: 获取文件历史版本。
    │   ├── POST /versions: 创建新版本 (由存储服务调用)。
    │   └── POST /versions/:id/restore: 从旧版本恢复。
    │
    ├── 🗂️ [批量操作 (需认证)]
    │   └── 提供批量移动和删除文件/文件夹的API。
    │
    └── 🔍 [搜索 (需认证)]
        └── GET /api/v1/search: 搜索文件和文件夹。
```

### 📦 E. 存储服务 (`storage`)

- **核心职责**: 文件的二进制数据本身的上传、下载和物理存储。

```
[服务: 存储服务]
│
├── 💾 [数据库模型: prisma/schema.prisma]
│   └── 📝 表: UploadSession (用于支持断点续传的上传会话)
│
├── ⚙️ [初始化]
│   ├── 框架: Express.js
│   ├── 存储后端: 本地文件系统 或 MinIO (S3兼容)。
│   ├── 速率限制: Redis
│   └── 端口: 7084
│
└── 📍 [API 路由]
    ├── ⬆️ [文件上传 (分块)]
    │   ├── POST   /uploads: 1. 创建上传会话。
    │   ├── PATCH  /uploads/:id: 2. 上传文件块。
    │   ├── GET/HEAD /uploads/:id: 查询上传状态。
    │   ├── POST   /uploads/:id/finalize: 3. 完成上传 (合并分块并通知元数据服务)。
    │   └── DELETE /uploads/:id: 取消上传。
    │
    ├── ⬇️ [文件下载]
    │   └── GET /files/:id/download: 公共下载接口 (带并发和带宽限制)。
    │
    └── ☁️ [其他]
        └── POST /oss/sts: 阿里云STS临时凭证签发 (占位符)。
```

### 🔗 F. 共享服务 (`sharing`)

- **核心职责**: 创建和管理文件的共享链接。

```
[服务: 共享服务]
│
├── 💾 [数据库模型: prisma/schema.prisma]
│   └── 🔗 表: Share (共享链接的配置信息)
│       └── 核心字段: token, passwordHash, expiresAt, maxDownloads
│
├── ⚙️ [初始化]
│   ├── 框架: Express.js
│   ├── 数据库: Prisma Client
│   └── 端口: 7085
│
└── 📍 [API 路由]
    ├── 🌐 [公共接口]
    │   ├── GET  /shares/:token: 获取共享信息。
    │   ├── POST /shares/:token/access: 提交密码换取临时访问令牌。
    │   └── GET  /shares/:token/download: 下载共享文件 (需临时令牌)。
    │
    └── 👤 [私有接口 (需用户认证)]
        ├── POST   /files/:id/shares: 为文件创建共享链接。
        ├── GET    /shares: 获取我创建的所有共享链接。
        ├── PATCH  /shares/:id: 更新共享设置。
        └── DELETE /shares/:id: 撤销共享链接。
```

---

## III. 开发、构建与部署

本节分析项目的工作流、自动化脚本和容器化配置。

### A. 共享代码包 (`packages/`)

#### 📦 `packages/common` (公共工具包)
- **用途**: 提供所有后端服务复用的公共工具函数。
- **结构**:
    - `ok(data)` / `err(code, message)`: 创建统一的结果对象，用于更稳健的错误处理。
    - `getEnv(key, fallback)` / `requireEnvs(keys)`: 安全地读取环境变量。

#### 🔭 `packages/observability` (可观测性包)
- **用途**: 提供统一的日志和监控解决方案。
- **结构**:
    - `createLogger(opts)`: 创建基于 `pino` 的结构化JSON日志记录器，可自动脱敏。
    - `createHttpLogger(logger)`: 创建自动记录HTTP请求的Express中间件。
    - `createMetrics(service)`: 创建基于 `prom-client` 的Prometheus监控指标。

### B. 自动化脚本

#### 📜 `Makefile` (总命令入口)
- **用途**: 提供一系列高级的、简化的命令入口，是项目自动化的顶层视图。
- **结构**:
    - `build`: 递归构建所有项目 (`packages`, `services`, `apps`)。
    - `docker-up` / `docker-down`: 使用 `docker-compose` 启动/停止容器化环境。
    - `quality-check`: 运行完整的质量检查套件（构建、测试、代码检查）。
    - `alicloud-deploy`: 触发阿里云部署脚本。

#### 🛠️ `manage-services.sh` (本地开发管理脚本)
- **用途**: 在本地开发环境中批量或独立地启停前后端服务，是本地开发的核心工具。
- **结构**:
    - `start-backend`: 一键启动所有后端微服务。
    - `start-frontend`: 启动前端开发服务器。
    - `start`: 同时启动前后端。
    - `stop` / `restart`: 停止/重启所有服务。
    - `status`: 检查所有服务的运行状态、端口和PID。
    - `env:write`: 生成包含所有服务所需环境变量的 `.env.example` 文件。

### C. 基础设施 (`infrastructure/`)

#### 🐳 `docker-compose.node.yml` (容器编排)
- **用途**: 定义项目的开发容器化环境，描述了服务如何协同工作。
- **结构**:
    - **网络**: `mywebdrive` (所有服务都在此桥接网络中，通过服务名相互通信)。
    - **数据卷**: `redis_data`, `minio_data` (用于持久化Redis和MinIO的数据)。
    - **服务 (Services)**:
        - `redis`: Redis 缓存服务，用于下载并发限制。
        - `minio`: S3兼容的对象存储服务，作为可选的文件存储后端。
        - `auth`: 认证服务容器。
        - `user`: 用户服务容器。
        - `metadata`: 元数据服务容器。
        - `storage`: 存储服务容器 (依赖 `minio`, `metadata`)。
        - `sharing`: 共享服务容器 (依赖 `storage`, `metadata`)。
        - `api-gateway-node`: API网关容器 (依赖所有其他后端服务)。
    - **开发模式**: 通过代码目录挂载 (`volumes`) 实现本地代码修改后容器内服务自动重启，极大提升了开发效率。