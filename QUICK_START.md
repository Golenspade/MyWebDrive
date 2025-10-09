# ⚡ 快速开始 - 3分钟部署到阿里云

## 🎯 超快速部署（3个命令）

```bash
# 1️⃣ 配置SSH（只需一次）
chmod +x scripts/ssh-setup.sh && ./scripts/ssh-setup.sh

# 2️⃣ 一键部署
chmod +x scripts/quick-deploy.sh && ./scripts/quick-deploy.sh 你的服务器IP

# 3️⃣ 配置环境变量（首次部署）
ssh root@你的服务器IP
cd /opt/MyWebDrive/infrastructure/alicloud
vim .env  # 修改JWT_SECRET等配置
docker-compose -f docker-compose.node.yml restart
```

## ✅ 完成！

访问你的应用：
- **API网关**: http://你的服务器IP:9080
- **前端应用**: http://你的服务器IP

## 📋 常用命令

### 更新部署
```bash
./scripts/quick-deploy.sh 你的服务器IP
```

### 查看日志
```bash
ssh root@你的服务器IP 'cd /opt/MyWebDrive/infrastructure/alicloud && docker-compose -f docker-compose.node.yml logs -f'
```

### 重启服务
```bash
ssh root@你的服务器IP 'cd /opt/MyWebDrive/infrastructure/alicloud && docker-compose -f docker-compose.node.yml restart'
```

### 回滚部署
```bash
ssh root@你的服务器IP
cd /opt/MyWebDrive/infrastructure/alicloud
./rollback.sh quick
```

## 🔧 环境变量配置

首次部署后，编辑 `/opt/MyWebDrive/infrastructure/alicloud/.env`：

```bash
# 必须修改
JWT_SECRET=$(openssl rand -hex 32)  # 生成安全密钥

# 可选配置
MINIO_ACCESS_KEY=your-key
MINIO_SECRET_KEY=your-secret

# 如果使用阿里云OSS
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY=your-oss-key
OSS_SECRET_KEY=your-oss-secret
OSS_BUCKET=your-bucket
```

## 🚨 故障排除

### 无法连接服务器
```bash
# 检查SSH连接
ssh -v root@你的服务器IP

# 确保安全组开放了22端口
```

### 服务无法访问
```bash
# 检查阿里云安全组，开放端口：
# 22 (SSH), 80 (HTTP), 443 (HTTPS), 9080 (API)

# 检查服务状态
ssh root@你的服务器IP
cd /opt/MyWebDrive/infrastructure/alicloud
docker-compose -f docker-compose.node.yml ps
```

### 查看详细日志
```bash
ssh root@你的服务器IP
cd /opt/MyWebDrive/infrastructure/alicloud
docker-compose -f docker-compose.node.yml logs -f [服务名]
```

## 📚 更多信息

- 📖 [完整部署指南](DEPLOY_GUIDE.md)
- 🔄 [回滚指南](infrastructure/alicloud/rollback.sh)
- 📋 [项目文档](README.md)

---

**需要帮助？** 查看 [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) 获取详细说明

