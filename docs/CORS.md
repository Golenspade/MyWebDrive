# CORS / 跨域配置统一说明

本项目在开发阶段同时存在 Next 开发服务器（apps/web，端口 4000）与 API 网关（Node，端口 9080）。为保证前端与后端在本地联调时顺畅，CORS 策略按以下方式统一：

## 开发环境（推荐设置）

- Node API 网关（services/api-gateway-node）默认返回宽松 CORS：
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS,HEAD`
  - `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Request-ID`
  - 这样在本地联调时，Vite（3000）或 Next（4000）都可直接访问网关，无需额外配置。

- Next（apps/web）作为 BFF/开发服：
  - 通过 `rewrites` 将 `/api/v1/*` 代理到网关。
  - 网关地址默认从 `API_BASE_URL` 读取，若未设置，默认 `http://localhost:9080`。
  - 覆盖方式：编辑 `apps/web/.env.local` 中的 `API_BASE_URL`。

## 明确指定允许来源

如需在开发或测试中限制来源，可在 `.env` 使用：

```
# 以逗号分隔多个来源
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000
```

当使用 Go 网关或服务（808x 端口）时，该变量会被读取并用于设置允许的来源；Node 版本后续也将读取相同变量以保持一致性（当前开发态默认 `*` 以降低摩擦）。

## 生产环境建议

- 不要使用 `*`；显式列出允许的前端域名，例如：
  - `CORS_ALLOWED_ORIGINS=https://drive.example.com`
- 如使用 Ingress（Kubernetes），可在 Ingress 注解中配置 CORS（仓库中 `infrastructure/kubernetes/api-gateway.yaml` 提供了示例）。
- 同步更新负载均衡/反向代理（如 Nginx）上的 CORS 相关头设置，避免出现双层或冲突的 CORS 配置。

## 端口与环境变量速查

- 网关（Node 开发默认）：`http://localhost:9080`
- Next（apps/web 开发）：`http://localhost:4000`
- 配置变量：
  - `API_BASE_URL`（Next 使用）
  - `CORS_ALLOWED_ORIGINS`（后端服务使用）

