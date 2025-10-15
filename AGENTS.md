# Repository Guidelines

## Project Structure & Module Organization
- `services/` — Node microservices (`auth`, `user`, `metadata`, `storage`, `sharing`, `api-gateway-node`). Each uses `src/index.ts` and may include `prisma/`.
- `packages/` — shared libraries (`common`, `observability`).
- `apps/web/` — optional Next.js experiments.
- `frontend/cruip-landing/` — primary Next.js site.
- `docs/`, `scripts/`, `infrastructure/` — documentation, helper scripts, deployment.
- Tests live beside code: `src/__tests__/*.test.ts`.

## Build, Test, and Development Commands
- Prereqs: Node 20+, `pnpm`.
- Install deps: `pnpm -w install`.
- Build all TS packages: `pnpm run build:all` or `make build`.
- Dev per service: `pnpm -C services/auth dev` (apply to other services).
- Start backend: `./manage-services.sh start-backend`.
- Start frontend (landing): `./manage-services.sh start-frontend` (http://127.0.0.1:3100).
- Start Next demo: `./manage-services.sh start-next` (http://127.0.0.1:4000).
- Smoke tests: `GATEWAY_PORT=9080 bash ./test_guest_download.sh` (see also `test_invitation_flow.sh`, `test_invitation_system.sh`).

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Module resolution: NodeNext/Bundler per service.
- Formatting: 2‑space indent, single quotes, omit semicolons; match existing code.
- Filenames: kebab‑case modules; service entry at `src/index.ts`.
- Exports: prefer named exports; keep functions small and well‑typed.
- Env vars: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`). HTTP paths under `/api/v1/*`.

## Testing Guidelines
- No fixed unit test framework; coverage not enforced.
- Place tests under `src/__tests__/*.test.ts` next to relevant code.
- Use smoke scripts against the Node gateway; ensure idempotency and document prerequisites.

## Commit & Pull Request Guidelines
- Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`; use scopes (e.g., `feat(auth): refresh tokens`). Keep small and focused.
- PRs include description, linked issues, verification steps, and UI screenshots when relevant; call out env changes.
- Quality gate: `make quality-check` (build + test + lint) before review.

## Security & Configuration Tips
- Create env file: `cp docs/env.example .env` or `./manage-services.sh env:write .env`.
- Never commit secrets; rotate `JWT_SECRET`.
- Dev SQLite DBs: `services/*/prisma/*.db` — do not use in production.

