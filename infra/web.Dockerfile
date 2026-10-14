# syntax=docker/dockerfile:1
# OPS-1, SEC-12: build with Node, serve static files from an unprivileged nginx.

FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci -w @learnloop/shared -w @learnloop/web --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @learnloop/shared && npm run build -w @learnloop/web

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
