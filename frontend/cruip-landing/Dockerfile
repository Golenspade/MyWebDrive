# syntax=docker/dockerfile:1

ARG PNPM_VERSION=9.7.0
FROM node:20.18.3-bookworm-slim AS builder
ARG PNPM_VERSION
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend ./frontend
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN pnpm -C frontend/cruip-landing install --frozen-lockfile
RUN pnpm -C frontend/cruip-landing build

FROM node:20.18.3-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=4323
ENV HOSTNAME=0.0.0.0
WORKDIR /workspace/frontend/cruip-landing
COPY --from=builder --chown=node:node /workspace/frontend/cruip-landing/.next/standalone /workspace
COPY --from=builder --chown=node:node /workspace/frontend/cruip-landing/.next/static ./.next/static
COPY --from=builder --chown=node:node /workspace/frontend/cruip-landing/public ./public
USER node
EXPOSE 4323
CMD ["node", "server.js"]
