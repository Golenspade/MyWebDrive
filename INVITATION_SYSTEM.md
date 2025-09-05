# 邀请码注册系统

## 概述

MyWebDrive 现在支持基于邀请码的用户注册系统，确保只有受邀用户才能注册账户，同时限制上传功能仅对注册用户开放。

## 功能特性

### 用户权限系统
- **游客(guest)**: 可以通过公开分享链接下载文件
- **用户(user)**: 拥有完整的上传、下载权限
- **管理员(admin)**: 拥有所有权限 + 邀请码管理权限

### 邀请码系统
- 管理员可以生成、查看、撤销邀请码
- 支持单次使用或多次使用邀请码
- 支持设置过期时间
- 支持备注说明

## 配置

### config.yaml 新增配置项
```yaml
registration:
  require_invite: true           # 是否需要邀请码注册
  invite_code_length: 16         # 邀请码长度
  invite_default_usage_limit: 1  # 默认使用次数限制
  invite_default_ttl: "168h"     # 默认有效期（7天）
```

### 环境变量
```bash
# 可选的环境变量覆盖
REGISTRATION_REQUIRE_INVITE=true
INVITE_CODE_LENGTH=16
INVITE_DEFAULT_USAGE_LIMIT=1
INVITE_DEFAULT_TTL=168h
```

## API接口

### 用户注册（现在需要邀请码）
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "用户名",
  "email": "user@example.com",
  "password": "password123",
  "invitationCode": "ABC123XYZ789"  # 必需
}
```

### 管理员邀请码管理

#### 创建邀请码
```bash
POST /api/v1/auth/invitations
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "usageLimit": 1,              # 可选，默认1
  "expiresAt": "2024-01-01T00:00:00Z", # 可选，RFC3339格式
  "notes": "给新员工的邀请码"    # 可选
}
```

#### 列出所有邀请码
```bash
GET /api/v1/auth/invitations
Authorization: Bearer <admin_token>
```

#### 查看邀请码详情
```bash
GET /api/v1/auth/invitations/{code}
Authorization: Bearer <admin_token>
```

#### 撤销邀请码
```bash
POST /api/v1/auth/invitations/{code}/revoke
Authorization: Bearer <admin_token>
```

## 初始设置

### 1. 创建第一个管理员账户

由于新系统要求邀请码注册，您需要先创建初始管理员：

```bash
# 临时禁用邀请码验证
sed -i 's/require_invite: true/require_invite: false/' backend/config/config.yaml

# 重启auth服务，然后注册管理员
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "管理员",
    "email": "admin@yourdomain.com", 
    "password": "secure-admin-password"
  }'

# 设置用户为管理员
sqlite3 backend/data/mywebdrive.db \
  "UPDATE users SET role='admin' WHERE email='admin@yourdomain.com';"

# 重新启用邀请码验证
sed -i 's/require_invite: false/require_invite: true/' backend/config/config.yaml

# 重启所有服务
```

### 2. 管理员登录并生成邀请码

```bash
# 登录获取管理员token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "secure-admin-password"
  }'

# 使用返回的accessToken创建邀请码
curl -X POST http://localhost:8080/api/v1/auth/invitations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "usageLimit": 1,
    "notes": "新用户邀请"
  }'
```

## 数据库更改

### 新增表结构

#### users表新增字段
- `role TEXT NOT NULL DEFAULT 'user'`: 用户角色

#### invitation_codes表（新表）
```sql
CREATE TABLE invitation_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at DATETIME NOT NULL,
  expires_at DATETIME,
  usage_limit INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  used_by TEXT,
  used_at DATETIME,
  notes TEXT
);
```

## 安全特性

- 邀请码使用加密随机生成
- JWT令牌现在包含用户角色信息
- 上传功能严格限制给注册用户
- 管理员功能需要admin角色验证
- 支持邀请码过期和使用次数限制

## 测试

运行测试脚本验证功能：

```bash
export JWT_SECRET="your-super-secret-jwt-key"
./test_complete_flow.sh
```

## 向后兼容性

- 现有用户自动获得 'user' 角色
- 游客下载功能保持不变
- 管理员需要手动设置（首次配置）

## 故障排除

### 常见问题

1. **"邀请码验证失败"**
   - 检查邀请码是否有效且未过期
   - 确认邀请码未达到使用限制

2. **"上传被拒绝"**
   - 确认用户已登录且token有效
   - 检查用户角色是否为 'user' 或 'admin'

3. **"管理员功能无法访问"**
   - 确认用户角色为 'admin'
   - 检查JWT token中是否包含正确的角色信息

4. **"游客下载公开分享失败"**
   - 已修复：sharing-service 现在实现代理下载
   - 不再重定向到受保护的 storage 路由
   - 服务间通过内部JWT认证直接获取文件

## 架构改进

### 游客下载流程修复

**问题**: 原本 sharing-service 使用 302 重定向到 storage-service，但 storage 路由受 JWT 保护，导致游客下载失败。

**解决方案**: 实现代理下载
- sharing-service 内部调用 storage-service API
- 使用服务间 JWT token 进行认证
- 流式转发文件内容给客户端
- 保持公开分享的匿名访问特性

**技术细节**:
```go
// sharing-service 代理下载实现
func (s *SharingService) proxyDownloadFromStorage(c echo.Context, fileID string) error {
    // 生成服务间认证token
    serviceToken, err := s.generateServiceToken()
    
    // 直接调用storage-service内部API
    storageURL := fmt.Sprintf("%s/api/v1/storage/files/%s", s.storageServiceURL, fileID)
    req.Header.Set("Authorization", "Bearer "+serviceToken)
    
    // 流式转发文件内容
    io.Copy(c.Response().Writer, resp.Body)
}
```