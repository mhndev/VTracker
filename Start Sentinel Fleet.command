#!/bin/zsh
set -e
cd "$(dirname "$0")"

# Read a value from .env so the launcher follows the configured ports.
read_env() {
  local key="$1" fallback="$2" value
  value=$(awk -F= -v k="$key" '$1 ~ "^[[:space:]]*" k "[[:space:]]*$" { v=$2; for (i=3; i<=NF; i++) v=v "=" $i; print v }' .env 2>/dev/null \
    | tail -1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')
  echo "${value:-$fallback}"
}

PORTAL_PORT=$(read_env PORTAL_PORT 5173)
ADMIN_PORT=$(read_env ADMIN_PORT 5174)

if [ ! -d node_modules ]; then
  npm install
fi

# The API defaults to PostgreSQL: start it with Docker when available, otherwise
# fall back to SQLite so the demo still runs on a clean machine.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && docker compose up -d db; then
  echo "PostgreSQL container is running."
else
  echo "Docker/PostgreSQL unavailable — running the API on SQLite for this session."
  export DATABASE_DIALECT=sqlite
fi

npm run dev &
DEV_PID=$!
sleep 3
open "http://localhost:${PORTAL_PORT}"
open "http://localhost:${ADMIN_PORT}"
wait $DEV_PID
