# CORS / 跨域配置统一说明

本项目在开发阶段使用 `frontend/cruip-landing`（Next.js，端口 3100）与 API 网关（Node，端口 9080）。为保证前端与后端在本地联调时顺畅，CORS 策略按以下方式统一：

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## 开发环境（推荐设置）

- Node API 网关（services/api-gateway-node，v0.3.1+）使用 `cors` npm 包统一处理跨域：
  - 若未设置 `CORS_ALLOWED_ORIGINS` 环境变量，默认允许所有来源（开发模式）
  - 这样在本地联调时，Next（3100）可直接访问网关，无需额外配置。

- 前端（frontend/cruip-landing）：
  - 通过 `API_BASE_URL` 访问网关（默认 `http://localhost:9080`）。
  - 可在 `frontend/cruip-landing/.env.local` 或启动命令中覆盖。

## 明确指定允许来源

在 `.env` 中使用 `CORS_ALLOWED_ORIGINS` 环境变量控制白名单（逗号分隔）：

```
# 以逗号分隔多个来源
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3100,http://localhost:3100
```

Node 网关（v0.3.1+）与 Go 网关均读取该变量。若未设置，Node 网关默认允许所有来源（开发模式）。

## 生产环境建议

- **必须**设置 `CORS_ALLOWED_ORIGINS`，显式列出允许的前端域名，例如：
  - `CORS_ALLOWED_ORIGINS=https://drive.example.com,https://mygoavemujica.top`
- 如使用 Ingress（Kubernetes），可在 Ingress 注解中配置 CORS（仓库中 `infrastructure/kubernetes/api-gateway.yaml` 提供了示例）。
- 同步更新负载均衡/反向代理（如 Nginx）上的 CORS 相关头设置，避免出现双层或冲突的 CORS 配置。

## 端口与环境变量速查

- 网关（Node 开发默认）：`http://localhost:9080`
- Next（frontend/cruip-landing 开发）：`http://127.0.0.1:3100`
- 配置变量：
  - `API_BASE_URL`（Next 使用）
  - `CORS_ALLOWED_ORIGINS`（后端服务使用）
