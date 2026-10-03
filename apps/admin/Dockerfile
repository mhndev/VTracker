# syntax=docker/dockerfile:1

# --- Build stage: Node 24 -----------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspaces --include-workspace-root || npm install
COPY apps/admin ./apps/admin
RUN npm --workspace @sentinel/admin run build

# --- Runtime stage: static build behind nginx ---------------------------------
# The admin console is a separate deployment so its plane can be network-isolated.
FROM nginx:alpine AS runtime
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/admin /usr/share/nginx/html
EXPOSE 80
