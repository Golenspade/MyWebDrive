# 发布管理快速开始

本指南将帮助您在 5 分钟内完成第一次软件发布。

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## 前置条件

1. 后端服务已启动
2. 拥有管理员账号
3. 已上传至少一个文件

## 快速开始

### 步骤 1: 启动服务

```bash
# 启动后端服务
./manage-services.sh start-backend

# 启动前端服务
./manage-services.sh start-frontend
```

### 步骤 2: 登录管理后台

1. 打开浏览器访问 `http://localhost:3100/admin`
2. 使用管理员账号登录
   - 默认账号: `admin@example.com`
   - 默认密码: `admin123`

### 步骤 3: 上传文件（如果还没有）

如果您还没有上传文件，可以通过以下方式上传：

**方式 A: 使用 API**

```bash
# 获取 token
TOKEN=$(curl -s -X POST http://localhost:9080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r .accessToken)

# 创建上传会话（JSON 流程）
SESSION=$(curl -s -X POST http://localhost:9080/api/v1/storage/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"my-app-1.0.0.zip","fileSize":1024000}')
UPLOAD_ID=$(echo "$SESSION" | jq -r .id)

# 上传一个最小分片（索引 0，1KB）
TMP=$(mktemp); dd if=/dev/zero of="$TMP" bs=1024 count=1 >/dev/null 2>&1
curl -s -X PATCH http://localhost:9080/api/v1/storage/uploads/$UPLOAD_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Chunk-Index: 0" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$TMP" >/dev/null
rm -f "$TMP"

# 完成上传
curl -X POST http://localhost:9080/api/v1/storage/uploads/$UPLOAD_ID/finalize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

echo "File ID: $UPLOAD_ID"
```

**方式 B: 使用前端（开发中）**

前端文件上传功能正在开发中，目前请使用 API 方式。

### 步骤 4: 发布到目录

#### 4.1 进入发布管理页面

1. 在管理后台导航栏点击 **"Publish"**
2. 进入发布管理页面

#### 4.2 搜索并选择文件

1. 在左侧 "选择文件" 区域输入文件名关键词
2. 点击 "搜索" 按钮
3. 从搜索结果中点击要发布的文件

> 提示：后台搜索接口为 `GET /api/v1/search?q=关键词&only=files|folders|all`，前端发布页使用 `only=files` 仅返回文件结果。


#### 4.3 填写发布信息

在右侧 "发布信息" 表单中填写：

**必填项:**
- **Slug**: `my-app` (项目唯一标识，建议小写字母+连字符)
- **Version**: `1.0.0` (版本号)

**推荐填写:**
- **Name**: `My Application` (显示名称)
- **Description**: `A great application` (项目描述)
- **Category**: `tools` (分类)
- **License**: `MIT` (开源许可证)
- **Channel**: `stable` (发布渠道)

**可选项:**
- Repository: 源码仓库地址
- OS: 目标操作系统 (默认 any)
- Arch: 目标架构 (默认 any)
- Custom URL: 自定义下载链接

**重要:**
- 勾选 **"Public"** 复选框，使项目在目录中可见

#### 4.4 点击发布

1. 点击 "发布" 按钮
2. 等待发布完成（通常 1-2 秒）
3. 查看发布预览对话框

### 步骤 5: 验证发布

#### 5.1 查看目录 API

```bash
curl http://localhost:9080/api/v1/catalog/my-app | jq
```

**预期输出:**
```json
{
  "slug": "my-app",
  "name": "My Application",
  "description": "A great application",
  "category": "tools",
  "license": "MIT",
  "releases": [
    {
      "version": "1.0.0",
      "channel": "stable",
      "assets": [
        {
          "id": "file-id-xxx",
          "filename": "my-app-1.0.0.zip",
          "sizeBytes": 1024000,
          "os": "any",
          "arch": "any",
          "url": "http://localhost:9080/api/v1/storage/files/file-id-xxx/download"
        }
      ]
    }
  ]
}
```

#### 5.2 查看所有目录项目

```bash
curl http://localhost:9080/api/v1/catalog | jq
```

#### 5.3 查看通知

1. 在管理后台点击 "Notifications"
2. 应该看到 "发布成功" 的通知

## 常见场景

### 场景 1: 发布新版本

如果要发布同一项目的新版本：

1. 上传新版本文件
2. 进入发布管理页面
3. 选择新文件
4. 使用**相同的 slug**，但**不同的 version**
5. 点击发布

系统会自动将新版本添加到同一项目下。

### 场景 2: 多平台发布

如果要为不同平台发布：

1. 分别上传各平台的文件
2. 对每个文件执行发布，使用：
   - 相同的 slug 和 version
   - 不同的 os 和 arch

**示例:**

| 文件 | Slug | Version | OS | Arch |
|------|------|---------|----|----|
| app-windows.exe | my-app | 1.0.0 | windows | amd64 |
| app-macos | my-app | 1.0.0 | darwin | arm64 |
| app-linux | my-app | 1.0.0 | linux | amd64 |

系统会自动聚合到同一个 release 下。

### 场景 3: 使用 CDN

如果文件托管在 CDN 上：

1. 在发布表单中填写 **Custom URL**
2. 例如: `https://cdn.example.com/my-app-1.0.0.zip`
3. 目录 API 将返回该 URL 而不是内部存储路径

### 场景 4: Beta 版本发布

发布测试版本：

1. 将 **Channel** 设置为 `beta`
2. 其他步骤相同
3. 用户可以通过 channel 筛选稳定版或测试版

## 下一步

- 📖 阅读完整文档: [PUBLISH_MANAGEMENT.md](./PUBLISH_MANAGEMENT.md)
- 🧪 运行测试脚本: `bash test_publish_api.sh`
- 🔧 集成到 CI/CD 流程
- 📊 查看下载统计（开发中）

## 故障排除

### 问题: 搜索不到文件

**解决方案:**
1. 确认文件已成功上传并 finalize
2. 检查文件是否属于当前登录用户
3. 尝试使用完整文件名搜索

### 问题: 发布失败

**解决方案:**
1. 检查是否以管理员身份登录
2. 确认 slug 和 version 已填写
3. 查看浏览器控制台错误信息
4. 检查后端日志: `tail -f logs/metadata.log`

### 问题: 目录中看不到项目

**解决方案:**
1. 确认 **Public** 复选框已勾选
2. 检查 `catalog:public=true` 标签是否存在:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:9080/api/v1/files/$FILE_ID/tags
   ```

### 问题: 下载链接无法访问

**解决方案:**
1. 确认 Storage 服务正常运行
2. 检查文件是否已删除
3. 如果使用自定义 URL，确认 CDN 可访问

## 反馈与支持

如有问题或建议，请：
- 提交 Issue: https://github.com/Golenspade/MyWebDrive/issues
- 查看文档: `/docs`
- 联系管理员

