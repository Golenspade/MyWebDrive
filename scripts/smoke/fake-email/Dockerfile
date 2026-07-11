FROM node:20.18.3-alpine3.21
WORKDIR /app
COPY scripts/smoke/fake-email/server.mjs ./server.mjs
USER node
EXPOSE 8025
CMD ["node", "server.mjs"]
