# Repository Guidelines

## Project Structure & Module Organization
- `services/` — microservices (`auth`, `user`, `metadata`, `storage`, `sharing`, `api-gateway-node`), each starts at `src/index.ts`; some include `prisma/`.
- `packages/` — shared libs: `common`, `observability`.
- `apps/web/` — Next.js experiments (optional).
- `frontend/cruip-landing/` — primary Next.js site (production landing).
- `docs/`, `scripts/`, `infrastructure/` — docs, helper scripts, deployment assets.
- Tests live beside code: `src/__tests__/*.test.ts`.

## Build, Test, and Development Commands
- Prereqs: Node 20+ and `pnpm`. Install: `pnpm -w install`.
- Build TypeScript for all packages/services: `pnpm run build:all` or `make build`.
- Develop a service locally: `pnpm -C services/auth dev` (replace `auth`).
- Run backend services: `./manage-services.sh start-backend`.
- Start frontend (landing): `./manage-services.sh start-frontend` → http://127.0.0.1:3100.
- Start Next demo: `./manage-services.sh start-next` → http://127.0.0.1:4000.
- Smoke tests: `GATEWAY_PORT=9080 bash ./test_guest_download.sh` (see also `test_invitation_flow.sh`, `test_invitation_system.sh`).
- Quality gate (build + test + lint): `make quality-check`.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Module resolution: NodeNext/Bundler per service.
- Formatting: 2‑space indent, single quotes, omit semicolons; follow existing style.
- Filenames: kebab‑case; service entry at `src/index.ts`.
- Prefer named exports; keep functions small and well‑typed.
- Env vars: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`). HTTP paths under `/api/v1/*`.

## Testing Guidelines
- Place tests under `src/__tests__/*.test.ts` next to relevant code.
- No fixed unit test framework; coverage not enforced.
- Keep smoke scripts idempotent; document prerequisites in the script header.
- Run the quality gate before PRs: `make quality-check`.

## Commit & Pull Request Guidelines
- Use Conventional Commits with scopes (e.g., `feat(auth): refresh tokens`).
- PRs include description, linked issues, verification steps, and UI screenshots when relevant; explicitly call out env changes.

## Security & Configuration Tips
- Create an env file: `cp docs/env.example .env` or `./manage-services.sh env:write .env`.
- Never commit secrets; rotate `JWT_SECRET` regularly.
- Services use PostgreSQL; set `<SERVICE>_DATABASE_URL` (e.g., `AUTH_DATABASE_URL=postgres://...`). Legacy `*.db` files are deprecated.

## Agent‑Specific Notes
- This file applies repo‑wide; nested `AGENTS.md` files override within their directories.
- When editing code, respect local conventions and keep changes minimal and focused.
