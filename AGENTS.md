# AGENTS.md (Repo Operating Guide)

This file is for agentic coding tools operating in this repository.
Keep changes minimal, follow existing patterns, and prefer commands documented here.

## Repository Authority

- The active control plane is `services/core-api`; `services/storage`,
  `services/email-provider`, and `frontend/cruip-landing` remain active peers.
- The former split Auth/User/Metadata/Sharing/Gateway runtime is
  **SOFT-RETIRED** and excluded from default build, test, and deployment paths.
- Production authority is `infrastructure/alicloud/docker-compose.core.yml`
  with `infrastructure/alicloud/deploy.sh` and `rollback.sh`.
- Local multi-service startup is available only through the contracted
  Core-first `manage-services.sh` interface and project `mywebdrive-core-dev`.

## Repo Layout

- `services/core-api` — authoritative Node/TS control plane.
- `services/storage` — active storage API and worker.
- `services/email-provider` — private email delivery adapter.
- `packages/*` — shared libraries (`@mywebdrive/common`, `@mywebdrive/observability`).
- `services/core-api/prisma` — authoritative control-plane schema and migrations.
- `frontend/cruip-landing` — primary Next.js landing/app.
- `infrastructure/alicloud` — Core-first production compose and release scripts.

## Prereqs

- Node: `>= 20` (repo uses `corepack` + `pnpm@9.7.0`).
- Package manager: `pnpm` via `corepack`.
- Docker with Compose `>= 2.24.4` is required; the development overlay uses
  the Compose `!override` merge tag.

## Setup / Install

- Prepare protected local state and install deps: `./manage-services.sh setup`
- Start the Core-first stack: `./manage-services.sh start`
- Site: `http://127.0.0.1:8080`
- Full command contract: `docs/manage-services.md`

## Build / Typecheck

- Run the full fail-closed gate: `./manage-services.sh quality`
- Build the authoritative workspace: `pnpm run build:all`
- Typecheck authoritative project references: `pnpm run typecheck`
- Verify tracked generated artifacts: `pnpm run verify:generated`
- Verify source, OpenAPI, and active docs authority: `pnpm run verify:docs`

Notes:

- Active packages and services use TypeScript project references (`tsc -b`).
- Services are ESM (`"type": "module"`) and compile to untracked `dist/` output.

## Runtime and Smoke Testing

- `./manage-services.sh` is the contracted Core-first local lifecycle manager.
- Supported commands are exactly `setup`, `start`, `stop`, `status`,
  `logs [service]`, `config`, `smoke`, `quality`, `reset --confirm`, and
  `legacy:<command>`.
- `./manage-services.sh smoke` runs the isolated Core-first Docker smoke test;
  it builds images, creates disposable volumes, and cleans them afterward.
- Any unrecognized former command must warn `SOFT-RETIRED`, exit `64`, and must
  never start an archived stack.
- `legacy:<command>` is observation-only. Its retirement clock and deletion
  eligibility are defined by the event-based rule in `docs/manage-services.md`.

## Database (Prisma)

- Core migrations are the only active control-plane migration authority.
- Production migrations run through the release contract before service startup.
- Do not run or document split-service schema loops as a normal workflow.

## Tests

- Default authoritative tests: `pnpm run test:all`
- Repository authority contract: `bash scripts/test-repo-authority-contract.sh`
- Core release contracts: `bash scripts/test-core-release-contract.sh`
- Full container smoke: `./manage-services.sh smoke`
- Documentation authority tests: `pnpm run test:docs`
- Documentation and OpenAPI gate: `pnpm run verify:docs`
- Retired tests are opt-in only through `pnpm run test:legacy`.

## Lint / Format
This repo does not currently have a single unified root lint/format command.

Frontend:
- Landing lint: `pnpm -C frontend/cruip-landing lint` (Next lint)
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

### Security
- The public Nginx layer owns the external security-header and route boundary.
- Storage uses `helmet`; Core disables `x-powered-by` and validates dedicated secrets.
- Internal Core routes must remain unreachable from the public listener.
- Service health endpoints use `/live` and `/ready`; public Nginx uses `/healthz`.

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
- Production Core secrets must be present, sufficiently long, and pairwise distinct.

Key Environment Variables:
```bash
CORE_DATABASE_URL=postgresql://...      # Core control-plane database
REDIS_URL=redis://...                   # Core and storage coordination
CORE_SESSION_SECRET=...                 # Browser session signing
OTP_PEPPER=...                          # One-time-code protection
STORAGE_GRANT_SECRET=...                # Core-to-storage authorization
CORE_CALLBACK_SECRET=...                # Storage-to-Core callback signing
```

## Testing Style (Vitest)
- Tests commonly set env before importing the app:
  - `process.env.NODE_ENV = 'test'`
  - set required DB URL and secrets
  - `vi.resetModules()` if toggling env-dependent module init
- Supertest is used to test Express apps without listening on a port.

## Security & Hygiene
- Never commit secrets (`.env`, credentials, tokens).
- Prefer least-privilege error messages externally; log details internally.
- Keep raw SQL limited and constant; Core readiness uses a fixed `SELECT 1` probe.

## Git / PR expectations (for humans + agents)
- Conventional Commits with scope (example): `feat(core): rotate sessions`.
- Keep changes focused; avoid drive-by refactors.
