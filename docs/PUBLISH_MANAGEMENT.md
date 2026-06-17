# 发布管理系统

## 概述

发布管理系统允许管理员将已上传的文件发布到公开目录（Catalog），实现文件到软件发布的完整流程。

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## 架构设计

### 核心流程

```
上传文件 → 选择文件 → 编辑发布信息 → 发布到目录 → 公开访问
```

### 系统组件

1. **后端接口** (Metadata Service)
   - `GET /api/v1/files/:fileId/tags` - 获取文件标签
   - `PUT /api/v1/files/:fileId/catalog` - 设置目录发布信息

2. **网关增强** (API Gateway)
   - 代理发布接口
   - 记录审计日志
   - 发送系统通知

3. **前端页面** (Admin Dashboard)
   - `/admin/publish` - 发布管理页面
   - 文件搜索与选择
   - 发布信息编辑
   - 发布预览

## API 规格

### 1. 获取文件标签

```http
GET /api/v1/files/:fileId/tags
Authorization: Bearer <admin-token>
```

**响应示例:**
```json
{
  "tags": [
    {
      "tagName": "catalog:slug=my-app",
      "createdAt": "2025-10-16T10:00:00Z"
    },
    {
      "tagName": "catalog:version=1.0.0",
      "createdAt": "2025-10-16T10:00:00Z"
    }
  ]
}
```

### 2. 发布到目录

```http
PUT /api/v1/files/:fileId/catalog
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**请求体:**
```json
{
  "slug": "my-app",
  "name": "My Application",
  "description": "A great application",
  "category": "tools",
  "license": "MIT",
  "repo": "https://github.com/user/my-app",
  "version": "1.0.0",
  "channel": "stable",
  "os": "any",
  "arch": "any",
  "public": true,
  "url": "https://cdn.example.com/my-app-1.0.0.zip"
}
```

**字段说明:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| slug | string | ✅ | 项目唯一标识符 (URL-safe) |
| version | string | ✅ | 版本号 (如 1.0.0) |
| channel | enum | ✅ | 发布渠道: stable/beta/dev |
| public | boolean | ✅ | 是否公开可见 |
| name | string | ❌ | 项目显示名称 |
| description | string | ❌ | 项目描述 |
| category | string | ❌ | 分类 (如 tools, games) |
| license | string | ❌ | 许可证 (如 MIT, GPL) |
| repo | string | ❌ | 仓库地址 |
| os | enum | ❌ | 操作系统: windows/darwin/linux/any |
| arch | enum | ❌ | 架构: amd64/arm64/any |
| url | string | ❌ | 自定义下载链接 (留空则使用内部存储) |

**响应示例:**
```json
{
  "ok": true,
  "slug": "my-app",
  "version": "1.0.0",
  "channel": "stable"
}
```

### 3. 查看目录条目

```http
GET /api/v1/catalog/:slug
```

**响应示例:**
```json
{
  "slug": "my-app",
  "name": "My Application",
  "description": "A great application",
  "category": "tools",
  "license": "MIT",
  "repo": "https://github.com/user/my-app",
  "releases": [
    {
      "version": "1.0.0",
      "channel": "stable",
      "assets": [
        {
          "id": "file-id-123",
          "filename": "my-app.zip",
          "sizeBytes": 1048576,
          "os": "any",
          "arch": "any",
          "channel": "stable",
          "version": "1.0.0",
          "url": "http://localhost:9080/api/v1/storage/files/file-id-123/download"
        }
      ]
    }
  ]
}
```

## 前端使用指南

### 访问发布管理页面

1. 以管理员身份登录
2. 进入 Admin Dashboard
3. 点击导航栏的 "Publish" 菜单

### 发布流程

#### 步骤 1: 搜索并选择文件

1. 在左侧 "选择文件" 卡片中输入文件名
2. 点击 "搜索" 按钮
3. 从搜索结果中点击要发布的文件

#### 步骤 2: 填写发布信息

在右侧 "发布信息" 卡片中填写：

- **必填项:**
  - Slug: 项目唯一标识 (建议使用小写字母、数字和连字符)
  - Version: 版本号 (建议遵循语义化版本)

- **可选项:**
  - Name: 项目显示名称
  - Description: 项目描述
  - Category: 分类标签
  - License: 开源许可证
  - Repository: 源码仓库地址
  - Channel: 发布渠道 (stable/beta/dev)
  - OS: 目标操作系统
  - Arch: 目标架构
  - Custom URL: 自定义下载链接 (如使用 CDN)
  - Public: 是否公开可见

#### 步骤 3: 发布

1. 点击 "发布" 按钮
2. 等待发布完成
3. 查看发布预览对话框

#### 步骤 4: 验证

发布成功后，可以通过以下方式验证：

1. **API 访问:**
   ```bash
   curl http://localhost:9080/api/v1/catalog/my-app
   ```

2. **通知中心:**
   - 进入 "Notifications" 页面
   - 查看发布成功通知

3. **审计日志:**
   - 通过 API 查看审计记录
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:9080/api/v1/admin/audit
   ```

