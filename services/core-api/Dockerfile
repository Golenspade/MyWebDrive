FROM node:20.18.3-alpine3.21 AS build

WORKDIR /workspace
RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY services/core-api/package.json services/core-api/package.json
RUN pnpm install --frozen-lockfile --filter core-api...
COPY packages/common packages/common
COPY packages/observability packages/observability
COPY services/core-api services/core-api
RUN pnpm --filter core-api... build

FROM node:20.18.3-alpine3.21 AS runtime

ENV NODE_ENV=production
WORKDIR /workspace
RUN apk add --no-cache openssl
COPY --from=build --chown=node:node /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/core-api/package.json ./services/core-api/package.json
COPY --from=build --chown=node:node /workspace/services/core-api/node_modules ./services/core-api/node_modules
COPY --from=build --chown=node:node /workspace/services/core-api/dist ./services/core-api/dist
COPY --from=build --chown=node:node /workspace/services/core-api/prisma ./services/core-api/prisma
COPY --from=build --chown=node:node /workspace/packages/observability/package.json ./packages/observability/package.json
COPY --from=build --chown=node:node /workspace/packages/observability/dist ./packages/observability/dist
COPY --from=build --chown=node:node /workspace/packages/observability/node_modules ./packages/observability/node_modules
USER node
EXPOSE 8080
WORKDIR /workspace/services/core-api
CMD ["node", "dist/index.js", "api"]
