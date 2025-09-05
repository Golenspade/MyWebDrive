# MyWebDrive 后端架构文档

## 项目概述

MyWebDrive 是一个基于微服务架构的云存储系统，采用 Go 语言开发，提供完整的文件管理、用户认证、文件分享等功能。

## 架构设计

### 微服务架构

项目采用微服务架构，包含以下核心服务：

```
┌─────────────────┐    ┌──────────────────┐
│   Frontend      │    │   API Gateway    │
│   (React)       │───▶│   Port: 8080     │
└─────────────────┘    └──────────┬───────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │  Auth Service    │ │  User Service    │ │ Metadata Service │
        │  Port: 8081      │ │  Port: 8082      │ │  Port: 8083      │
        └──────────────────┘ └──────────────────┘ └──────────────────┘
                    ▼             ▼             ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │ Storage Service  │ │ Sharing Service  │ │   Common Lib     │
        │  Port: 8084      │ │  Port: 8085      │ │  (共享组件)       │
        └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 服务详情

#### 1. API Gateway (端口: 8080)
- **功能**: 统一入口，路由转发，JWT 验证
- **技术**: Echo Web框架，HTTP反向代理
- **特性**:
  - 请求路由和负载均衡
  - JWT Token 验证中间件
  - CORS 跨域处理
  - 请求日志和监控

#### 2. Auth Service (端口: 8081)
- **功能**: 用户认证，JWT Token 管理
- **数据库**: SQLite (`./data/mywebdrive.db` - 统一数据库)
- **配置**: 支持bcrypt cost、token过期时间配置
- **API端点**:
  - `POST /api/v1/auth/register` - 用户注册（含存储配额初始化）
  - `POST /api/v1/auth/login` - 用户登录
  - `POST /api/v1/auth/refresh` - Token 刷新
  - `POST /api/v1/auth/logout` - 用户登出

#### 3. User Service (端口: 8082)
- **功能**: 用户信息管理，存储配额管理
- **数据库**: SQLite (`./data/mywebdrive.db` - 统一数据库)
- **API端点**:
  - `GET /api/v1/users/me` - 获取用户信息
  - `PATCH /api/v1/users/me` - 更新用户信息
  - `GET /api/v1/users/me/storage` - 获取存储信息

#### 4. Metadata Service (端口: 8083)
- **功能**: 文件元数据管理，文件版本控制
- **数据库**: SQLite (`metadata.db`)
- **API端点**:
  - `POST /api/v1/folders` - 创建文件夹
  - `GET /api/v1/folders/:folderId/children` - 列出文件夹内容
  - `GET /api/v1/files/:fileId` - 获取文件信息
  - `GET /api/v1/files/:fileId/versions` - 获取文件版本历史
  - `POST /api/v1/files/:fileId/versions/:versionId/restore` - 恢复文件版本

#### 5. Storage Service (端口: 8084)
- **功能**: 文件存储，分块上传，文件下载
- **存储**: 本地文件系统 / MinIO (可选)
- **特性**:
  - 分块上传支持大文件
  - 断点续传
  - MD5 校验
  - 存储路径管理

#### 6. Sharing Service (端口: 8085)
- **功能**: 文件分享，权限控制
- **数据库**: SQLite (`sharing.db`)
- **特性**:
  - 公开/私有分享
  - 密码保护
  - 下载次数限制
  - 过期时间控制

#### 7. Common Library
- **功能**: 公共组件和工具库
- **包含**:
  - JWT 管理
  - 数据模型定义
  - HTTP 响应工具
  - 数据验证
  - 服务发现和负载均衡

## 技术栈

### 核心技术
- **语言**: Go 1.21+
- **Web框架**: Echo v4
- **数据库**: SQLite3
- **认证**: JWT (JSON Web Tokens)
- **日志**: Zap
- **存储**: 本地文件系统 / MinIO

### 依赖管理
- **模块管理**: Go Modules
- **主要依赖**:
  - `github.com/labstack/echo/v4` - Web框架
  - `github.com/golang-jwt/jwt/v5` - JWT处理
  - `github.com/mattn/go-sqlite3` - SQLite驱动
  - `go.uber.org/zap` - 结构化日志
  - `github.com/google/uuid` - UUID生成
  - `golang.org/x/crypto` - 密码哈希

## 数据库设计

### Auth Service 数据库 (auth.db)
```sql
-- 用户表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

### User Service 数据库 (user.db)
```sql
-- 用户信息表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    storage_quota INTEGER DEFAULT 5368709120, -- 5GB
    storage_used INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

### Metadata Service 数据库 (metadata.db)
```sql
-- 文件表
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('file', 'folder')),
    size INTEGER,
    mime_type TEXT,
    parent_id TEXT,
    owner_id TEXT NOT NULL,
    path TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    storage_path TEXT,
    md5_hash TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME,
    FOREIGN KEY (parent_id) REFERENCES files(id)
);

