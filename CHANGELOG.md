# Changelog

All notable changes to this repository will be documented in this file.



## 2025-09-30-2145 - 2025-09-30

### Fixed
- ci: 更新 pnpm-lock.yaml，修复 ERR_PNPM_OUTDATED_LOCKFILE（CI 安装依赖步骤恢复通过）。
- landing: 首页 Logo 组件默认使用 SVG，失败回退 PNG，消除 logo-07/08 的 404。

### Notes
- Tag: 2025-09-30-2145。
- Workflow: node-build-test Success。


## 2025-09-30

### Docs/Infra
- docs: 回退至 Nextra v3（迁移文档至 `pages/docs/`；删除 v4 遗留：`app/docs/*` 与 `mdx-components.ts`）。
- config: 更新 `next.config.js`（withNextra v3）与 `theme.config.jsx`；新增 `pages/_app.tsx` 以满足 Nextra v3 要求。
- docs: 迁移 `txt2mp4` 文档到 `pages/docs/txt2mp4/`；新增 `NEXTRA_V3_MIGRATION.md` 与 `docs/NEXTRA_QUICK_START.md`。
- verify: 本地开发环境验证 `/docs` 与 `/docs/txt2mp4` 响应 200 OK。

## 2025-09-28

### Docs/Infra
- catalog/docs: Clarify that download assets using `/assets/...` are served from repository root `assetsReal/` via Node gateway static mapping. Provide quick verification (`/assets/test.txt`) and recovery guidance.
- ops: Advise avoiding `git clean -fdx` on this repo when using local large artifacts under `assetsReal/` (ignored by Git). Recommend using an external persistent directory with a directory symlink to `assetsReal/`, or making the gateway static dir configurable via env (e.g., `ASSETS_DIR`).

### Notes
- User confirmed two real catalog entries: `webgal` and `l2dw`. Their files should be located at `assetsReal/WebGAL_Terre_MyGO3.0.0.zip` and `assetsReal/l2dw-1.4.21f1修复专注预览界面不换行不适配问题.7z` respectively. Current working copy does not contain these files; they must be copied back for the links to work.
- Frontend CSS/ShimmerButton experiment was rolled back to avoid global style overrides; no net UI change committed.


## release-20250927-2230 - 2025-09-27

### Changed
- frontend(web + landing): adopt self-hosted CN typography via next/font/local; default body font Noto Sans SC, display font ZCOOL XiaoWei restricted to `h1` and explicit `.heading` only.
- frontend(landing): enforce Bento card headings to body font for consistency.
- frontend(landing): globe section titles updated to "随时 随地" and subtitle to "全平台工具链解决方案".

### Removed
- frontend(landing): remove badges strip (Next.js/React/Tailwind/AOS/TypeScript/Vercel) section.

### Added
- docs: `docs/typography-and-landing-updates.md` with usage, fallback, and rollback guidance.

### Chore
- gitignore: ignore `assetsReal/` to prevent large artifacts being tracked.
- repo: cleaned repository history to remove oversized files under `assetsReal/`; force-pushed `main`.

### Notes
- After history rewrite, collaborators must resync: `git fetch --all --tags --prune` then `git reset --hard origin/main` (if no local work) or rebase accordingly.

## Unreleased - 2025-09-25

### Changed
- refactor(auth,user): Establish clear SoR boundaries. Auth owns credentials/role; User owns profile and quotas. Remove duplicate user fields to prevent drift.
- chore(prisma): Standardize per-service local Prisma Client output and local imports (Auth/User/Sharing) to avoid cross-service schema overwrites and align with NodeNext resolution.
- fix(storage): Remove duplicate Transform import; drop invalid Worker option `type: 'module'`. Build now passes.
- docs(readme): Reference new docs/env.example; clarify OpenAPI rewrite status.
- chore(gitignore): Replace with standard monorepo ignores (dist, prisma client, dev .db, logs, .tsbuildinfo).
- chore(git): Untrack generated artifacts now covered by .gitignore.

### Added
- chore(auth,sharing): Minimal `bcryptjs` module declaration to satisfy TS without extra deps.
- docs: Minimal OpenAPI (SoR-aligned) at `docs/openapi.yaml`.
- docs: Add `docs/env.example` with per-service `DATABASE_URL` guidance.
- feat(metadata): Catalog API endpoints `/api/v1/catalog` and `/api/v1/catalog/:slug` (Plan A) aggregating `catalog:*` tags with grayscale `catalog:public=true`.
- feat(gateway): Dev static mapping `/assets` -> repo `assetsReal`; proxy `/api/v1/catalog` -> metadata.
- feat(metadata): Import script `src/scripts/catalog-import.ts` and auto-scan script `src/scripts/catalog-scan.ts` for assetsReal → DB tags.
- feat(frontend): Download page fetches backend catalog with fallback to sample data.

### Fixed
- fix(frontend): Restore valid Vite React `package.json` (was accidentally overwritten).

### Notes
- Initialized fresh SQLite DBs for each service with `prisma db push` (no data migration needed).
- All services build successfully after the changes.


## v0.1.0 - 2025-09-08

### Added
- docs: Add docs/manage-services.md with quick start, commands, and env variables guidance.
- deps(storage): Add ioredis to support Redis-based download concurrency gating (storage service).

### Changed
- chore(ops): Enhance manage-services.sh
  - Corepack-pnpm setup helper (pnpm@9.7.0) and new commands: `setup`, `install`, `build`.
  - Environment helpers: `env:print` and `env:write` to print/write recommended env templates.
  - Start frontend dev with `pnpm dev` instead of `npm run dev` for consistency with workspace.
  - Pass through key env vars to storage service: `REDIS_URL`, `DOWNLOAD_CONCURRENCY_LIMIT`, `DOWNLOAD_Mbps`, `OWNER_COOKIE_SECRET`, `OWNER_COOKIE_TTL_SEC`.

### Notes
- Upcoming work (not part of this tag):
  - Implement Aliyun OSS STS issuance endpoint and frontend ali-oss multipart upload (keep TUS as fallback).
  - Refactor storage service into smaller modules to meet ≤200 lines/file guideline.
  - Fix/standardize .gitignore to avoid tracking build artifacts and IDE files.

