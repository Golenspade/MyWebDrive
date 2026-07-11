FROM node:20.18.3-alpine3.21 AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY services/storage/package.json services/storage/package.json
RUN pnpm install --frozen-lockfile --filter storage-service-node...
COPY packages/common packages/common
COPY packages/observability packages/observability
COPY services/storage services/storage
RUN pnpm --filter storage-service-node build

FROM node:20.18.3-alpine3.21 AS runtime

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/storage/package.json ./services/storage/package.json
COPY --from=build --chown=node:node /workspace/services/storage/node_modules ./services/storage/node_modules
COPY --from=build --chown=node:node /workspace/services/storage/dist ./services/storage/dist
USER node
EXPOSE 7084 7085
WORKDIR /workspace/services/storage
CMD ["node", "dist/index.js", "api"]
