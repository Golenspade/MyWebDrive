# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Email `154531132+Golenspade@users.noreply.github.com` with the affected revision, reproduction steps, impact, and any suggested mitigation. Avoid including live credentials or personal data; arrange a private transfer channel when sensitive evidence is necessary.

## Current security boundary

- Nginx is the only public listener in the supported topology.
- Public browser traffic is same-origin and limited to the API documented in `docs/openapi.yaml`.
- `/api/v1/internal/*`, `/metrics`, `/live`, `/ready`, and `/version` are private or operational surfaces and are not public API.
- Core access, browser Session refresh, Storage Grants, and callback signing use distinct secrets.
- Storage validates a grant's purpose and Object binding; download grants are single-use.
- Core owns control-plane migrations; production runs them through `infrastructure/alicloud/deploy.sh` before service startup.
- Production rollback uses `infrastructure/alicloud/rollback.sh` and recorded release manifests, not destructive volume deletion.

The supported production topology is defined by `infrastructure/alicloud/docker-compose.core.yml`. Configuration values, current service health, and external provider delivery state are environment-specific and must be verified during deployment rather than inferred from documentation.

## Contributor hygiene

- Never commit `.env` files, credentials, tokens, database backups, private keys, or generated native binaries.
- Use sufficiently long, pairwise-distinct production secrets for Core Sessions, OTP protection, Storage Grants, Core callbacks, and the private email adapter.
- Keep databases, Redis, object storage, Core, Storage, metrics, and Web container ports private behind Nginx.
- Do not log Authorization headers, cookies, share tokens, URL queries, one-time codes, or secret values.
- Run `./manage-services.sh quality` before merging. Run `./manage-services.sh smoke` for runtime-boundary changes.

The archived split control plane is **SOFT-RETIRED** and must not receive security fixes as a substitute for fixing the active Core-first runtime. Its observation-only compatibility window ends after 2026-07-26.
