# syntax=docker/dockerfile:1

# --- Build stage: Node 24 -----------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY src/apps/portal/package.json ./src/apps/portal/package.json
COPY src/apps/admin/package.json ./src/apps/admin/package.json
COPY src/apps/api/package.json ./src/apps/api/package.json
COPY src/packages/ui/package.json ./src/packages/ui/package.json
RUN npm install --workspaces --include-workspace-root || npm install
COPY src/apps/portal ./src/apps/portal
COPY src/packages/ui ./src/packages/ui
RUN npm --workspace @sentinel/portal run build

# --- Runtime stage: static build behind nginx ---------------------------------
FROM nginx:alpine AS runtime
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/portal /usr/share/nginx/html
EXPOSE 80
