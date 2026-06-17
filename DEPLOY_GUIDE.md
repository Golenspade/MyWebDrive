# 🚀 一键部署到阿里云服务器指南

本指南将帮助你直接从本地电脑一键部署到阿里云服务器。

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## 前提条件

1. **本地环境**：
   - macOS / Linux / Windows (WSL)
   - 已安装 Git
   - 已安装 SSH 客户端
   - 已安装 rsync

2. **阿里云服务器**：
   - 已购买ECS实例
   - 已获取公网IP
   - 已开放必要端口（22, 80, 443, 9080等）

## 方法一：超级快速部署（推荐新手）

### 步骤1：配置SSH免密登录

```bash
# 给脚本执行权限
chmod +x scripts/ssh-setup.sh

# 运行SSH配置向导
./scripts/ssh-setup.sh
```

按提示输入：
- 服务器IP地址
- SSH用户名（通常是 root）
- SSH端口（默认 22）
- 服务器密码

### 步骤2：一键部署

```bash
# 给脚本执行权限
chmod +x scripts/quick-deploy.sh

# 执行快速部署（替换为你的服务器IP）
./scripts/quick-deploy.sh 123.45.67.89
```

就这么简单！脚本会自动：
- ✅ 推送代码到服务器
- ✅ 安装必要依赖
- ✅ 启动所有服务
- ✅ 执行健康检查

### 步骤3：配置环境变量（首次部署）

首次部署后，需要配置环境变量：

```bash
# SSH登录到服务器
ssh root@你的服务器IP

# 编辑环境变量
cd /opt/MyWebDrive/infrastructure/alicloud
vim .env
```

修改以下关键配置：
```bash
# 生成安全的JWT密钥
JWT_SECRET=$(openssl rand -hex 32)

# 配置MinIO（如果不使用阿里云OSS）
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key

# Security & Rate Limiting (v0.3.1+)
REDIS_URL=redis://your-redis:6379/0                    # Required for distributed rate limiting
CORS_ALLOWED_ORIGINS=https://mygoavemujica.top         # Production CORS whitelist
TRUST_PROXY=1                                           # Trust Nginx proxy hop
```

保存后重启服务：
```bash
docker-compose -f docker-compose.node.yml restart
```

## 方法二：完整部署（推荐进阶用户）

### 步骤1：配置部署参数

```bash
# 给脚本执行权限
chmod +x scripts/deploy-to-server.sh

# 运行配置向导
./scripts/deploy-to-server.sh setup
```

按提示输入所有配置信息，配置会保存到 `~/.mywebdrive-deploy.conf`

### 步骤2：执行部署

```bash
# 使用保存的配置部署
./scripts/deploy-to-server.sh

# 或者直接指定服务器IP
./scripts/deploy-to-server.sh 123.45.67.89
```

完整部署脚本会：
- ✅ 检查本地代码状态
- ✅ 测试SSH连接
- ✅ 检查服务器环境
- ✅ 自动安装Docker、Docker Compose、Node.js（如果缺失）
- ✅ 推送代码
- ✅ 配置环境变量
- ✅ 部署应用
- ✅ 验证部署结果

## 方法三：手动部署（完全控制）

如果你想完全手动控制每一步：

### 步骤1：推送代码

```bash
# 使用rsync推送代码
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'logs' \
    --exclude 'data' \
    ./ root@你的服务器IP:/opt/MyWebDrive/
```

### 步骤2：SSH登录服务器

```bash
ssh root@你的服务器IP
```

### 步骤3：在服务器上部署

```bash
cd /opt/MyWebDrive/infrastructure/alicloud

# 配置环境变量
cp env.example .env
vim .env

# 执行部署
chmod +x deploy.sh
./deploy.sh production latest
```

## 更新部署

当你修改了代码，想要更新服务器上的应用：

```bash
# 快速更新
./scripts/quick-deploy.sh 你的服务器IP

# 或使用完整部署脚本
./scripts/deploy-to-server.sh
```

## 常见问题

### 1. SSH连接失败

**问题**：无法连接到服务器

**解决方案**：
```bash
# 检查SSH配置
ssh -v root@你的服务器IP

# 确保服务器安全组开放了22端口
# 确保使用正确的用户名和密码/密钥
```

### 2. rsync命令不存在

**问题**：Mac上没有rsync

**解决方案**：
```bash
# macOS通常自带rsync，如果没有：
brew install rsync
```

### 3. 权限被拒绝

**问题**：Permission denied

**解决方案**：
```bash
# 给脚本执行权限
chmod +x scripts/*.sh

# 或者使用bash直接执行
bash scripts/quick-deploy.sh 你的服务器IP
```

### 4. 服务器环境缺失

**问题**：服务器没有Docker等环境

**解决方案**：
```bash
# 使用完整部署脚本，它会自动安装
./scripts/deploy-to-server.sh

# 或者手动安装
ssh root@你的服务器IP
curl -fsSL https://get.docker.com | sh
```

### 5. 端口无法访问

**问题**：部署成功但无法访问

**解决方案**：
```bash
# 检查阿里云安全组规则
# 确保开放了以下端口：
# - 22 (SSH)
# - 80 (HTTP)
# - 443 (HTTPS)
# - 9080 (API网关)

# 检查服务器防火墙
ssh root@你的服务器IP
ufw status
ufw allow 80
ufw allow 443
ufw allow 9080
```

## 验证部署

部署完成后，验证服务是否正常：

```bash
# 检查API网关
curl http://你的服务器IP:9080/health

# 检查各个服务
curl http://你的服务器IP:7081/health  # Auth
curl http://你的服务器IP:7082/health  # User
curl http://你的服务器IP:7083/health  # Metadata
curl http://你的服务器IP:7084/health  # Storage
curl http://你的服务器IP:7085/health  # Sharing

# Kubernetes健康检查端点 (v0.3.1+)
curl http://你的服务器IP:9080/healthz  # Liveness probe
curl http://你的服务器IP:9080/ready    # Readiness probe
```

## 查看日志

```bash
# 方式1：从本地查看
ssh root@你的服务器IP 'cd /opt/MyWebDrive/infrastructure/alicloud && docker-compose -f docker-compose.node.yml logs -f'

# 方式2：登录服务器查看
ssh root@你的服务器IP
cd /opt/MyWebDrive/infrastructure/alicloud
docker-compose -f docker-compose.node.yml logs -f [服务名]
```

## 回滚部署

如果部署出现问题，可以快速回滚：

```bash
# SSH登录服务器
ssh root@你的服务器IP

# 快速回滚到上一版本
cd /opt/MyWebDrive/infrastructure/alicloud
./rollback.sh quick

# 或回滚到指定版本
./rollback.sh version v1.0.0
```

## 自动化部署（CI/CD）

如果你想设置自动化部署，可以在GitHub Actions中使用：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Aliyun

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_IP: ${{ secrets.SERVER_IP }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ./scripts/quick-deploy.sh $SERVER_IP
```

## 下一步

- 📖 阅读 [完整部署指南](README.md#阿里云部署)
- 🔄 了解 [回滚策略](infrastructure/alicloud/rollback.sh)
- 🔒 配置 [域名和SSL证书](README.md#域名和ssl配置)
- 📊 设置 [监控和日志](README.md#日志与指标)

## 获取帮助

如果遇到问题：

1. 查看脚本帮助：`./scripts/deploy-to-server.sh --help`
2. 查看服务器日志
3. 检查GitHub Issues
4. 联系技术支持

祝部署顺利！🎉

