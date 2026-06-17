# 下载目录（方案 A）设计与使用说明

本方案在不引入新表的前提下，基于 Metadata 服务现有 File + FileTag 实体，通过 `catalog:*` 约定标签实现“项目/版本/资产”的聚合目录，并支持“灰度开关”。

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## 能力概览
- 只读目录 API（Metadata 服务）
  - GET `/api/v1/catalog`：返回公开项目清单
  - GET `/api/v1/catalog/:slug`：返回单个项目
- 灰度开关：只返回打有 `catalog:public=true` 的资源
- 下载 URL：
  - 优先读取标签中的 `catalog:url` 直链
  - 未设置时可回落到存储服务的下载接口
- 开发期直链：API 网关将仓库根目录 `assetsReal/` 映射为 `/assets`，方便临时托管
- 未来迁移 OSS/CDN：只需把 `catalog:url` 换成 OSS/CDN 完整链接，无需改前端

## 标签约定（示例）
- `catalog:kind=asset|project`（资产统一打 `asset`，项目元信息可选）
- `catalog:slug=<项目标识>`（同一项目下的资产归并）
- `catalog:name=<展示名>`、`catalog:description=...`、`catalog:category=base|writing|model|script|bundle`
- `catalog:version=<语义版本>`、`catalog:channel=stable|beta|dev`
- `catalog:os=windows|darwin|linux|any`、`catalog:arch=amd64|arm64|any`
- `catalog:public=true|false`（灰度开关）
- `catalog:url=<下载直链>`（开发期可设为 `/assets/<文件名或子路径>`）

## 使用流程（开发期）
1. 将文件放入仓库根目录 `assetsReal/`（可带子目录分类）
2. 任选其一：
   - 导入脚本（基于清单）：
     ```bash
     pnpm -C services/metadata exec tsx src/scripts/catalog-import.ts
     ```
     - 清单文件：`assetsReal/catalog-import.json`（数组，每项含 `filename`、`slug`、`version`、`category` 等）
   - 自动扫描（从文件名/目录推断）：
     ```bash
     pnpm -C services/metadata exec tsx src/scripts/catalog-scan.ts
     ```
3. 查看目录接口或前端页面
   - API：`http://localhost:9080/api/v1/catalog`
   - 前端下载页：已优先请求后端目录，若无数据回退示例数据

## 命令速记（package.json）
在 `services/metadata/package.json` 已提供：
- `pnpm -C services/metadata catalog:import`
- `pnpm -C services/metadata catalog:scan`

## 返回结构（示例节选）
```json
{
  "projects": [
    {
      "slug": "webgal",
      "name": "webgal",
      "category": "base",
      "releases": [
        {
          "version": "3.0.0",
          "channel": "stable",
          "assets": [
            {
              "filename": "WebGAL_Terre_MyGO3.0.0.zip",
              "url": "/assets/WebGAL_Terre_MyGO3.0.0.zip"
            }
          ]
        }
      ]
    }
  ]
}
```

## 未来演进
- 支持全局 ENV 开关（例如 `CATALOG_INCLUDE_PRIVATE=true` 时可返回 `public=false`）
- 丰富项目层（`catalog:kind=project`）元信息：`license`、`repo` 等
- 可选生成 SHA256 等校验信息

