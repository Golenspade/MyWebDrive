# syntax=docker/dockerfile:1

ARG PNPM_VERSION=9.7.0
FROM node:20-bullseye AS builder
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend ./frontend
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN pnpm -C frontend/cruip-landing install --frozen-lockfile
RUN pnpm -C frontend/cruip-landing build

FROM node:20-bullseye AS runner
ENV NODE_ENV=production
# Next standalone expects these
ENV PORT=4323
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Copy Next.js standalone output (includes minimal node_modules)
COPY --from=builder /workspace/frontend/cruip-landing/.next/standalone ./
# Provide pnpm store for symlinked modules expected by standalone's node_modules
COPY --from=builder /workspace/node_modules/.pnpm /node_modules/.pnpm
COPY --from=builder /workspace/node_modules/.modules.yaml /node_modules/.modules.yaml
# Static assets
COPY --from=builder /workspace/frontend/cruip-landing/.next/static ./.next/static
COPY --from=builder /workspace/frontend/cruip-landing/public ./public
EXPOSE 4323
CMD ["node","server.js"]
