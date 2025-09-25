# Changelog

All notable changes to this repository will be documented in this file.

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

