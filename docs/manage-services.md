# Manage services (local dev)

This repository ships with a helper script to simplify common tasks when developing MyWebDrive locally.

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

Quick start
- One-time: ./manage-services.sh setup
- Install deps: ./manage-services.sh install
- Build all: ./manage-services.sh build
- Run everything (backend + frontend): ./manage-services.sh start
- Stop everything: ./manage-services.sh stop
- Status: ./manage-services.sh status

Run single services
- API Gateway: ./manage-services.sh start-backend (starts all backend services)
- Or individually: ./manage-services.sh start-frontend (dev) / start-frontend-prod (build + start)
- Single service dev:
  - Auth: pnpm -C services/auth dev
  - Storage: pnpm -C services/storage dev
  - Gateway: pnpm -C services/api-gateway-node dev
  - Frontend: pnpm --dir frontend/cruip-landing dev

Environment templates
- Print recommended env: ./manage-services.sh env:print [all|auth|storage]
- Write example file: ./manage-services.sh env:write [.env.example]

Important environment variables
- Common
  - DOWNLOAD_CONCURRENCY_LIMIT (default 3)
  - DOWNLOAD_Mbps (default 300)
  - REDIS_URL (default redis://localhost:6379/0)
- Owner cookie (same secret in auth & storage)
  - OWNER_COOKIE_SECRET (please change)
  - OWNER_COOKIE_TTL_SEC (default 86400)
  - COOKIE_SECURE (true in production)
  - OWNER_CODE_HASH (bcrypt hash of your plaintext owner code)
    - Generate via: node -e "console.log(require('bcryptjs').hashSync('your-owner-code', 10))"
- Aliyun STS
  - ALIYUN_ROLE_ARN (RAM Role for STS issuance; endpoint pending implementation)
- Storage
  - STORAGE_PORT (default 7084)
  - STORAGE_PATH (default ./storage)
  - USE_MINIO, MINIO_* options if using MinIO
  - METADATA_SERVICE_URL (default http://localhost:7083)
- Auth
  - AUTH_PORT (default 7081)
  - JWT_SECRET (please change)
  - ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL

- Databases (PostgreSQL)
  - Each service uses its own `*_DATABASE_URL` (e.g., `AUTH_DATABASE_URL`, `USER_DATABASE_URL`, `METADATA_DATABASE_URL`, `STORAGE_DATABASE_URL`, `SHARING_DATABASE_URL`, `GATEWAY_DATABASE_URL`)
  - See docs/env.example for examples and connection options (schema, pool limits)

Notes
- The script uses Corepack to activate pnpm@9.7.0 to match the repo’s packageManager field.
- For production, set COOKIE_SECURE=true and use a strong OWNER_COOKIE_SECRET.
- The storage service reads REDIS_URL and download limit envs for concurrency gating and bandwidth throttling.
- STS endpoint is stubbed and will be implemented once RAM role details are confirmed.
