# MyWebDrive 前端（frontend/cruip-landing）

本目录包含 MyWebDrive 的主站与文档站前端代码，基于 **Next.js 15**、**React 19** 和 **Tailwind CSS 4** 构建。

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

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

## 许可证

本前端代码由 MyGO Studio 原创开发，采用 MIT 许可证发布。

详见仓库根目录的 `LICENSE` 文件。
