# MyWebDrive 生产环境部署指南

## 版本信息
- **版本**: v0.2.0-search-publish-catalog
- **部署方式**: Docker Compose
- **数据库**: PostgreSQL 14
- **缓存**: Redis 7
- **存储**: 本地文件系统 / MinIO (可选)

---

## 快速部署（推荐）

### 1. 准备环境

**系统要求**:
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+
- pnpm 8+
- 至少 4GB RAM
- 至少 20GB 磁盘空间

**安装依赖**:
```bash
# macOS
brew install docker docker-compose node pnpm

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose nodejs npm
npm install -g pnpm
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp infrastructure/alicloud/.env.production infrastructure/alicloud/.env

# 编辑环境变量（重要！）
vim infrastructure/alicloud/.env
```

**必须修改的变量**:
```bash
# 生成安全的密钥
JWT_SECRET=$(openssl rand -hex 32)
OWNER_COOKIE_SECRET=$(openssl rand -hex 32)

# 如果需要限制 CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# 如果使用域名
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
```

### 3. 一键部署

```bash
# 执行部署脚本
bash infrastructure/alicloud/deploy-production.sh
```

脚本会自动完成：
1. ✅ 检查环境依赖
2. ✅ 安装 npm 包
3. ✅ 构建所有服务
4. ✅ 构建前端
5. ✅ 初始化数据库（可选）
6. ✅ 启动 Docker Compose
7. ✅ 健康检查

### 4. 验证部署

```bash
# 检查服务状态
docker compose -f infrastructure/alicloud/docker-compose.production.yml ps

# 查看日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs -f

# 测试健康检查
curl http://localhost:9090/health
curl http://localhost:3100
```

### 5. 访问系统

- **前端**: http://localhost:3100
- **API**: http://localhost:9090
- **管理员账户**: <REDACTED_ADMIN_CREDENTIALS>

⚠️ **重要**: 首次登录后立即修改管理员密码！

---

## 手动部署步骤

如果自动脚本失败，可以手动执行以下步骤：

### 步骤 1: 构建服务

```bash
# 安装依赖
pnpm -w install

# 构建所有服务
pnpm run build:all

# 构建前端
cd frontend/cruip-landing
pnpm build
cd ../..
```

### 步骤 2: 初始化数据库（可选）

```bash
# 加载环境变量
export $(cat infrastructure/alicloud/.env | grep -v '^#' | xargs)

# 创建管理员账户
cd services/auth
pnpm db:seed
cd ../..
```

### 步骤 3: 启动服务

```bash
cd infrastructure/alicloud

# 复制环境变量
cp .env.production .env

# 启动所有服务
docker compose -f docker-compose.production.yml up -d

# 查看日志
docker compose -f docker-compose.production.yml logs -f
```

---

## 服务端口映射

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| Frontend | 3100 | 3100 | Next.js 前端 |
| API Gateway | 9090 | 9090 | API 网关 |
| Auth | 7091 | 7091 | 认证服务 |
| User | 7092 | 7092 | 用户服务 |
| Metadata | 7093 | 7093 | 元数据服务 |
| Storage | 7094 | 7094 | 存储服务 |
| Sharing | 7095 | 7095 | 分享服务 |
| PostgreSQL | 5432 | 5432 | 数据库 |
| Redis | 6379 | 6379 | 缓存 |
| MinIO | 9000 | 9000 | 对象存储 |
| MinIO Console | 9001 | 9001 | MinIO 管理界面 |

---

## 常用命令

### 服务管理

```bash
# 启动所有服务
docker compose -f infrastructure/alicloud/docker-compose.production.yml up -d

# 停止所有服务
docker compose -f infrastructure/alicloud/docker-compose.production.yml down

# 重启所有服务
docker compose -f infrastructure/alicloud/docker-compose.production.yml restart

# 重启单个服务
docker compose -f infrastructure/alicloud/docker-compose.production.yml restart api-gateway

# 查看服务状态
docker compose -f infrastructure/alicloud/docker-compose.production.yml ps
```

### 日志查看

