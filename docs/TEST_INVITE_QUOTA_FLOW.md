# 邀请码 + 配额 + 上传/下载 E2E 测试脚本

本脚本覆盖如下流程：
1. 管理员创建邀请码
2. 新用户使用邀请码注册并登录
3. 设置用户为小配额（1 MiB）
4. 用户上传小文件成功；上传大文件失败（超配额）
5. 管理员提升配额（6 MiB）
6. 用户重新上传大文件成功，并可下载
7. 通知中心可看到上述活动（创建邀请码/注册/上传完成/上传失败/配额修改/下载请求）

## 位置
- 脚本：scripts/test_invite_quota_flow.sh

## 先决条件
- 已启动后端（网关默认 9080）：
  - `./manage-services.sh start-backend` 或 `./manage-services.sh restart`
- 已有管理员账号：email=admin@local，password=admin123456（数据库 seed）
- 工具：`curl`、`node`、`dd`

## 运行
```bash
bash scripts/test_invite_quota_flow.sh
```
可用环境变量：
- `GATEWAY_URL`（默认 http://127.0.0.1:9080）
- `SMALL_QUOTA`（默认 1048576 = 1 MiB）
- `BIG_QUOTA`（默认 6291456 = 6 MiB）
- `SMALL_SIZE`（默认 512*1024）
- `LARGE_SIZE`（默认 2*1024*1024）

## 期望结果
- 小文件 finalize 返回 200；大文件 finalize 在小配额阶段返回 502；提升配额后重新上传返回 200；下载返回 200。
- `GET /api/v1/admin/notifications` 可看到：
  - 创建邀请码、新用户注册
  - 文件上传完成（含大小）/文件上传失败（status=502）
  - 配额修改（user=... -> N bytes）
  - 下载请求（fileId=...）

## 注意
- 如需“注册即默认小配额”，可在启动时设置 `USER_DEFAULT_QUOTA_BYTES=1048576` 后再 `./manage-services.sh restart`。
- 前端通知页已对“字节数”进行 KB/MB/GB 自动单位转换（超过 5 位数自动升级单位），与其它页面一致。

