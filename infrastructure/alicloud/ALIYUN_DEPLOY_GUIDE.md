# MyWebDrive 阿里云部署指南

## 服务器信息
- **公网 IP**: 8.134.176.90
- **域名**: mygoavemujica.top
- **配置**: 2核 4GB 5Mbps
- **系统**: Ubuntu 22.04 64位
- **版本**: v0.2.0-search-publish-catalog

---

## 快速部署（推荐）

### 方式一：自动化脚本部署

#### 1. 本地准备

```bash
# 设置 SSH 密钥路径
export SSH_KEY=~/path/to/your.pem
export REMOTE_HOST=8.134.176.90
export REMOTE_USER=root  # 或 ubuntu

# 确保本地已构建
pnpm -w install
pnpm run build:all
cd frontend/cruip-landing && pnpm build && cd ../..

# 执行远程部署
bash infrastructure/alicloud/remote-deploy.sh
```

脚本会自动完成：
1. ✅ 测试 SSH 连接
2. ✅ 安装 Docker 和依赖
3. ✅ 克隆/更新代码
4. ✅ 上传本地构建产物
5. ✅ 配置 Nginx
6. ✅ 申请 SSL 证书
7. ✅ 启动 Docker Compose
8. ✅ 健康检查

---

### 方式二：手动部署

#### 步骤 1: 连接服务器

```bash
# 设置变量
export KEY=~/path/to/your.pem
export HOST=8.134.176.90

# 连接
chmod 400 "$KEY"
ssh -i "$KEY" root@$HOST
```

#### 步骤 2: 安装基础依赖

```bash
# 更新系统
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

# 安装 Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version
```

#### 步骤 3: 克隆代码

```bash
# 克隆仓库
git clone https://github.com/Golenspade/MyWebDrive.git ~/myWebDrive
cd ~/myWebDrive

# 切换到发布版本
git checkout v0.2.0-search-publish-catalog
```

#### 步骤 4: 配置环境变量

```bash
# 复制模板
cp infrastructure/alicloud/.env.production infrastructure/alicloud/.env

# 编辑配置
vim infrastructure/alicloud/.env
```

**必须修改的变量**:
```bash
# 生成安全密钥
JWT_SECRET=$(openssl rand -hex 32)
OWNER_COOKIE_SECRET=$(openssl rand -hex 32)

# CORS 配置
CORS_ALLOWED_ORIGINS=https://mygoavemujica.top

# 其他重要配置
REGISTRATION_REQUIRE_INVITE=true
POSTGRES_PASSWORD=your-secure-password
```

#### 步骤 5: 配置 Nginx

```bash
# 安装 Nginx
sudo apt-get install -y nginx

# 备份现有配置
sudo tar czf ~/nginx-backup-$(date +%F-%H%M).tgz /etc/nginx

# 禁用默认站点
sudo rm -f /etc/nginx/sites-enabled/default

# 安装 MyWebDrive 配置
sudo cp ~/myWebDrive/infrastructure/alicloud/nginx-mywebdrive.conf \
  /etc/nginx/sites-available/mywebdrive

sudo ln -sf /etc/nginx/sites-available/mywebdrive \
  /etc/nginx/sites-enabled/mywebdrive

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 步骤 6: 申请 SSL 证书

```bash
# 安装 certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d mygoavemujica.top \
  -m your@email.com --agree-tos -n

# 重载 Nginx
sudo systemctl reload nginx
```

#### 步骤 7: 启动服务

```bash
cd ~/myWebDrive/infrastructure/alicloud

# 启动所有服务
docker compose -f docker-compose.production.yml up -d

# 查看状态
docker compose -f docker-compose.production.yml ps

# 查看日志
docker compose -f docker-compose.production.yml logs -f
```

#### 步骤 8: 健康检查

```bash
# 运行诊断脚本
cd ~/myWebDrive
bash infrastructure/alicloud/prod-diagnose.sh

# 手动检查
curl http://127.0.0.1:9090/health
curl http://127.0.0.1:3100
curl https://mygoavemujica.top
```

---

## 端口配置

### 内部端口（仅 127.0.0.1）
- **Frontend**: 3100
- **API Gateway**: 9090
- **Auth**: 7091
- **User**: 7092
- **Metadata**: 7093
- **Storage**: 7094
- **Sharing**: 7095
- **PostgreSQL**: 5432
- **Redis**: 6379

### 外部端口（公网访问）
- **HTTP**: 80 → Nginx → 转发到内部服务
- **HTTPS**: 443 → Nginx → 转发到内部服务

### 安全组配置
建议只开放：
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)

**不要**开放 3100, 9090, 7091-7095 到公网！

---

## 常用命令

### 服务管理

```bash
cd ~/myWebDrive/infrastructure/alicloud

# 启动
docker compose -f docker-compose.production.yml up -d

# 停止
docker compose -f docker-compose.production.yml down

