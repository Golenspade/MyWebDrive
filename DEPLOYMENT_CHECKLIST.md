# MyWebDrive 阿里云部署操作清单

## 📋 部署信息
- **服务器 IP**: 8.134.175.90
- **域名**: mygoavemujica.top
- **版本**: v0.2.0-search-publish-catalog
- **部署时间**: 2025-10-24

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

---

## 🚀 快速部署（推荐）

### 本地操作

#### 1. 设置环境变量
```bash
export SSH_KEY=~/path/to/your.pem  # 替换为你的 .pem 文件路径
export REMOTE_HOST=8.134.175.90
export REMOTE_USER=root  # 或 ubuntu
```

#### 2. 本地构建（重要！）
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

#### 3. 执行自动化部署
```bash
bash infrastructure/alicloud/remote-deploy.sh
```

脚本会提示你完成以下步骤：
- ✅ SSH 连接测试
- ✅ 安装 Docker 和依赖
- ✅ 克隆/更新代码
- ✅ 上传本地构建产物
- ⚠️ **需要手动配置环境变量**
- ✅ 配置 Nginx
- ✅ 申请 SSL 证书（需要输入邮箱）
- ✅ 启动 Docker Compose
- ✅ 健康检查

---

## 📝 手动部署步骤

### 步骤 1: 连接服务器

```bash
# 本地执行
export KEY=~/path/to/your.pem
chmod 400 "$KEY"
ssh -i "$KEY" root@8.134.175.90
```

### 步骤 2: 服务器初始化

```bash
# 在服务器上执行

# 更新系统
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

# 安装 Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

### 步骤 3: 克隆代码

```bash
# 在服务器上执行
git clone https://github.com/Golenspade/MyWebDrive.git ~/myWebDrive
cd ~/myWebDrive
git checkout v0.2.0-search-publish-catalog
```

### 步骤 4: 配置环境变量 ⚠️ 重要

```bash
# 在服务器上执行
cd ~/myWebDrive
cp infrastructure/alicloud/.env.production infrastructure/alicloud/.env
vim infrastructure/alicloud/.env
```

**必须修改的变量**:
```bash
# 生成安全密钥（在服务器上执行）
JWT_SECRET=$(openssl rand -hex 32)
OWNER_COOKIE_SECRET=$(openssl rand -hex 32)

# 编辑 .env 文件，设置以下变量：
JWT_SECRET=<上面生成的值>
OWNER_COOKIE_SECRET=<上面生成的值>
CORS_ALLOWED_ORIGINS=https://mygoavemujica.top
REGISTRATION_REQUIRE_INVITE=true
POSTGRES_PASSWORD=<设置一个强密码>
```

### 步骤 5: 配置 Nginx

```bash
# 在服务器上执行

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

# 如果测试通过，重载 Nginx
sudo systemctl reload nginx
```

### 步骤 6: 申请 SSL 证书

```bash
# 在服务器上执行

# 安装 certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书（替换邮箱地址）
sudo certbot --nginx -d mygoavemujica.top -d www.mygoavemujica.top \
  -m <your-email@example.com> --agree-tos -n

# 重载 Nginx
sudo systemctl reload nginx
```

### 步骤 7: 启动服务

```bash
# 在服务器上执行
cd ~/myWebDrive/infrastructure/alicloud

# 确保 .env 文件已配置
ls -la .env

# 启动所有服务
docker compose -f docker-compose.production.yml up -d

# 查看状态
docker compose -f docker-compose.production.yml ps

# 查看日志
docker compose -f docker-compose.production.yml logs -f
```

### 步骤 8: 健康检查

```bash
# 在服务器上执行
cd ~/myWebDrive
bash infrastructure/alicloud/prod-diagnose.sh