-- 文件版本表
CREATE TABLE file_versions (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    md5_hash TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
```

### Sharing Service 数据库 (sharing.db)
```sql
-- 分享表
CREATE TABLE shares (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    share_type TEXT CHECK (share_type IN ('private', 'public')),
    permission TEXT CHECK (permission IN ('view', 'download', 'edit')),
    password TEXT,
    expires_at DATETIME,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

## 配置系统

### 统一配置管理
项目采用统一的配置管理系统，支持多层配置覆盖：

1. **默认值**（内置）
2. **config.yaml**（统一配置文件）
3. **环境变量**（覆盖配置文件）

### 配置文件结构
```yaml
# backend/config/config.yaml
database:
  path: "./data/mywebdrive.db"  # 统一数据库路径

user:
  default_quota_gb: 5  # 默认存储配额 5GB

security:
  bcrypt_cost: 10                    # bcrypt 哈希强度
  access_token_duration: "2h"       # 访问令牌有效期
  refresh_token_duration: "720h"    # 刷新令牌有效期（30天）

cors:
  allowed_origins:
    - "*"  # 开发环境，生产建议改为具体域名

storage:
  max_file_size_mb: 500
  allowed_extensions: [".jpg", ".png", ".pdf", ".md", ".zip", ".mp4"]
```

### 环境变量配置
```bash
# 必填
JWT_SECRET=your-super-secret-jwt-key

# 可选（有默认值）
DATABASE_PATH=./data/mywebdrive.db
BCRYPT_COST=10
ACCESS_TOKEN_DURATION=2h
REFRESH_TOKEN_DURATION=720h
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ENV=development
```

## 数据库设计

### 统一数据库架构
- **数据库**: SQLite (`./data/mywebdrive.db`)
- **优势**: 简化部署，减少数据一致性问题
- **表结构**:
  - `users`: 用户信息（含存储配额）
  - 其他表根据需要扩展

### Users 表结构
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,                     -- 用户名
  email TEXT NOT NULL UNIQUE,             -- 邮箱（唯一）
  password TEXT NOT NULL,                 -- bcrypt 哈希密码
  storage_quota INTEGER NOT NULL DEFAULT 5368709120,  -- 存储配额（字节）
  storage_used INTEGER NOT NULL DEFAULT 0,            -- 已使用存储（字节）
  created_at DATETIME NOT NULL,           -- 创建时间
  updated_at DATETIME NOT NULL            -- 更新时间
);
```

## 安全设计

### 认证和授权
- **JWT Token**: 使用 HS256 算法签名
- **Token 过期**: Access Token 2小时，Refresh Token 30天
- **密码安全**: bcrypt 哈希，可配置 cost（默认 10）
- **API 保护**: 所有敏感 API 需要 JWT 验证

### 数据安全
- **文件完整性**: MD5 校验
- **访问控制**: 基于用户 ID 的文件所有权验证
- **分享安全**: Token 验证，密码保护，过期控制

## 部署和运维

### 开发环境启动

1. **准备配置文件**:
```bash
cd backend
# 复制环境变量模板
cp .env.example .env
# 编辑 .env 文件，设置 JWT_SECRET
```

2. **启动所有服务**:
```bash
# 使用启动脚本
chmod +x start-services.sh
./start-services.sh

# 或者手动启动各服务
cd auth-service && go run main.go &
cd user-service && go run main.go &
cd api-gateway && go run main.go &
```

3. **验证服务状态**:
```bash
# 检查 API Gateway
curl http://localhost:8080/health

# 检查各个服务
curl http://localhost:8081/health  # Auth Service
curl http://localhost:8082/health  # User Service
```

### 环境配置

创建 `backend/.env` 文件配置环境变量:
```bash
# 必填配置
JWT_SECRET=your-super-secret-jwt-key-change-me

# 可选配置（有默认值）
DATABASE_PATH=./data/mywebdrive.db
BCRYPT_COST=10
ACCESS_TOKEN_DURATION=2h
REFRESH_TOKEN_DURATION=720h

# 开发环境 CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# 环境标识
ENV=development

# 服务URL配置（API Gateway使用）
AUTH_SERVICE_URL=http://localhost:8081
USER_SERVICE_URL=http://localhost:8082
METADATA_SERVICE_URL=http://localhost:8083
STORAGE_SERVICE_URL=http://localhost:8084
SHARING_SERVICE_URL=http://localhost:8085
```

### Docker 部署

```bash
# 构建镜像
make docker-build

# 启动容器
make docker-up

# 停止容器
make docker-down
```

### Kubernetes 部署

```bash
# 部署到 K8s
make k8s-deploy

# 删除 K8s 资源
make k8s-delete
```

## API 文档

### 端到端测试示例

#### 1. 用户注册
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "email": "alice@example.com",
    "password": "Secret1234"
  }'
```

#### 2. 用户登录
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Secret1234"
  }'
