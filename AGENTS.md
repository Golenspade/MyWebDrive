# Repository Guidelines

## Project Structure & Module Organization
- `services/` — Node microservices (`auth`, `user`, `metadata`, `storage`, `sharing`, `api-gateway-node`), each with `src/index.ts` and optional `prisma/`.
- `packages/` — shared libraries (`common`, `observability`).
- `apps/web/` — optional Next.js app for experiments.
- `frontend/cruip-landing/` — primary Next.js site.
- `docs/`, `scripts/`, `infrastructure/` — documentation, helper scripts, deploy.

## Build, Test, and Development Commands
- Install deps (Node 20+): `pnpm -w install`
- Build all TS packages: `pnpm run build:all` or `make build`
- Start backend (gateway + services): `./manage-services.sh start-backend`
- Start frontend (cruip-landing): `./manage-services.sh start-frontend` (http://127.0.0.1:3100)
- Start Next demo: `./manage-services.sh start-next` (http://127.0.0.1:4000)
- Per‑service dev: `pnpm -C services/auth dev` (similar for others)
- Smoke tests: `GATEWAY_PORT=9080 bash ./test_guest_download.sh` (see also `test_invitation_flow.sh`, `test_invitation_system.sh`)

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Module resolution: NodeNext/Bundler (per service tsconfig).
- Indentation: 2 spaces; quotes: single; semicolons: omit (match existing code).
- File names: kebab‑case for modules; service entry `src/index.ts`.
- Exports: prefer named exports for libraries; keep functions small and typed.
- Env vars: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`); HTTP paths under `/api/v1/*`.

## Testing Guidelines
- No unit test framework enforced yet; coverage not required.
- Prefer adding unit tests alongside code under `src/__tests__/*.test.ts` when introducing new modules.
- Use provided smoke scripts against the Node gateway (9080). Ensure scripts are idempotent and document any prerequisites.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`.
- Commits: small, focused; include scope when helpful (e.g., `feat(auth): refresh tokens`).
- PRs: clear description, linked issues, steps to verify, screenshots for UI, note env changes. Run `make quality-check` (build+test+lint) before requesting review.

## Security & Configuration Tips
- Create env file: `cp docs/env.example .env` or `./manage-services.sh env:write .env`.
- Never commit secrets. Rotate `JWT_SECRET`. Dev SQLite DBs live under `services/*/prisma/*.db` — keep out of production.
