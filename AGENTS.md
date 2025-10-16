# Repository Guidelines

## Project Structure & Module Organization
- `services/` — Node microservices (`auth`, `user`, `metadata`, `storage`, `sharing`, `api-gateway-node`). Each service runs from `src/index.ts` and may include `prisma/`.
- `packages/` — shared libraries (`common`, `observability`).
- `apps/web/` — Next.js experiments (optional).
- `frontend/cruip-landing/` — primary Next.js site.
- `docs/`, `scripts/`, `infrastructure/` — docs, helper scripts, deployment.
- Tests live beside code: `src/__tests__/*.test.ts`.

## Build, Test, and Development Commands
- Prereqs: Node 20+, `pnpm`. Install: `pnpm -w install`.
- Build all TS packages: `pnpm run build:all` or `make build`.
- Dev per service: `pnpm -C services/auth dev` (replace `auth` as needed).
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
- Keep smoke scripts idempotent; document prerequisites. Example: run gateway and then `test_guest_download.sh`.

## Commit & Pull Request Guidelines
- Conventional Commits with scopes (e.g., `feat(auth): refresh tokens`); keep changes small.
- PRs include description, linked issues, verification steps, and UI screenshots when relevant; call out env changes.
- Run the quality gate before review: `make quality-check` (build + test + lint).

## Security & Configuration Tips
- Create env file: `cp docs/env.example .env` or `./manage-services.sh env:write .env`.
- Never commit secrets; rotate `JWT_SECRET`.
- Dev SQLite DBs live under `services/*/prisma/*.db` — do not use in production.

## Agent-Specific
- This file applies repo‑wide; more nested AGENTS.md files, if present, override within their directories.

