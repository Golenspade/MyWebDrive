# Developer Guide: System of Record (SoR) and Prisma Client Standardization

This document explains the architectural decisions and practical steps that were applied in this repo to:
- Establish clear System of Record (SoR) boundaries between services
- Standardize Prisma Client usage per service to avoid cross-service schema overwrites in a monorepo with NodeNext

## Scope
Services covered: Auth, User, Metadata, Storage, Sharing.

## 1) SoR boundaries
- Auth (SoR for identity): id, email, password (hash), role, timestamps
- User (SoR for profile/quotas): id (same as Auth), name, storageQuota, storageUsed, timestamps

Implications:
- User DB no longer stores email/password/role
- Role is carried in JWT and read at runtime, not persisted in User DB
- Client-facing aggregation of identity+profile should be done via API Gateway/BFF

Recommended write paths:
- Update password/role → Auth
- Update display name/quota/usage → User

## 2) Prisma Client standardization (per service)
Problem avoided: In a monorepo, using the default @prisma/client for multiple services can lead to the last generated client overwriting type definitions for others.

Solution applied:
- Generate a Prisma Client per service into that service’s own folder and import locally from code.

Schema setting (example):
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./client"
}
```

TypeScript imports (NodeNext):
- Auth: `import { PrismaClient } from '../prisma/client'`
- User/Sharing (NodeNext requires explicit extension when path-resolving ESM):
  `import { PrismaClient } from '../prisma/client/index.js'`
- Metadata/Storage already import from '../prisma/client' (works depending on tsconfig/module resolution); prefer keeping consistent with NodeNext and using explicit file extension when needed.

tsconfig notes:
- If you set `tsBuildInfoFile`, enable `"composite": true`.

Minimal type declaration for packages without types:
- If a service imports `bcryptjs`, but you don't want to install @types for it, add:
  - `src/types/bcryptjs.d.ts` with `declare module 'bcryptjs';`

## 3) Local initialization (dev)
Each service uses its own SQLite DB file. Minimal init:

- Auth
  - `DATABASE_URL="file:./services/auth/prisma/auth.db" pnpm -C services/auth prisma:generate`
  - `DATABASE_URL="file:./services/auth/prisma/auth.db" pnpm -C services/auth exec prisma db push --accept-data-loss`

- User
  - `DATABASE_URL="file:./services/user/prisma/user.db" pnpm -C services/user prisma:generate`
  - `DATABASE_URL="file:./services/user/prisma/user.db" pnpm -C services/user db:push --accept-data-loss`

- Metadata
  - `METADATA_DATABASE_URL="file:./services/metadata/prisma/metadata.db" pnpm -C services/metadata prisma:generate`
  - `METADATA_DATABASE_URL="file:./services/metadata/prisma/metadata.db" pnpm -C services/metadata db:push --accept-data-loss`

- Storage
  - `STORAGE_DATABASE_URL="file:./services/storage/prisma/storage.db" pnpm -C services/storage prisma:generate`
  - `STORAGE_DATABASE_URL="file:./services/storage/prisma/storage.db" pnpm -C services/storage db:push --accept-data-loss`

- Sharing
  - `SHARING_DATABASE_URL="file:./services/sharing/prisma/sharing.db" pnpm -C services/sharing prisma:generate`
  - `SHARING_DATABASE_URL="file:./services/sharing/prisma/sharing.db" pnpm -C services/sharing db:push --accept-data-loss`

## 4) Build verification
- Run: `pnpm -C services/<name> build`
- The script executes `tsc -b && prisma generate`

## 5) Common pitfalls and resolutions
- Pitfall: Using `@prisma/client` across services in a monorepo overwrites types.
  - Fix: Per-service `generator output = "./client"`, import from local client path.
- Pitfall: NodeNext needs explicit extension for relative ESM imports.
  - Fix: `.../client/index.js` in TS source where needed.
- Pitfall: `tsconfig.json` uses `tsBuildInfoFile` without `composite`.
  - Fix: Add `"composite": true`.
- Pitfall: Missing types for `bcryptjs` causes TS7016.
  - Fix: Add `src/types/bcryptjs.d.ts` with `declare module 'bcryptjs';`.
- Pitfall (storage): Duplicate `Transform` import and invalid `Worker` option `type: 'module'`.
  - Fix: Remove duplicate import; remove `type: 'module'` from `new Worker(...)` options.

## 6) Migration note
- Current repositories have empty DBs; we performed schema refactors without data migration.
- If data exists in the future and you need to split/merge fields between services, perform data migration first, then drop/alter columns.

## 7) Checklist (for new or changed services)
- [ ] Define SoR ownership for all fields (Auth vs User vs Others)
- [ ] Set Prisma generator output to `./client`
- [ ] Import `PrismaClient` from local client path; use explicit `.js` if NodeNext requires it
- [ ] Ensure tsconfig has `composite: true` if using `tsBuildInfoFile`
- [ ] Provide minimal d.ts for libraries without types where needed
- [ ] Initialize SQLite via `prisma db push`
- [ ] `pnpm -C services/<name> build` passes
- [ ] Add an entry to CHANGELOG

