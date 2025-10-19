# 发布管理系统验收清单

本文档提供完整的验收测试清单，用于验证发布管理系统的所有功能。

## 环境准备

### ✅ 前置条件

- [ ] Node.js 20+ 已安装
- [ ] pnpm 已安装
- [ ] 所有依赖已安装 (`pnpm -w install`)
- [ ] 所有服务已构建 (`pnpm -w build`)
- [ ] 后端服务正在运行 (`./manage-services.sh start-backend`)
- [ ] 前端服务正在运行 (`./manage-services.sh start-frontend`)
- [ ] 管理员账号可用 (admin@example.com / admin123)

### ✅ 服务健康检查

```bash
# 检查所有服务状态
curl http://localhost:9080/health
curl http://localhost:7081/health  # Auth
curl http://localhost:7082/health  # User
curl http://localhost:7083/health  # Metadata
curl http://localhost:7084/health  # Storage
curl http://localhost:7085/health  # Sharing
```

预期: 所有服务返回 `{"status":"healthy"}`

## 后端接口测试

### ✅ 1. 标签查询接口

**测试用例 1.1: 获取文件标签（管理员）**

```bash
# 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:9080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r .accessToken)

# 创建测试文件
FILE_ID="test-$(date +%s)"
curl -X POST http://localhost:9080/api/v1/storage/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"test.zip\",\"fileSize\":1024}"

# 获取标签
curl -X GET "http://localhost:9080/api/v1/files/$FILE_ID/tags" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果:**
- 返回 200 状态码
- 响应包含 `{ "tags": [] }` (初始为空)

**测试用例 1.2: 未授权访问**

```bash
curl -X GET "http://localhost:9080/api/v1/files/$FILE_ID/tags"
```

**预期结果:**
- 返回 401 状态码
- 响应包含 `{ "error": "Unauthorized" }`

**测试用例 1.3: 非管理员访问**

```bash
# 以普通用户登录
USER_TOKEN=$(curl -s -X POST http://localhost:9080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"user123"}' \
  | jq -r .accessToken)

curl -X GET "http://localhost:9080/api/v1/files/$FILE_ID/tags" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**预期结果:**
- 返回 403 状态码
- 响应包含 `{ "error": "Admin access required" }`

### ✅ 2. 发布接口

**测试用例 2.1: 成功发布**

```bash
curl -X PUT "http://localhost:9080/api/v1/files/$FILE_ID/catalog" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-app",
    "name": "Test Application",
    "description": "A test application",
    "category": "tools",
    "license": "MIT",
    "repo": "https://github.com/test/app",
    "version": "1.0.0",
    "channel": "stable",
    "os": "any",
    "arch": "any",
    "public": true
  }'
```

**预期结果:**
- 返回 200 状态码
- 响应包含 `{ "ok": true, "slug": "test-app", "version": "1.0.0", "channel": "stable" }`

**测试用例 2.2: 验证标签已创建**

```bash
curl -X GET "http://localhost:9080/api/v1/files/$FILE_ID/tags" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**预期结果:**
- 标签数组包含多个 `catalog:*` 标签
- 包含 `catalog:slug=test-app`
- 包含 `catalog:version=1.0.0`
- 包含 `catalog:channel=stable`
- 包含 `catalog:public=true`

**测试用例 2.3: 缺少必填字段**

```bash
curl -X PUT "http://localhost:9080/api/v1/files/$FILE_ID/catalog" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug": "test-app"}'
```

**预期结果:**
- 返回 400 状态码
- 响应包含错误信息（缺少 version 或 channel）

**测试用例 2.4: 无效的 channel**

```bash
curl -X PUT "http://localhost:9080/api/v1/files/$FILE_ID/catalog" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-app",
    "version": "1.0.0",
    "channel": "invalid",
    "public": true
  }'
```

**预期结果:**
- 返回 400 状态码
- 响应包含 `{ "error": "Invalid channel (must be stable, beta, or dev)" }`

### ✅ 3. 目录 API

**测试用例 3.1: 获取单个项目**

```bash
curl http://localhost:9080/api/v1/catalog/test-app | jq
```

**预期结果:**
- 返回 200 状态码
- 响应包含项目信息
- `slug` 为 "test-app"
- `releases` 数组包含至少一个版本
- 每个 release 包含 `assets` 数组

**测试用例 3.2: 获取所有项目**

```bash
curl http://localhost:9080/api/v1/catalog | jq
```

**预期结果:**
- 返回 200 状态码
- 响应包含 `{ "projects": [...] }`
- 仅包含 `public: true` 的项目

**测试用例 3.3: 不存在的项目**

```bash
curl http://localhost:9080/api/v1/catalog/non-existent
```

**预期结果:**
- 返回 404 状态码
- 响应包含 `{ "error": "Not Found" }`

### ✅ 4. 审计日志

**测试用例 4.1: 查看审计日志**

```bash
curl -X GET http://localhost:9080/api/v1/admin/audit \
  -H "Authorization: Bearer $TOKEN" | jq
```

**预期结果:**
- 返回 200 状态码
- 日志数组包含 `action: "publish"` 的记录
- 记录包含 `target: "test-app@1.0.0"`
- 记录包含 `actorId` (管理员 ID)

### ✅ 5. 系统通知

**测试用例 5.1: 查看通知列表**

```bash
curl -X GET http://localhost:9080/api/v1/admin/notifications \
  -H "Authorization: Bearer $TOKEN" | jq
