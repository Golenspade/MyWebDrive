# Contributing to MyWebDrive

Thank you for contributing. Read `AGENTS.md` before editing; it defines repository authority, code style, security boundaries, and required tests.

## Development setup

Prerequisites are Node.js 20+, Corepack, Docker Engine, and Docker Compose 2.24.4+.

```bash
git clone <your-fork>
cd MyWebDrive
./manage-services.sh setup
./manage-services.sh start
```

The Core-first site is available at `http://127.0.0.1:8080` in the `mywebdrive-core-dev` Compose project. See `docs/manage-services.md` for the exact command surface.

## Pull requests

1. Keep the change focused and follow existing patterns.
2. Add or update tests before behavior changes.
3. Run `./manage-services.sh quality`.
4. Run `./manage-services.sh smoke` when the change affects the container runtime or end-to-end API flow.
5. Use a scoped Conventional Commit, such as `feat(core): rotate sessions`.
6. Describe verification and any remaining risk in the pull request.

Useful narrow gates:

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
pnpm run verify:docs
bash scripts/test-repo-authority-contract.sh
bash scripts/test-core-dev-contract.sh
bash scripts/test-core-release-contract.sh
```

Historical tests are opt-in with `pnpm run test:legacy` and are not evidence for the current Core-first authority.

## Repository boundaries

- Core control-plane work belongs in `services/core-api` and its Prisma history.
- Object-transfer and storage-worker work belongs in `services/storage`.
- Email delivery stays behind the private adapter in `services/email-provider`.
- The active frontend is `frontend/cruip-landing`.
- Production changes must preserve `infrastructure/alicloud/docker-compose.core.yml`, `infrastructure/alicloud/deploy.sh`, `infrastructure/alicloud/rollback.sh`, and `scripts/smoke-core-e2e.sh` as the release authority.

The archived split control plane is **SOFT-RETIRED**. Its 14-day observation window ends after 2026-07-26; do not base new code, schema changes, or deployment instructions on it.

## Security and conduct

Never commit secrets, credentials, database dumps, or generated artifacts. Report vulnerabilities according to `SECURITY.md`, and follow `CODE_OF_CONDUCT.md` in all project spaces.