```

#### 3. 获取用户信息
```bash
# 使用登录返回的 accessToken
curl http://localhost:8080/api/v1/users/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### 4. 刷新令牌
```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<REFRESH_TOKEN>"
  }'
```

#### 5. 用户登出
```bash
curl -X POST http://localhost:8080/api/v1/auth/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### API 端点总览

#### 认证相关
- `POST /api/v1/auth/register` - 用户注册（含存储配额初始化）
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新Token
- `POST /api/v1/auth/logout` - 用户登出

#### 用户管理
- `GET /api/v1/users/me` - 获取当前用户信息
- `PATCH /api/v1/users/me` - 更新用户信息
- `GET /api/v1/users/me/storage` - 获取存储使用情况

### 文件管理
- `POST /api/v1/folders` - 创建文件夹
- `GET /api/v1/folders/:folderId/children` - 获取文件夹内容
- `GET /api/v1/files/:fileId` - 获取文件信息
- `PATCH /api/v1/files/:fileId` - 更新文件信息
- `DELETE /api/v1/files/:fileId` - 删除文件
- `POST /api/v1/files/:fileId/move` - 移动文件

### 文件上传
- `POST /api/v1/storage/uploads` - 创建上传会话
- `PATCH /api/v1/storage/uploads/:uploadId` - 上传文件块
- `POST /api/v1/storage/uploads/:uploadId/finalize` - 完成上传

### 文件分享
- `POST /api/v1/files/:fileId/shares` - 创建分享
- `GET /api/v1/files/:fileId/shares` - 获取文件分享列表
- `PATCH /api/v1/shares/:shareId` - 更新分享设置
- `DELETE /api/v1/shares/:shareId` - 删除分享
- `GET /api/v1/shares/:shareToken` - 访问分享文件

## 监控和日志

### 健康检查
每个服务都提供 `/health` 端点用于健康检查:
```bash
curl http://localhost:8080/health  # API Gateway
curl http://localhost:8081/health  # Auth Service
curl http://localhost:8082/health  # User Service
curl http://localhost:8083/health  # Metadata Service
curl http://localhost:8084/health  # Storage Service
curl http://localhost:8085/health  # Sharing Service
```

### 日志管理
- **日志格式**: JSON 结构化日志
- **日志级别**: Debug, Info, Warn, Error
- **日志输出**: 标准输出 + 文件 (./logs/)
- **日志轮转**: 按大小和时间轮转

## 性能优化

### 数据库优化
- 合适的索引设计
- 查询优化
- 连接池管理

### 缓存策略
- 文件元数据缓存
- 用户信息缓存
- JWT Token 缓存

### 存储优化
- 分块上传减少内存使用
- 文件去重
- 压缩存储

## 扩展性设计

### 水平扩展
- 无状态服务设计
- 负载均衡支持
- 数据库分片准备

### 服务发现
- 内存注册中心 (开发环境)
- 支持扩展到 Consul/etcd
- 健康检查和自动故障转移

### 插件化架构
- 存储插件 (本地/MinIO/S3)
- 认证插件 (LDAP/OAuth)
- 通知插件 (Email/SMS)

## 故障排查

### 常见问题

1. **服务启动失败**
   - 检查端口占用: `lsof -i :8080`
   - 检查数据库文件权限
   - 查看服务日志: `tail -f logs/service-name.log`

2. **认证失败**
   - 检查 JWT_SECRET 配置
   - 验证 Token 格式和过期时间
   - 查看认证服务日志

3. **文件上传失败**
   - 检查存储目录权限
   - 验证磁盘空间
   - 检查文件大小限制

### 日志分析
```bash
# 查看所有服务日志
tail -f logs/*.log

# 查看特定服务日志
tail -f logs/api-gateway.log

# 搜索错误日志
grep -r "ERROR" logs/

# 查看服务状态
make status
```

## 开发指南

### 代码规范
- 使用 `gofmt` 格式化代码
- 遵循 Go 命名约定
- 添加适当的注释和文档
- 错误处理要完整

### 测试策略
- 单元测试覆盖核心逻辑
- 集成测试验证服务间交互
- API 测试确保接口正确性

### 贡献流程
1. Fork 项目
2. 创建功能分支
3. 编写代码和测试
4. 提交 Pull Request
5. 代码审查和合并

---

## 总结

MyWebDrive 后端采用现代微服务架构，具有良好的扩展性和维护性。通过合理的服务拆分、统一的接口设计和完善的监控体系，为用户提供稳定可靠的云存储服务。
