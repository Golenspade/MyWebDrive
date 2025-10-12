# 部署日志：第一次成功部署（静态导出 + Nginx）

日期：2025-10-12
环境：Ubuntu / Nginx / Node + pnpm
前端：Next.js 15（App Router + Nextra）静态导出模式（output: 'export'）
后端：本机 127.0.0.1:9080（API 网关），Nginx 反代 /api

---

## 1. 主要问题与解决方案

1) TypeScript/React 类型冲突（layout.tsx children 类型身份不一致）
- 现象：@types/react 版本不一致导致的类型身份不一致
- 处理：download 路由 layout 已采用明确 `children: ReactNode` 的写法，无需再改

2) 构建失败（ESLint 插件缺失 / TS 报错）
- 现象：`@typescript-eslint/eslint-plugin` 缺失导致 ESLint 加载失败；此外组件类型错误阻塞构建
- 处理：
  - 在 next.config.js 配置 `eslint.ignoreDuringBuilds = true`（避免被未装齐的 ESLint 插件卡住）。
  - 修复 TS 报错：
    - 组件 TooltipTrigger 不支持 `asChild`，移除该用法
    - dropdown-menu 的 cloneElement 增加 `any` 断言，保留 onClick，避免属性收窄报错
    - catalog-page 中 `p.description` 可能为 undefined，使用可选链与空串回退
    - download/page.tsx 引入 `Suspense` 包裹，满足 Next 15 要求（useSearchParams 需在 suspense 边界内）
    - 为示例 API 路由 `app/api/hello` 加 `export const dynamic = "force-static"` 以兼容静态导出

3) 静态导出（next export 被废弃）
- 现象：Next 15 提示 `next export` 已被移除
- 处理：使用 `output: 'export'`，在 `next build` 过程中自动产出静态资源；并设置 `images.unoptimized = true`

4) Nginx 配置与 403 /docs/
- 现象：/docs/ 返回 403，原因是静态导出产物下 docs 首页为 `/docs.html`（非目录 index.html）
- 处理：
  - Nginx 增加精确匹配 `location = /docs/ { try_files /docs.html =404; }`
  - 通用 `location /` 使用：`try_files $uri $uri/ $uri.html /index.html;`

5) 公网不可达（外部 502 / 无输出）
- 现象：本地访问出现无输出/疑似前向代理 502；服务器回环 200，Nginx access.log 无公网请求
- 根因：云安全组未放行 TCP 80
- 处理：放行 80（必要时一并放行 443），问题解决

6) 部署切换
- 现象：`mv -Tf` 失败（目标目录非空）
- 处理：改为远端 `rsync -a --delete` 同步到线上目录，然后 `nginx -t && systemctl reload nginx`

---

## 2. 关键命令记录

- 构建与导出（在 frontend/cruip-landing/）：
  - `API_BASE_URL="/api" pnpm exec next build`
  - 产出目录：`frontend/cruip-landing/out/`（约 33MB）

- 上线（服务器 8.134.175.90）：
  1) 远端准备临时目录：
     - `mkdir -p /var/www/mywebdrive_tmp && rm -rf /var/www/mywebdrive_tmp/*`
  2) rsync 上传：
     - `rsync -avz --delete frontend/cruip-landing/out/ /var/www/mywebdrive_tmp/`
  3) 切换与 reload（因目标非空，采用就地 rsync）：
     - `rsync -a --delete /var/www/mywebdrive_tmp/ /var/www/mywebdrive/ && nginx -t && systemctl reload nginx`

- Nginx 固化配置（/etc/nginx/conf.d/mywebdrive.conf）：
```
server {
    listen 80 default_server;
    server_name _;
    root /var/www/mywebdrive;
    index index.html;

    # docs 入口静态页为 /docs.html
    location = /docs/ { try_files /docs.html =404; }

    # SPA 路由与静态 .html 优先
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # 后端 API 反代（本机 9080）
    location /api/ {
        proxy_pass http://127.0.0.1:9080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- 安全组：放行 80/TCP 入站（0.0.0.0/0），如需 HTTPS 同时放行 443

---

## 3. 文件变更清单（工作区）

- frontend/cruip-landing/next.config.js
  - 新增：`eslint: { ignoreDuringBuilds: true }`
  - 新增：`output: 'export'`
  - 新增：`images: { unoptimized: true }`

- frontend/cruip-landing/app/(default)/download/page.tsx
  - 引入 `Suspense` 包裹页面组件

- frontend/cruip-landing/app/(default)/download/CatalogPage.tsx
  - 新增 `FooterBar` 组件（页面内使用）
  - `<TooltipTrigger>` 去除 `asChild`

- frontend/cruip-landing/components/download/catalog-page.tsx
  - `p.description` 增加可选链处理
  - `<TooltipTrigger>` 去除 `asChild`

- frontend/cruip-landing/components/ui/dropdown-menu.tsx
  - `cloneElement(children as any, { onClick: ... } as any)`，避免类型收窄错误，保留 onClick 链

- frontend/cruip-landing/app/api/hello/route.ts
  - `export const dynamic = "force-static";` 以通过静态导出校验

- 备注：未改动 tooltip.tsx（仅确认其 API），package.json/pnpm-lock.yaml 出现变更（保持一致性一并提交）

---

## 4. 验收与结果

- 回环（服务器本机）：
  - `curl http://127.0.0.1/` → 200 OK（Server: nginx）
  - `curl http://127.0.0.1/api/health` → {"status":"healthy"}
- 公网：
  - 首页：http://8.134.175.90/ → 正常
  - 下载页：http://8.134.175.90/download → 正常
  - 文档：http://8.134.175.90/docs/ → 正常

---

## 5. 后续建议
- 若需严格“原子切换”，可采用 `releases/<tag>` 目录 + 符号链接方式发布
- 如需 HTTPS，后续可申请并配置 Let’s Encrypt 证书（自动续期）
- 可将本日志与 Nginx 模板固化为部署脚本，便于复用

