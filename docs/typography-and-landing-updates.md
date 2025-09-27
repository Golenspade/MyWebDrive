## 概览
本次在两个前端（apps/web 与 frontend/cruip-landing）完成了中文字体与着陆页（landing）相关的界面调整，目标：
- 全面替换 Inter，采用本地自托管字体方案，确保在无外网环境也能正常构建/运行。
- 统一正文字体，限制“标题字体”的使用范围，提升中文排版一致性与可读性。
- 对 landing 的部分区块文案与版式进行调整（全球板块标题、副标题、移除徽章卡片）。

---

## 字体方案（自托管）
- 平面大字 / 主标题：ZCOOL XiaoWei（站酷小薇）
- 正文：Noto Sans SC（思源黑体简体）
- 签名/手写：Ma Shan Zheng（马善政毛笔体）
- 代码：Sarasa Gothic SC（更纱黑体简体，暂使用系统等宽回退）

实现方式：统一使用 next/font/local，本地 .woff2 文件存放在各应用的 public/fonts/ 下。

### 文件放置
- apps/web/public/fonts/
- frontend/cruip-landing/public/fonts/

已接入的文件：
- noto-sans-sc-v39-chinese-simplified_latin-regular.woff2 (400)
- noto-sans-sc-v39-chinese-simplified_latin-700.woff2 (700)
- zcool-xiaowei-v15-chinese-simplified_latin-regular.woff2
- ma-shan-zheng-v14-latin-regular.woff2

说明：Sarasa Gothic SC 当前仓库中为 .ttc，未接入为本地字体；代码区先使用系统等宽回退。若提供 .woff2/.woff/.otf，可直接补充接入。

---

## 关键改动

### 1) 字体引入（两个前端均已替换）
- apps/web/app/layout.tsx
- frontend/cruip-landing/app/layout.tsx

用 next/font/local 引入上述字体，并将 CSS 变量暴露：
- --font-sans：正文（Noto Sans SC）
- --font-heading：标题（ZCOOL XiaoWei）
- --font-handwrite：手写（Ma Shan Zheng）
- --font-mono：等宽（Sarasa Gothic SC；暂系统回退）

body 默认 className 含 font-sans，确保全站正文默认使用思源黑体。

### 2) 全局样式策略（landing）
文件：frontend/cruip-landing/app/css/style.css
- 仅 h1 与显式 .heading 使用“标题字体”；其余文字统一为正文字体：
  h1, .heading { font-family: var(--font-heading); }
  body { font-family: var(--font-sans); }
  code/kbd/pre 等使用 --font-mono。

### 3) 组件级统一
- Bento 卡片标题统一为正文字体：frontend/cruip-landing/components/ui/bento-grid.tsx（h3 添加 font-sans）。

### 4) 文案与区块调整（landing）
- 全球板块标题与副标题：frontend/cruip-landing/components/globe-demo.tsx
  - 主标题改为：“随时 随地”
  - 副标题改为：“全平台工具链解决方案”
- 移除徽章卡片区块（Next.js/React/Tailwind/...）：frontend/cruip-landing/app/(marketing)/page.tsx 中去掉 LogosStrip 的引入与渲染。

---

## 使用方法
- 标题（需要“站酷小薇”效果）：给元素加 .heading 或直接使用 h1。
- 正文：默认就是 Noto Sans SC。若组件内显式指定了字体，需要去掉或改为 font-sans。
- 手写签名：给元素加 .font-handwrite 或 .signature。
- 代码/等宽：给元素加 .font-mono（在未接入 Sarasa woff2 前，会回退到系统等宽）。

---

## 运行与构建
- 使用 next/font/local，不会访问外网；在无外网环境的构建机也能正常构建。
- 开发：
  - apps/web: npm run dev（端口 4000）
  - frontend/cruip-landing: npm run dev（端口 4323）

---

## 后续可选项
- 提供 Sarasa Gothic SC 的 .woff2/.woff/.otf，以彻底替换代码区系统回退。
- 如需将某些 h2/h3 等局部页面标题强制使用“标题字体”，可为该元素添加 .heading 类。
- 若希望共享字体文件、减少重复，可改为通过统一的内网 CDN/网关分发（仍为自托管）。

---

## 回退指引
- 恢复 LogosStrip：在 frontend/cruip-landing/app/(marketing)/page.tsx 重新引入并渲染 <LogosStrip />。
- 恢复统一标题策略：将 style.css 中 h1, .heading 的规则改回 h1, h2, h3, .heading（如有需要）。
- 字体回退：在 layout.tsx 中移除本地字体变量引用，或替换为其他字体方案。

