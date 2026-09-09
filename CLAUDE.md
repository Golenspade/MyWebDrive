# CLAUDE.md

Agent operating guide. Read `README.md` for repository authority, `CONTRIBUTING.md` for the contribution workflow, and `SECURITY.md` for security boundaries.

## Architecture

MyWebDrive is Core-first. `services/core-api` owns control-plane state and the Prisma history. `services/storage` owns object transfer and workers. `services/email-provider` is private. `frontend/cruip-landing` is the Web app. Local compose is `infrastructure/alicloud/docker-compose.core.yml` plus `infrastructure/docker-compose.core-dev.yml`.

The former split control plane is not on the default build, test, local start, or docs path. Recover it from git history if you need a comparison.

## Local interface

```bash
./manage-services.sh setup
./manage-services.sh start
./manage-services.sh stop
./manage-services.sh status
./manage-services.sh logs [service]
./manage-services.sh config
./manage-services.sh quality
./manage-services.sh smoke
./manage-services.sh reset --confirm
```

Site: `http://127.0.0.1:8080`. Compose project: `mywebdrive-core-dev`. Details: `docs/manage-services.md`. Unknown former commands exit 64.

## Checks

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
pnpm run test:docs
pnpm run verify:docs
bash scripts/test-repo-authority-contract.sh
bash scripts/test-core-dev-contract.sh
```

`./manage-services.sh quality` is the fail-closed gate without a running stack. `./manage-services.sh smoke` needs Docker and is optional.

## Boundaries

- Browser traffic is same-origin. Nginx sends Storage transfer paths to Storage, other public API paths to Core, and blocks private callbacks.
- Public API: `docs/openapi.yaml`. Operational endpoints and private callbacks are excluded.
- Core issues Storage Grants; Storage does not own control-plane state.
- Core migrations run before Core starts. Do not add a split-schema migration loop.
- Prisma clients, `dist`, `.next`, `.tsbuildinfo`, PID files, and frontend npm lockfiles stay untracked.

## Implementation

Node.js 20+, pnpm 9.7.0, strict TypeScript, ESM, two-space indent, single quotes, omitted semicolons. Prefer `unknown` plus narrowing over `any`. Do not commit secrets or generated output. Add a failing contract or test before changing authority, quota pool, migration, or documentation-verifier behavior.