## 后端实现细节

### 标签存储格式

发布信息以标签形式存储在 `FileTag` 表中，格式为 `catalog:key=value`：

```
catalog:kind=asset
catalog:slug=my-app
catalog:version=1.0.0
catalog:channel=stable
catalog:public=true
catalog:name=My Application
catalog:description=A great application
catalog:category=tools
catalog:license=MIT
catalog:repo=https://github.com/user/my-app
catalog:os=any
catalog:arch=any
catalog:url=https://cdn.example.com/file.zip
```

### 发布操作

`PUT /api/v1/files/:fileId/catalog` 执行以下操作：

1. 验证管理员权限
2. 验证必填字段 (slug, version, channel, public)
3. 检查文件是否存在
4. 在事务中:
   - 删除所有旧的 `catalog:*` 标签
   - 插入新的 `catalog:*` 标签
5. 记录日志

### 审计与通知

通过 API Gateway 拦截发布请求，自动记录：

- **审计日志:**
  - action: `publish`
  - target: `{slug}@{version}`
  - meta: `{ fileId, slug, version, channel }`

- **系统通知:**
  - title: `发布成功`
  - description: `项目 {slug} 版本 {version} ({channel}) 已发布`
  - severity: `success`
  - service: `catalog`

## 测试

### 自动化测试脚本

运行测试脚本验证完整流程：

```bash
# 确保后端服务运行
./manage-services.sh start-backend

# 运行测试
bash test_publish_api.sh
```

测试脚本执行以下步骤：
1. 管理员登录
2. 创建测试文件
3. 完成上传
4. 获取文件标签 (初始为空)
5. 发布到目录
6. 再次获取标签 (应包含 catalog:* 标签)
7. 查询目录条目
8. 检查审计日志

### 手动测试

```bash
# 1. 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:9080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r .accessToken)

# 2. 发布文件
curl -X PUT http://localhost:9080/api/v1/files/YOUR_FILE_ID/catalog \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-app",
    "version": "1.0.0",
    "channel": "stable",
    "public": true
  }'

# 3. 查看目录
curl http://localhost:9080/api/v1/catalog/test-app | jq
```

## 常见问题

### Q: 如何更新已发布的版本？

A: 使用相同的 slug 但不同的 version 再次发布即可。系统会创建新的 release。

### Q: 如何撤销发布？

A: 将 `public` 设置为 `false` 重新发布，或删除文件的所有 `catalog:*` 标签。

### Q: 自定义 URL 的作用？

A: 如果提供了 `url` 字段，目录 API 将返回该 URL 而不是内部存储路径。适用于使用 CDN 或外部存储的场景。

### Q: 如何支持多平台发布？

A: 为不同平台的文件分别上传，使用相同的 slug 和 version，但设置不同的 os 和 arch。系统会自动聚合到同一个 release 下。

## 未来增强

- [ ] 批量发布支持
- [ ] 发布历史记录
- [ ] 版本比较与回滚
- [ ] 发布审批流程
- [ ] 自动化发布 (CI/CD 集成)
- [ ] 下载统计与分析

