# syntax=docker/dockerfile:1
# OPS-1, SEC-12: multi-stage build, slim base image, runs as a non-root user.

FROM node:26-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci -w @learnloop/shared -w @learnloop/api --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @learnloop/shared && npm run build -w @learnloop/api

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci -w @learnloop/api --omit=dev --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
RUN chown -R node:node /app/node_modules/.prisma
USER node
WORKDIR /app/apps/api
EXPOSE 4000
# Demo convenience: apply migrations and seed (idempotent) on start. Production
# deployments run `prisma migrate deploy` as a separate, controlled step (OPS-9).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && node dist/server.js"]