```bash
# 查看所有日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs -f

# 查看特定服务日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs -f api-gateway

# 查看最近 100 行日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs --tail=100
```

### 数据库操作

```bash
# 连接到 PostgreSQL
docker compose -f infrastructure/alicloud/docker-compose.production.yml exec postgres psql -U postgres

# 备份数据库
docker compose -f infrastructure/alicloud/docker-compose.production.yml exec postgres pg_dump -U postgres postgres > backup.sql

# 恢复数据库
docker compose -f infrastructure/alicloud/docker-compose.production.yml exec -T postgres psql -U postgres postgres < backup.sql
```

---

## 反向代理配置（Nginx）

### 基础配置

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # 静态资源
    location /assets/ {
        proxy_pass http://localhost:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### HTTPS 配置

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... 其他配置同上 ...
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 故障排查

### 服务无法启动

```bash
# 查看服务日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs <service-name>

# 检查端口占用
lsof -i :9090
lsof -i :3100

# 检查 Docker 资源
docker system df
docker system prune  # 清理未使用的资源
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker compose -f infrastructure/alicloud/docker-compose.production.yml ps postgres

# 测试数据库连接
docker compose -f infrastructure/alicloud/docker-compose.production.yml exec postgres pg_isready -U postgres

# 查看数据库日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs postgres
```

### 前端无法访问 API

1. 检查 `API_BASE_URL` 环境变量
2. 检查 CORS 配置
3. 查看网关日志
4. 测试 API 健康检查: `curl http://localhost:9090/health`

---

## 性能优化

### 1. 数据库优化

```sql
-- 连接到数据库
docker compose exec postgres psql -U postgres

-- 查看连接数
SELECT count(*) FROM pg_stat_activity;

-- 优化查询
ANALYZE;
VACUUM;
```

### 2. Redis 优化

```bash
# 查看 Redis 内存使用
docker compose exec redis redis-cli INFO memory

# 清理过期键
docker compose exec redis redis-cli FLUSHDB
```

### 3. 日志轮转

在 `docker-compose.production.yml` 中添加日志配置：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 备份与恢复

### 数据库备份

```bash
# 创建备份目录
mkdir -p backups

# 备份数据库
docker compose -f infrastructure/alicloud/docker-compose.production.yml exec postgres \
  pg_dump -U postgres postgres > backups/db-$(date +%Y%m%d-%H%M%S).sql

# 定时备份（crontab）
0 2 * * * cd /path/to/mywebdrive && docker compose -f infrastructure/alicloud/docker-compose.production.yml exec postgres pg_dump -U postgres postgres > backups/db-$(date +\%Y\%m\%d).sql
```

### 文件备份

```bash
# 备份上传的文件
tar -czf backups/storage-$(date +%Y%m%d-%H%M%S).tar.gz storage/

# 备份 Docker volumes
docker run --rm -v mywebdrive_storage_data:/data -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/storage-volume-$(date +%Y%m%d-%H%M%S).tar.gz /data
```

---

## 更新部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建
pnpm run build:all
cd frontend/cruip-landing && pnpm build && cd ../..

# 3. 重启服务
cd infrastructure/alicloud
docker compose -f docker-compose.production.yml restart

# 4. 查看日志确认
docker compose -f docker-compose.production.yml logs -f
```

---

## 安全建议

1. ✅ 修改默认密码（JWT_SECRET, OWNER_COOKIE_SECRET, 管理员密码）
2. ✅ 启用 HTTPS
3. ✅ 配置防火墙，只开放必要端口（80, 443）
4. ✅ 定期备份数据库和文件
5. ✅ 启用 REGISTRATION_REQUIRE_INVITE=true
6. ✅ 配置 CORS_ALLOWED_ORIGINS 限制跨域
7. ✅ 定期更新依赖和系统补丁
8. ✅ 监控日志和异常

---

## 支持

如有问题，请查看：
- 项目文档: `docs/`
- 开发指南: `CLAUDE.md`
- 问题追踪: GitHub Issues

---

**部署完成后，请访问 http://localhost:3100 验证系统是否正常运行！**