# 重启
docker compose -f docker-compose.production.yml restart

# 查看状态
docker compose -f docker-compose.production.yml ps

# 查看日志
docker compose -f docker-compose.production.yml logs -f

# 查看特定服务日志
docker compose -f docker-compose.production.yml logs -f api-gateway
```

### Nginx 管理

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx

# 重启 Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看日志
sudo tail -f /var/log/nginx/mywebdrive-access.log
sudo tail -f /var/log/nginx/mywebdrive-error.log
```

### 证书管理

```bash
# 查看证书
sudo certbot certificates

# 续期证书（自动）
sudo certbot renew

# 测试续期
sudo certbot renew --dry-run
```

### 数据库管理

```bash
# 连接 PostgreSQL
docker compose -f infrastructure/alicloud/docker-compose.production.yml \
  exec postgres psql -U postgres

# 备份数据库
docker compose -f infrastructure/alicloud/docker-compose.production.yml \
  exec postgres pg_dump -U postgres postgres > backup-$(date +%F).sql

# 恢复数据库
docker compose -f infrastructure/alicloud/docker-compose.production.yml \
  exec -T postgres psql -U postgres postgres < backup.sql
```

---

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs

# 检查端口占用
sudo ss -ltnp | grep -E ':(80|443|3100|9090|7091|7092|7093|7094|7095)'

# 检查 Docker 资源
docker system df
docker system prune  # 清理未使用资源
```

### Nginx 502 错误

```bash
# 检查后端服务是否运行
curl http://127.0.0.1:9090/health
curl http://127.0.0.1:3100

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/mywebdrive-error.log

# 检查 Nginx 配置
sudo nginx -t
```

### SSL 证书问题

```bash
# 查看证书状态
sudo certbot certificates

# 强制续期
sudo certbot renew --force-renewal

# 查看 Nginx SSL 配置
sudo nginx -T | grep ssl_certificate
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 容器
docker compose -f infrastructure/alicloud/docker-compose.production.yml ps postgres

# 查看 PostgreSQL 日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs postgres

# 测试连接
docker compose -f infrastructure/alicloud/docker-compose.production.yml \
  exec postgres pg_isready -U postgres
```

---

## 更新部署

```bash
# 1. 连接服务器
ssh -i ~/path/to/your.pem root@8.134.176.90

# 2. 进入项目目录
cd ~/myWebDrive

# 3. 拉取最新代码
git fetch --all --tags
git checkout <new-tag>

# 4. 重新构建（如果需要）
# 或从本地上传构建产物

# 5. 重启服务
cd infrastructure/alicloud
docker compose -f docker-compose.production.yml restart

# 6. 查看日志
docker compose -f docker-compose.production.yml logs -f
```

---

## 备份策略

### 数据库备份

```bash
# 创建备份脚本
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
cd ~/myWebDrive/infrastructure/alicloud
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U postgres postgres > $BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql
# 保留最近 7 天的备份
find $BACKUP_DIR -name "db-*.sql" -mtime +7 -delete
EOF

chmod +x ~/backup-db.sh

# 添加到 crontab（每天凌晨 2 点）
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-db.sh") | crontab -
```

### 文件备份

```bash
# 备份上传的文件
cd ~/myWebDrive
tar -czf ~/backups/storage-$(date +%Y%m%d).tar.gz storage/
```

---

## 监控建议

### 基础监控

```bash
# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看 Docker 资源
docker stats

# 查看网络连接
sudo ss -s
```

### 日志监控

```bash
# 实时查看所有日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs -f

# 查看错误日志
docker compose -f infrastructure/alicloud/docker-compose.production.yml logs | grep -i error

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/mywebdrive-access.log
```

---

## 安全建议

1. ✅ 修改所有默认密码
2. ✅ 启用 HTTPS（Let's Encrypt）
3. ✅ 配置防火墙，只开放必要端口
4. ✅ 定期更新系统和 Docker
5. ✅ 启用 REGISTRATION_REQUIRE_INVITE
6. ✅ 配置 CORS_ALLOWED_ORIGINS
7. ✅ 定期备份数据库和文件
8. ✅ 监控日志和异常
9. ✅ 使用强密码和密钥
10. ✅ 定期检查安全更新

---

## 性能优化

### Nginx 优化

```nginx
# 在 /etc/nginx/nginx.conf 中添加
worker_processes auto;
worker_connections 1024;

# 启用 gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### Docker 优化

```bash
# 清理未使用的资源
docker system prune -a

# 限制日志大小（在 docker-compose.yml 中）
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 支持

如有问题，请查看：
- 项目文档: `docs/`
- 开发指南: `CLAUDE.md`
- 部署指南: `infrastructure/alicloud/PRODUCTION_DEPLOYMENT_GUIDE.md`
- GitHub Issues: https://github.com/Golenspade/MyWebDrive/issues

---

**部署完成后，访问 https://mygoavemujica.top 验证系统是否正常运行！**

