# Changelog

All notable changes to this repository will be documented in this file.

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

