# syntax=docker/dockerfile:1

ARG PNPM_VERSION=9.7.0
FROM node:20-bullseye AS builder
WORKDIR /workspace
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN pnpm install --frozen-lockfile
RUN pnpm -r --filter ./packages/** build
RUN pnpm -r --filter ./services/auth build
RUN pnpm --filter ./services/auth prisma:generate
RUN pnpm prune --prod

FROM node:20-bullseye AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /workspace/packages ./packages
COPY --from=builder /workspace/services ./services
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /workspace/package.json ./package.json
EXPOSE 7091
CMD ["node","services/auth/dist/index.js"]
