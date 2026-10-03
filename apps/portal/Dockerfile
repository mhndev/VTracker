# syntax=docker/dockerfile:1

# --- Build stage: Node 24 -----------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspaces --include-workspace-root || npm install
COPY apps/portal ./apps/portal
RUN npm --workspace @sentinel/portal run build

# --- Runtime stage: static build behind nginx ---------------------------------
FROM nginx:alpine AS runtime
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/portal /usr/share/nginx/html
EXPOSE 80
