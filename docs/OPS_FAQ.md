# 运维 FAQ（Node 版）

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## 日志（pino）
- 格式：JSON，字段包含 `time`、`level`、`msg`、`service`、`instance`、`req.id` 等。
- 级别：通过 `LOG_LEVEL` 控制（默认 `info`）。建议生产 `info`/`warn`，排障临时切到 `debug`。
- 关联 ID：所有请求自动注入/透传 `x-request-id`，可跨服务搜索同一请求链路。
- 示例：
  ```bash
  # 指定请求 ID 调用并查看日志
  curl -H 'x-request-id: demo-123' http://localhost:7083/health
  rg '"req":\{"id":"demo-123"' logs/
  ```

## 指标（Prometheus）
- 每个服务暴露 `/metrics`，默认指标 + HTTP 请求计数与耗时直方图：
  - `http_requests_total{method,route,status,service,instance}`
  - `http_request_duration_ms{method,route,status,service,instance}`
- 快速验证：
  ```bash
  curl -s http://localhost:7081/metrics | head
  ```
- Prometheus 抓取（示例）：
  ```yaml
  scrape_configs:
    - job_name: 'mywebdrive'
      static_configs:
        - targets:
            - 'localhost:9080'  # gateway-node
            - 'localhost:7081'  # auth
            - 'localhost:7082'  # user
            - 'localhost:7083'  # metadata
            - 'localhost:7084'  # storage
            - 'localhost:7085'  # sharing
  ```

## 环境变量速查
- 核心：`JWT_SECRET`、`LOG_LEVEL`、`INSTANCE_ID`（可选）。
- 端口：`GATEWAY_PORT`、`AUTH_PORT`、`USER_PORT`、`METADATA_PORT`、`STORAGE_PORT`、`SHARING_PORT`。
- 服务 URL（供网关转发）：`AUTH_SERVICE_URL`、`USER_SERVICE_URL`、`METADATA_SERVICE_URL`、`STORAGE_SERVICE_URL`、`SHARING_SERVICE_URL`。
- 存储：`STORAGE_PATH`，或 MinIO：`USE_MINIO`、`MINIO_*`。
- 大文件 MD5：`MD5_IN_WORKER`（true 在 worker 计算 MD5，降低主线程压力）
- 示例模板见仓库根目录 `.env.example`。

## 常见问题
- 网关可达但下游 502：
  - 检查对应服务是否已启动；`manage-services.sh status`
  - 访问下游 `/health`；确认 JWT 与端口配置正确
- 指标无数据：
  - 确认抓取目标端口；手动 `curl :/metrics`
  - 确认请求命中服务（直方图与计数器为请求后增长）
- 端到端回归（Next 4000 + Gateway 9080）：
  - 使用 `./manage-services.sh start-gateway-node` 与 `./manage-services.sh start-next`
  - 运行脚本时设置 `GATEWAY_PORT=9080`
- 日志过多/过少：
  - 调整 `LOG_LEVEL`（`debug`/`info`/`warn`/`error`）
- 请求链路难以排查：
  - 在入口（前端/网关）设置 `x-request-id` 并贯穿；以该值在所有服务日志中检索

## 安全功能 FAQ

**Q: How do I enable distributed rate limiting?**
A: Set `REDIS_URL=redis://your-redis:6379/0` in the environment. Without Redis, rate limiting uses in-memory storage (single instance only).

**Q: How do I configure CORS for production?**
A: Set `CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com` (comma-separated list).

**Q: What are the rate limits?**
A: Global: 200 req/min per IP. Auth endpoints: 10 req/min. Share creation: 20 req/min per user.

**Q: How does graceful shutdown work?**
A: Gateway uses @godaddy/terminus. On SIGTERM, it stops accepting connections, waits up to 30s for in-flight requests, then shuts down.

## 关联文档
- `docs/_archive/MIGRATION_TO_NODE.md`：迁移计划与端口对照（已归档）
- `README.md`：启动与结构说明
- `docs/openapi.yaml`：API 合约
