# MyWebDrive 前端（frontend/cruip-landing）

本目录包含 MyWebDrive 的主站与文档站前端代码，基于 **Next.js 15**、**React 19** 和 **Tailwind CSS 4** 构建。

## 功能概览

- 营销着陆页（`/`）：产品介绍与下载入口
- 下载中心（`/download`）：应用与资源下载列表
- 账号体系（`/login`、`/signup` 等）：与后端 Auth / User 服务打通
- 管理后台（`/admin`）：用户与配额管理等
- 文档站（`/docs`）：基于 Nextra 的文档系统

## 技术栈

- [Next.js 15](https://nextjs.org/)（App Router）
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Nextra 3](https://nextra.site/) 用于文档
- 自托管中文字体：Noto Sans SC、站酷小薇、Ma Shan Zheng

## 本地开发

在仓库根目录执行：

```bash
pnpm -C frontend/cruip-landing dev
```

默认会在 `http://localhost:4323` 启动前端（具体端口请以脚本或环境变量为准）。

## 构建与预览

```bash
pnpm -C frontend/cruip-landing build
pnpm -C frontend/cruip-landing start
```

## 模板来源与说明

本前端的早期 UI 布局最初基于 Cruip 提供的 [Simple Light](https://github.com/cruip/tailwind-landing-page-template) Tailwind / Next.js 模板进行改造。原模板在 GPL-3.0 许可下发布，版权归 Cruip 所有。

我们在此基础上做了大量修改，以适配 MyWebDrive 的产品结构、中文文案、自托管字体以及文档系统等需求。Cruip 与本项目没有任何官方关联或背书。

本仓库整体的许可证和条款请参考仓库根目录的 `LICENSE` 文件。
