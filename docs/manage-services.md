# Core-first local development and repository authority

`manage-services.sh` is the supported local interface for MyWebDrive. It composes the production authority in `infrastructure/alicloud/docker-compose.core.yml` with the development overlay in `infrastructure/docker-compose.core-dev.yml` under the fixed project name `mywebdrive-core-dev`.

## Prerequisites

- Node.js 20+
- Corepack with the repository's `pnpm@9.7.0`
- Docker Engine
- Docker Compose 2.24.4 or newer; the overlay uses the `!override` merge tag

No checked-in development secret file is required. The manager creates `.state/core-dev.env` with owner-only permissions and preserves it across normal stop/reset operations. Do not copy or commit that file.

## First start

```bash
./manage-services.sh setup
./manage-services.sh start
```

`setup` creates protected local state when absent and runs `corepack pnpm install --frozen-lockfile`. `start` builds the Core-first images, removes orphans, starts the complete stack, and waits for Compose health checks.

- Site: <http://127.0.0.1:8080>
- Development email viewer: <http://127.0.0.1:8025>
- Compose project: `mywebdrive-core-dev`

The topology contains PostgreSQL, Redis, MinIO initialization, Core migration, Core API, analytics worker, private email adapter, Storage API, Storage worker, Prometheus, Web, and Nginx. Only Nginx and the development email viewer publish host-facing application ports.

## Exact command surface

| Command | Behavior |
|---|---|
| `./manage-services.sh help` | Print this supported interface, site, project, and Compose prerequisite. |
| `./manage-services.sh setup` | Prepare protected local state and install the frozen workspace. |
| `./manage-services.sh start` | Build and start the Core-first development stack with health waiting. |
| `./manage-services.sh stop` | Stop containers without deleting volumes or local secrets. |
| `./manage-services.sh status` | Show Compose status for the fixed development project. |
| `./manage-services.sh logs` | Show the latest 200 lines for the stack. |
| `./manage-services.sh logs <service>` | Show the latest 200 lines for one service after validating it against the Compose model. |
| `./manage-services.sh config` | Validate the merged Compose model and print its service names. |
| `./manage-services.sh smoke` | Run `scripts/smoke-core-e2e.sh` in an isolated project with disposable volumes. |
| `./manage-services.sh quality` | Run the root fail-closed quality gate without starting the stack. |
| `./manage-services.sh reset --confirm` | Remove local containers, volumes, and orphans while preserving `.state/core-dev.env`. |
| `./manage-services.sh legacy:<command>` | Invoke an archived command for observation only while the retirement policy permits it. |

Commands reject unexpected arguments. `logs` rejects option-like and undefined service names. `reset` requires the exact `--confirm` token. Any unrecognized former lifecycle command warns `SOFT-RETIRED`, exits 64, and does not start an archived stack.

## Daily workflow

```bash
./manage-services.sh start
./manage-services.sh status
./manage-services.sh logs core-api
./manage-services.sh stop
```

Use `config` when changing either Compose file. Use `reset --confirm` only when local data can be discarded. If the protected state file is invalid, move it aside manually after confirming it contains no value that must be preserved, then rerun `setup`; the manager fails closed rather than overwriting an unexpected file.

## Verification matrix

| Scope | Command | Docker required |
|---|---|---|
| Build | `pnpm run build:all` | No |
| TypeScript references | `pnpm run typecheck` | No |
| Package lint | `pnpm run lint:all` | No |
| Active package tests and generated-artifact contracts | `pnpm run test:all` | No |
| Documentation verifier tests | `pnpm run test:docs` | No |
| Source/OpenAPI/docs authority and OpenAPI lint | `pnpm run verify:docs` | No |
| Browser discovery | `pnpm run test:e2e --list` | No |
| Chromium UI, accessibility, and visual regression | `pnpm run test:e2e` | Running Core stack |
| Repository authority | `bash scripts/test-repo-authority-contract.sh` | No |
| Local manager contract | `bash scripts/test-core-dev-contract.sh` | No |
| Release contract | `bash scripts/test-core-release-contract.sh` | No |
| Cutover contract | `bash scripts/test-core-cutover-contract.sh` | No |
| Full quality gate | `./manage-services.sh quality` | No |
| Core-first end-to-end smoke | `./manage-services.sh smoke` | Yes |

Legacy tests are available only through `pnpm run test:legacy`; they are not part of the active quality or release authority.

## Browser and visual release gate

The browser suite uses Chromium only. Desktop tests run at `1440x900`; mobile tests run at `390x844`. It signs in through the real `/signin` form and retrieves the one-time code from the recipient-scoped, test-token-protected fake mailbox. The suite records neither traces nor video, and failure screenshots mask authentication inputs and fixed test identities before artifacts are considered for upload.

Committed snapshots under `e2e/snapshots/` are Linux-authoritative. A normal `pnpm run test:e2e` compares against them and must never rewrite them. Snapshot changes are reviewable product changes. Do not generate authoritative snapshots on macOS. Update them only by running the complete Compose gate with the six already-built release images and a Playwright `1.61.1` Linux container:

```bash
SMOKE_REUSE_IMAGES=1 \
SMOKE_BROWSER_GATE=1 \
SMOKE_BROWSER_CONTAINER_IMAGE=mcr.microsoft.com/playwright:v1.61.1-noble \
SMOKE_UPDATE_SNAPSHOTS=1 \
bash scripts/smoke-core-e2e.sh
git diff -- e2e/snapshots
```

CI performs the same browser checks after its six release images are built and before any image is published. On failure, only the allowlisted, sanitized directory selected by `SMOKE_ARTIFACT_DIR` may be uploaded.

## Public and private HTTP boundaries

The public API is defined in `docs/openapi.yaml`. Nginx routes grant-authorized Storage upload/object paths to Storage and other public API paths to Core. Private callbacks under `/api/v1/internal/*` and operational endpoints `/metrics`, `/live`, `/ready`, and `/version` are excluded from the public contract. The public listener exposes `/healthz` as the Nginx boundary check.

## Production authority

Local commands do not replace the release runbooks. Production uses:

- `infrastructure/alicloud/docker-compose.core.yml`
- `infrastructure/alicloud/deploy.sh`
- `infrastructure/alicloud/rollback.sh`
- `scripts/smoke-core-e2e.sh` for isolated pre-release behavior verification

Read `infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md` and `docs/runbooks/core-cutover-and-rollback.md`. Deploy only immutable `sha-<40 lowercase hex>` images through the scripts; do not manually bypass migrations, locks, health/version checks, digests, or manifests.

## Event-based soft-retirement policy

The former split control plane is archived under `archive/`. `legacy:<command>` may be used only for read-only comparison or evidence recovery; it must not support new development, schema changes, deployment, or production writes.

The retirement clock has not started. It starts only after the final production deploy, rollback, and redeploy acceptance is successful and has a recorded UTC completion timestamp. The earliest physical deletion is that timestamp plus 14 consecutive dependency-free 24-hour periods. Until that evidence exists and the full period completes, neither the compatibility entrypoint nor the archive is eligible for deletion. Documentation, CI, and release tooling must never depend on the observation window.
