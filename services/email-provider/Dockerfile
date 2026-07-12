FROM node:20.18.3-alpine3.21 AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY services/email-provider/package.json services/email-provider/package.json
RUN pnpm install --frozen-lockfile --filter email-provider...
COPY services/email-provider services/email-provider
RUN pnpm --filter email-provider build

FROM node:20.18.3-alpine3.21 AS runtime

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/email-provider/package.json ./services/email-provider/package.json
COPY --from=build --chown=node:node /workspace/services/email-provider/node_modules ./services/email-provider/node_modules
COPY --from=build --chown=node:node /workspace/services/email-provider/dist ./services/email-provider/dist
USER node
EXPOSE 8090
WORKDIR /workspace/services/email-provider
CMD ["node", "dist/index.js"]
