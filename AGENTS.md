# AGENTS.md (Repo Operating Guide)

This file is for agentic coding tools operating in this repository.
Keep changes minimal, follow existing patterns, and prefer commands documented here.

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## Repo Layout
- `services/*` — Node/TS microservices (Express). Entry: `src/index.ts`.
- `packages/*` — shared libraries (`@mywebdrive/common`, `@mywebdrive/observability`).
- `services/*/prisma` — Prisma schema and generated client in each service.
- `frontend/cruip-landing` — primary Next.js landing/app.
- `apps/web` — smaller Next.js demo app.
- `infrastructure/` — docker compose, deploy scripts.

## Prereqs
- Node: `>= 20` (repo uses `corepack` + `pnpm@9.7.0`).
- Package manager: `pnpm` via `corepack`.
- Database: PostgreSQL 14+ (required for backend tests and many services).

## Setup / Install
- Install workspace deps: `pnpm -w install`
- (Optional) ensure pnpm via script: `./manage-services.sh setup`

## Build / Typecheck
- Build everything (workspace): `pnpm run build:all`
- Build everything (Make wrapper): `make build`
- Typecheck root references: `pnpm run typecheck`
- Clean dist folders: `pnpm run clean`

Notes:
- Backend packages/services use TypeScript project references (`tsc -b`).
- Services are ESM (`"type": "module"`) and compile to `dist/`.

## Run Services (Local Dev)
- Start Postgres (docker): `./manage-services.sh db:start`
- Start backend stack: `./manage-services.sh start-backend`
- Start frontend (landing): `./manage-services.sh start-frontend`
- Start frontend (prod mode): `./manage-services.sh start-frontend-prod`
- Start Next demo: `./manage-services.sh start-next`
- Status dashboard (ports + health): `./manage-services.sh status`

Per-service dev (watch mode):
- Example: `pnpm -C services/auth dev`
- Example: `pnpm -C services/metadata dev`

## Database (Prisma)
- Generate Prisma client (service-local): `pnpm -C services/auth prisma:generate`
- Push schema (service-local, if available): `pnpm -C services/metadata db:push`
- Loop push (common dev workflow):
  `for svc in auth user metadata storage sharing api-gateway-node; do pnpm -C services/$svc db:push || true; done`

## Tests
### Unit/Integration (Vitest)
Currently, Vitest is used in:
- `services/auth` (`pnpm -C services/auth test`)
- `services/metadata` (`pnpm -C services/metadata test`)

Run all tests in a service:
- `pnpm -C services/auth test`
- `pnpm -C services/metadata test`

Run a single test file:
- `pnpm -C services/auth test -- tests/auth-api.test.ts`
- `pnpm -C services/metadata test -- tests/metadata-api.test.ts`

Run a single test by name (pattern):
- `pnpm -C services/auth test -- tests/auth-api.test.ts -t "register"`
- `pnpm -C services/metadata test -- tests/metadata-api.test.ts -t "creates folder"`

Watch mode (when needed):
- `pnpm -C services/auth exec vitest --watch`
- `pnpm -C services/metadata exec vitest --watch`

Test DB requirements:
- Tests expect Postgres reachable (see test files for default URLs).
- Common defaults used in tests:
  - `AUTH_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/auth?schema=public`
  - `METADATA_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/metadata?schema=public`
- Start DB quickly: `./manage-services.sh db:start`

### Smoke scripts
- Guest download smoke: `GATEWAY_PORT=9080 bash ./test_guest_download.sh`
- Invitation flows: `bash ./test_invitation_flow.sh`, `bash ./test_invitation_system.sh`

## Lint / Format
This repo does not currently have a single unified root lint/format command.

Frontend:
- Landing lint: `pnpm -C frontend/cruip-landing lint` (Next lint)
- Demo lint: `pnpm -C apps/web lint` (Next lint)
- Make wrapper (frontend lint): `make lint`

Formatting:
- There is no repo-wide Prettier/Biome config detected at root.
- Follow existing style (see “Code Style” below). If you add tooling, keep it scoped and aligned.

## Cursor / Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found in this repo.
- If these files are added later, treat them as higher-priority agent instructions.

## Code Style (TypeScript / Node / Express)
### Formatting
- Indent: 2 spaces.
- Quotes: single quotes.
- Semicolons: omitted.
- Keep lines readable; prefer small helper functions over long blocks.

### Module system & imports
- Services/packages are ESM (`"type": "module"`).
- When importing compiled output (especially in tests), use `.js` extensions as seen in:
  - `import('../src/index.js')`
- Import ordering (preferred):
  1) Node built-ins (`crypto`, `fs/promises`, `path`)
  2) External deps (`express`, `jsonwebtoken`, `vitest`)
  3) Workspace deps (`@mywebdrive/common`, `@mywebdrive/observability`)
  4) Relative imports
- Avoid duplicate imports (`no-duplicate-imports` enforced in frontend configs).

### Naming
- Filenames: kebab-case.
- Types: `PascalCase`.
- Variables/functions: `camelCase`.
- Constants/env keys: `UPPER_SNAKE_CASE`.
- HTTP routes: `/api/v1/...`.

### Types & safety
- TypeScript is strict (see `tsconfig.base.json`).
- Avoid `any`; prefer `unknown` + narrowing. If unavoidable, keep `any` localized.
- Parse numbers safely:
  - `parseInt(value, 10)`
  - validate with `Number.isFinite` and clamp ranges.
- Define request/response shapes with small inline types (pattern used in services).

### Error handling
- Express handlers generally follow:
  - validate inputs early → `return res.status(400/401/403/404).json({ error: '...' })`
  - wrap async handlers in `try/catch` and `next(err)` on failure
- Prefer a single “unified error handler” middleware at the bottom of the service.
- Use structured logging for unexpected errors (see `logger.error({ err, status }, ...)`).
- Only swallow errors intentionally for best-effort operations (and keep it narrow).

### Logging / Observability
- Use `@mywebdrive/observability` helpers:
  - `createLogger({ service: '...' })`
  - `createHttpLogger(logger)` for request logs
  - `createMetrics('service-name')` for Prometheus-style metrics
- Avoid `console.log` in services; allow `console.warn/error` in scripts and tooling.

### Env vars & configuration
- Prefer central helpers from `packages/common`:
  - `getEnv(key, fallback?)`
  - `requireEnvs([...])`
- Don’t hardcode secrets.
- Several services enforce non-default `JWT_SECRET` outside `NODE_ENV=test`.

## Testing Style (Vitest)
- Tests commonly set env before importing the app:
  - `process.env.NODE_ENV = 'test'`
  - set required DB URL and secrets
  - `vi.resetModules()` if toggling env-dependent module init
- Supertest is used to test Express apps without listening on a port.

## Security & Hygiene
- Never commit secrets (`.env`, credentials, tokens).
- Prefer least-privilege error messages externally; log details internally.
- Be careful with raw SQL (`$executeRawUnsafe` exists in metadata as best-effort init).

## Git / PR expectations (for humans + agents)
- Conventional Commits with scope (example): `feat(auth): refresh tokens`.
- Keep changes focused; avoid drive-by refactors.
