# syntax=docker/dockerfile:1

# --- Build stage: Node 24 -----------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/admin/package.json ./apps/admin/package.json
RUN npm install --workspaces --include-workspace-root || npm install
COPY apps/api ./apps/api
RUN npm run build:api || npm --workspace @sentinel/api run build

# --- Runtime stage: Node 24, production dependencies only ---------------------
# node:24-slim keeps glibc so the sqlite3 native module resolves without a build
# toolchain. Only the API workspace's production dependencies are installed.
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/admin/package.json ./apps/admin/package.json
RUN npm install --omit=dev --workspace @sentinel/api --include-workspace-root || npm install --omit=dev \
    && mkdir -p /app/.data && chown -R node:node /app/.data
COPY --from=build /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.API_PORT || 8787}/api/health`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "apps/api/dist/src/server.js"]