```

**预期结果:**
- 返回 200 状态码
- 通知数组包含发布成功的通知
- 通知 `title` 为 "发布成功"
- 通知 `service` 为 "catalog"
- 通知 `severity` 为 "success"

## 前端测试

### ✅ 6. 导航菜单

**测试步骤:**
1. 访问 `http://localhost:3100/admin/overview`
2. 检查顶部导航栏

**预期结果:**
- [ ] 导航栏包含 "Publish" 菜单项
- [ ] "Publish" 位于 "Users" 和 "Notifications" 之间
- [ ] 点击 "Publish" 跳转到 `/admin/publish`

### ✅ 7. 发布管理页面

**测试步骤:**
1. 访问 `http://localhost:3100/admin/publish`
2. 检查页面布局

**预期结果:**
- [ ] 页面标题为 "发布管理"
- [ ] 左侧显示 "选择文件" 卡片
- [ ] 右侧显示 "发布信息" 卡片
- [ ] 搜索框和搜索按钮可见

### ✅ 8. 文件搜索功能

**测试步骤:**
1. 在搜索框输入文件名关键词
2. 点击 "搜索" 按钮

**预期结果:**
- [ ] 显示加载状态
- [ ] 搜索结果列表显示匹配的文件
- [ ] 每个文件显示名称和大小
- [ ] 点击文件可选中（高亮显示）

### ✅ 9. 发布表单

**测试步骤:**
1. 选择一个文件
2. 填写发布信息表单

**预期结果:**
- [ ] Slug 和 Version 字段标记为必填
- [ ] Channel 下拉菜单包含 stable/beta/dev 选项
- [ ] OS 下拉菜单包含 any/windows/darwin/linux 选项
- [ ] Arch 下拉菜单包含 any/amd64/arm64 选项
- [ ] Public 复选框默认勾选
- [ ] 所有字段可正常输入

### ✅ 10. 发布操作

**测试步骤:**
1. 填写完整的发布信息
2. 点击 "发布" 按钮

**预期结果:**
- [ ] 按钮显示 "发布中..." 状态
- [ ] 发布成功后显示成功提示
- [ ] 自动打开发布预览对话框
- [ ] 预览对话框显示项目信息和 releases

### ✅ 11. 表单验证

**测试步骤:**
1. 不选择文件，直接点击发布
2. 选择文件但不填写 slug，点击发布
3. 填写 slug 但不填写 version，点击发布

**预期结果:**
- [ ] 每种情况都显示相应的错误提示
- [ ] 不会发送 API 请求
- [ ] 错误提示清晰明确

### ✅ 12. 预览对话框

**测试步骤:**
1. 成功发布后查看预览对话框

**预期结果:**
- [ ] 显示项目 slug
- [ ] 显示项目 name
- [ ] 显示 description (如果有)
- [ ] 显示 releases 列表
- [ ] 每个 release 显示 version 和 channel
- [ ] 显示 API 端点示例

## 集成测试

### ✅ 13. 端到端流程

**测试步骤:**
1. 上传文件
2. 前端发布
3. API 验证
4. 通知验证

**自动化测试:**
```bash
bash test_publish_api.sh
```

**预期结果:**
- [ ] 所有步骤成功执行
- [ ] 无错误输出
- [ ] 最终显示 "=== Test Complete ==="

### ✅ 14. 多版本发布

**测试步骤:**
1. 发布 test-app 1.0.0
2. 发布 test-app 2.0.0
3. 查询目录 API

**预期结果:**
- [ ] 目录包含两个版本
- [ ] 版本按顺序排列
- [ ] 每个版本独立显示

### ✅ 15. 多平台发布

**测试步骤:**
1. 上传 Windows 版本，发布为 test-app 1.0.0 (os: windows)
2. 上传 macOS 版本，发布为 test-app 1.0.0 (os: darwin)
3. 查询目录 API

**预期结果:**
- [ ] 同一 release 包含多个 assets
- [ ] 每个 asset 的 os 字段正确
- [ ] 下载 URL 指向不同文件

## 性能测试

### ✅ 16. 响应时间

**测试步骤:**
```bash
time curl -X PUT "http://localhost:9080/api/v1/files/$FILE_ID/catalog" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test","version":"1.0.0","channel":"stable","public":true}'
```

**预期结果:**
- [ ] 响应时间 < 1 秒

### ✅ 17. 并发发布

**测试步骤:**
```bash
for i in {1..5}; do
  curl -X PUT "http://localhost:9080/api/v1/files/$FILE_ID/catalog" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"slug\":\"test-$i\",\"version\":\"1.0.0\",\"channel\":\"stable\",\"public\":true}" &
done
wait
```

**预期结果:**
- [ ] 所有请求成功
- [ ] 无数据竞争或冲突

## 文档验收

### ✅ 18. 文档完整性

- [ ] `docs/PUBLISH_MANAGEMENT.md` 存在且内容完整
- [ ] `docs/PUBLISH_QUICKSTART.md` 存在且内容完整
- [ ] `docs/PUBLISH_IMPLEMENTATION_SUMMARY.md` 存在且内容完整
- [ ] `docs/PUBLISH_ACCEPTANCE_CHECKLIST.md` 存在（本文档）
- [ ] `CHANGELOG.md` 包含发布管理系统条目
- [ ] `README.md` 包含发布管理系统介绍

### ✅ 19. 代码注释

- [ ] 后端接口包含清晰的注释
- [ ] 前端组件包含必要的注释
- [ ] 复杂逻辑有解释说明

## 总结

完成以上所有测试项后，发布管理系统即可认为验收通过。

**验收签字:**

- 开发者: ________________  日期: ________
- 测试者: ________________  日期: ________
- 审核者: ________________  日期: ________

