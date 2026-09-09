# MyWebDrive 前端（frontend/cruip-landing）

本目录包含 MyWebDrive 的主站与文档站前端代码，基于 **Next.js 15**、**React 19** 和 **Tailwind CSS 4** 构建。

## 当前边界

- 本目录是仓库权威 Web 应用，由本地 Core-first 栈中的 Nginx 同源提供。
- 公共 API 合同位于 [`../../docs/openapi.yaml`](../../docs/openapi.yaml)。
- 本地完整栈通过仓库根目录的 `./manage-services.sh setup` 然后 `./manage-services.sh start` 启动，站点 `http://127.0.0.1:8080`。
- 生产 compose / 部署脚本仍在仓库中，但不是日常开发完成条件。

## 功能概览

- 营销着陆页（`/`）：产品介绍与下载入口
- 下载中心（`/download`）：应用与资源下载列表
- 账号体系（`/signin`）：邮箱验证码登录，首次验证成功即由 Core 创建账户
- 管理后台（`/admin`）：用户、存储池预览，以及 Admin 一键「按池自动分配」（Superuser 只读预览）
- 文档站（`/docs`）：基于 Nextra 4 的文档系统

## 技术栈

- [Next.js 15](https://nextjs.org/)（App Router）
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Nextra 4](https://nextra.site/)（当前锁文件解析为 4.6.0）用于文档
- 自托管中文字体：Noto Sans SC、站酷小薇、Ma Shan Zheng

## 本地开发

完整栈请用仓库根目录 `./manage-services.sh start`（`http://127.0.0.1:8080`）。仅前端时：

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