# 手动测试
curl http://127.0.0.1:9090/health
curl http://127.0.0.1:3100
curl https://mygoavemujica.top
```

---

## ✅ 验证清单

### 服务器端验证

- [ ] Docker 已安装并运行
- [ ] Docker Compose 已安装
- [ ] 代码已克隆到 `~/myWebDrive`
- [ ] 环境变量已配置（`.env` 文件存在且正确）
- [ ] Nginx 已安装并配置
- [ ] SSL 证书已申请并配置
- [ ] 所有 Docker 容器正在运行
- [ ] 健康检查全部通过

### 端口检查

```bash
# 在服务器上执行
sudo ss -ltnp | grep -E ':(80|443|3100|9090|7091|7092|7093|7094|7095|5432|6379)'
```

应该看到：
- ✅ 80 (Nginx)
- ✅ 443 (Nginx)
- ✅ 3100 (Frontend - 仅 127.0.0.1)
- ✅ 9090 (Gateway - 仅 127.0.0.1)
- ✅ 7091-7095 (Services - 仅 127.0.0.1)
- ✅ 5432 (PostgreSQL - 仅 127.0.0.1)
- ✅ 6379 (Redis - 仅 127.0.0.1)

### 功能验证

- [ ] 访问 https://mygoavemujica.top 正常
- [ ] 首页自动跳转到 `/download`
- [ ] 管理员登录正常（admin@local / admin123456）
- [ ] 文件上传功能正常
- [ ] 搜索功能正常
- [ ] 发布功能正常
- [ ] 下载目录显示正常
- [ ] 文件下载功能正常

---

## 🔧 常用命令

### 服务管理

```bash
# 在服务器上执行
cd ~/myWebDrive/infrastructure/alicloud

# 查看状态
docker compose -f docker-compose.production.yml ps

# 查看日志
docker compose -f docker-compose.production.yml logs -f

# 重启所有服务
docker compose -f docker-compose.production.yml restart

# 重启单个服务
docker compose -f docker-compose.production.yml restart api-gateway

# 停止所有服务
docker compose -f docker-compose.production.yml down

# 启动所有服务
docker compose -f docker-compose.production.yml up -d
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

### 数据库管理

```bash
# 连接数据库
docker compose -f ~/myWebDrive/infrastructure/alicloud/docker-compose.production.yml \
  exec postgres psql -U postgres

# 备份数据库
docker compose -f ~/myWebDrive/infrastructure/alicloud/docker-compose.production.yml \
  exec postgres pg_dump -U postgres postgres > ~/backup-$(date +%F).sql
```

---

## 🚨 故障排查

### 问题 1: 服务无法启动

```bash
# 查看详细日志
docker compose -f docker-compose.production.yml logs <service-name>

# 检查端口占用
sudo ss -ltnp | grep :<port>

# 检查 Docker 资源
docker system df
```

### 问题 2: Nginx 502 错误

```bash
# 检查后端服务
curl http://127.0.0.1:9090/health
curl http://127.0.0.1:3100

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/mywebdrive-error.log

# 检查 Nginx 配置
sudo nginx -t
```

### 问题 3: SSL 证书问题

```bash
# 查看证书状态
sudo certbot certificates

# 强制续期
sudo certbot renew --force-renewal

# 测试续期
sudo certbot renew --dry-run
```

### 问题 4: 数据库连接失败

```bash
# 检查 PostgreSQL 容器
docker compose -f docker-compose.production.yml ps postgres

# 查看 PostgreSQL 日志
docker compose -f docker-compose.production.yml logs postgres

# 测试连接
docker compose -f docker-compose.production.yml exec postgres pg_isready -U postgres
```

---

## 📊 监控建议

### 实时监控

```bash
# 系统资源
htop

# Docker 资源
docker stats

# 磁盘使用
df -h

# 网络连接
sudo ss -s
```

### 日志监控

```bash
# 实时查看所有日志
docker compose -f docker-compose.production.yml logs -f

# 查看错误日志
docker compose -f docker-compose.production.yml logs | grep -i error

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/mywebdrive-access.log
```

---

## 🔐 安全检查

- [ ] JWT_SECRET 已修改为随机值
- [ ] OWNER_COOKIE_SECRET 已修改为随机值
- [ ] PostgreSQL 密码已修改
- [ ] HTTPS 已启用
- [ ] CORS_ALLOWED_ORIGINS 已配置
- [ ] REGISTRATION_REQUIRE_INVITE=true
- [ ] 安全组只开放 22, 80, 443
- [ ] 管理员密码已修改（首次登录后）
- [ ] Nginx 配置正确
- [ ] 证书自动续期已配置

---

## 📚 参考文档

- **详细部署指南**: `infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md`
- **生产部署指南**: `infrastructure/alicloud/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **开发指南**: `CLAUDE.md`
- **快速开始**: `QUICK_START.md`

---

## 🎉 部署完成

部署完成后，访问 **https://mygoavemujica.top** 验证系统是否正常运行！

**默认管理员账户**:
- 邮箱: admin@local
- 密码: admin123456

⚠️ **重要**: 首次登录后立即修改管理员密码！

