# 前端页面与跳转触发点清单（frontend/cruip-landing）

> 说明：本清单仅覆盖 Next.js 项目 frontend/cruip-landing。明确排除 apps/web 与 frontend（Vite）两套工程；不展开 Auth 的实现细节，仅标注其路由位置。

更新时间：2025-10-01

---

## 目录
- 路由结构总览
  - App Router（app/）
  - 文档站（Pages Router + Nextra，/docs）
  - 中间件（中文路径规范化）
- 可触发跳转的元素（组件/页面）
- 已知占位链接（不产生跳转）
- 维护指引（如何更新本清单）

---

## 路由结构总览

### App Router（app/）
- / → app/page.tsx（重定向到 /admin/overview）
- /admin → 管理后台（布局：app/admin/layout.tsx）
  - /admin/overview → 系统概览（图表与统计卡）
  - /admin/users → 用户管理（搜索/分页/角色/配额）
  - /admin/notifications → 通知
  - /admin/invitations → 邀请码管理
  - /admin/publish → 发布管理
- /signin → app/(auth)/signin/page.tsx
- /signup → app/(auth)/signup/page.tsx
- /reset-password → app/(auth)/reset-password/page.tsx
- （营销与下载）
  - /download → app/(default)/download/page.tsx（目录页组件）
  - /article → app/(default)/article/page.tsx
  - /tutorials → app/(default)/tutorials/page.tsx
- /注册 → app/注册/page.tsx（经 middleware 重定向到 /signup）
- /api/hello → app/api/hello/route.ts

### 文档站（Pages Router + Nextra，统一前缀 /docs）
根：frontend/cruip-landing/pages/docs/
- 顶层
  - /docs/index.mdx
  - /docs/getting-started.mdx
  - /docs/faq.mdx
- /docs/guide
  - index.mdx
  - webgal.mdx
  - live2d-watcher.mdx
  - anogo.mdx
  - bandori-craft.mdx
  - dongshan-tools.mdx
  - low-cost-cinematic-pipeline.mdx（新增）
- /docs/api
  - index.mdx
  - authentication.mdx
  - examples.mdx
  - reference.mdx
- /docs/best-practices
  - index.mdx
  - performance.mdx
  - quality.mdx
  - workflow.mdx
- /docs/resources
  - index.mdx
  - assets.mdx
  - download.mdx
  - modding.mdx
  - version-control.mdx
- /docs/txt2mp4
  - index.mdx

### 中间件（中文路径规范化）
- 文件：frontend/cruip-landing/middleware.ts
- 规则：
  - /注册 → 302 → /signup（第 7–10 行）
  - /登录 → 302 → /signin（第 11–14 行）

---

## 可触发跳转的元素（组件/页面）

### 站点头部 Header（全局）
文件：frontend/cruip-landing/components/ui/header.tsx
- Logo → "/"（第 12–13 行，由 Logo 组件内部 <Link href="/">）
- “下载” → "/download"（第 18 行）
- “登录” → "/login"（第 25 行）
- “注册” → "/register"（第 33 行）

Logo 组件：frontend/cruip-landing/components/ui/logo.tsx
- <Link href="/">（第 5 行）

### 首页 Hero（营销页）
文件：frontend/cruip-landing/components/hero-home.tsx
- 主 CTA 按钮（ShimmerButton）→ 程序化跳转 "/download"（第 94–100 行，onClick window.location.assign('/download')）
- “了解更多” → href="#0"（第 105–110 行）

### 页脚 Footer（全局）
文件：frontend/cruip-landing/components/ui/footer.tsx
- “软件” → "/download"（第 27–33 行）
- “教程” → "/docs"（第 35–41 行）
- “模型” → "/download?category=modelAsset"（第 43–49 行）
- “评价” → "/article"（第 51–57 行）
- 若干“关于我们 / 社媒”项为占位（href="#0"）

### 下载目录页顶部（Download Catalog 顶部导航）
文件：frontend/cruip-landing/components/download/catalog-page.tsx
- “首页” → "/"（第 124–126 行）
- “文档” → "/docs"（第 126–127 行）
- “GitHub” → "#"（第 127–128 行，外链占位）

### 文档页（MDX 内部链接示例）
文件：frontend/cruip-landing/pages/docs/getting-started.mdx
- /docs/guide、/docs/resources、/docs/api（第 69–86 行）
- /download（第 101–103 行）

文件：frontend/cruip-landing/pages/docs/resources/download.mdx
- “下载中心” → "/download"（第 290–291 行）

### 客户端重定向组件（外链/仓库跳转）
文件：frontend/cruip-landing/components/utils/client-redirect.tsx
- 挂载时 window.location.replace(to)（第 6–9 行）
- 备用链接 <a href={to}> 这里（第 16–19 行）

---

## 已知占位链接（不产生实际跳转）
- Hero “了解更多” 按钮：frontend/cruip-landing/components/hero-home.tsx（第 105–110 行，href="#0"）
- CTA 区域按钮：frontend/cruip-landing/components/cta.tsx（第 37–47 行，href="#0"）
- Footer 多个链接：frontend/cruip-landing/components/ui/footer.tsx（第 67–106、145–177、… 多处 href="#0"）
- Catalog 顶部 “GitHub”：frontend/cruip-landing/components/download/catalog-page.tsx（第 127–128 行，href="#"）

> 建议：将占位链接替换为真实路由或移除点击态，避免“可点击但无跳转”的体验落差。

---

## 维护指引（如何更新本清单）

1) 新增/变更路由时，更新对应分区：
- App Router：在“路由结构总览 / App Router”追加 path → 文件路径
- 文档站：在“文档站”分区追加 MDX 文件对应的 /docs 路径

2) 新增/修改跳转入口时，记录：
- 组件文件路径 + 元素类型（Link/a/按钮） + 目标地址 + 行号范围

3) 快速检索建议（仅供本地开发者使用）：
- 查找内部链接：
  - next/link：`grep -R "from 'next/link'" frontend/cruip-landing -n`
  - 内部 a 链接（以 / 开头）：`grep -R "<a[^>]*href=\"/" frontend/cruip-landing -n`
  - 程序化跳转：`grep -R "router.push\|window.location.assign\|window.location.replace" frontend/cruip-landing -n`

4) 提交前自检：
- 点击 Header / Footer / Hero / Catalog 的主要入口
- /docs 首页与各子分区首页
- 中间件别名是否仍正确（/注册、/登录）

---

如需将本清单挂到文档站侧边栏，可在 pages/docs/_meta.js 中添加外链或在 docs/resources 下新增 “站点地图” 页面引用本文件。
