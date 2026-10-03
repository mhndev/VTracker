# Business

The business is usually called a GPS vehicle tracking company or vehicle telematics company.

The website/software can be called:

GPS fleet tracking platform
Vehicle tracking platform
Telematics platform
Connected car / vehicle monitoring platform

The overall business model is often GPS tracking + hardware installation + SaaS subscription.

# Sentinel Fleet — Safe Local MVP

A runnable multi-tenant vehicle tracking demonstrator derived from RFC-001 Review.

## Application structure

```text
apps/portal/   Customer and reseller React + TypeScript portal   (PORTAL_PORT, default 5173)
apps/admin/    Isolated platform-admin React + TypeScript console (ADMIN_PORT,  default 5174)
apps/api/      Express 5 + TypeScript + Sequelize API             (API_PORT,    default 8787)
```

Every port is configured in `.env` (`API_PORT`, `PORTAL_PORT`, `ADMIN_PORT`, plus `WEB_HOST` for the
Vite dev servers) and consumed by the API, both Vite configs, and `docker-compose.yml`.

The admin console is not a role-hidden page inside the portal. It is a separate build, entry point, navigation system, development server, and API surface. Its platform overview returns operational aggregates and deliberately omits coordinates.

## Included

- Customer, reseller, and platform organizations with scoped memberships.
- Explicit reseller-to-customer service relationships.
- Customer-owned vehicles and historical device assignments.
- Policy-filtered operational health and location data.
- Time-limited, revocable reseller location grants.
- Audit records for cross-tenant location views (`LOCATION_VIEWED`), so a customer can see when a reseller or platform actor received coordinates. Owning-organization member views are not logged to keep the trail meaningful.
- Telemetry simulation with immutable event records and a mutable latest-position projection.
- Alerts, device inventory, and audit history.
- Cross-tenant policy and HTTP integration tests.
- Express 5 API organized into routes, controllers, services, middleware, database connection/seed files, and Sequelize models.
- PostgreSQL 18 (`postgres:latest`) as the default database; SQLite remains available as an offline fallback.
- Explicitly disabled remote immobilization.

## Deliberately excluded

- Real GPS303 protocol handling or claims about exact device behavior.
- Remote immobilization or any high-risk vehicle command.
- Billing, payment splitting, production identity, SMS, push, and white-label domains.
- Production-grade database, map provider, and durable event broker decisions.

## Run locally

Start the database first, then the apps:

```bash
npm install
docker compose up -d db     # PostgreSQL (postgres:latest)
npm run dev
```

Then open:

- Customer and reseller portal: `http://localhost:5173` (`PORTAL_PORT`)
- Isolated platform admin console: `http://localhost:5174` (`ADMIN_PORT`)
- Shared policy-enforced API: `http://localhost:8787` (`API_PORT`)

Without Docker (offline fallback) run the API on SQLite instead — no database server required:

```bash
DATABASE_DIALECT=sqlite npm run dev
```

The API then creates `.data/sentinel.sqlite` at the repository root and seeds it when empty.

The portal includes an interactive Leaflet map using OpenStreetMap tiles and required map attribution. The local OSM tile service is suitable for this low-volume demonstration only; production must use a contracted map provider or self-hosted tiles.

On macOS, double-click `Start Sentinel Fleet.command` in this folder. It starts the API and both interfaces, then opens both in separate browser tabs. Keep its Terminal window open while using the apps; press `Control-C` there to stop them.

## Docker

`docker-compose.yml` defines four services and reads the same `.env` file:

| Service  | Image / build             | Host port                          |
| -------- | ------------------------- | ---------------------------------- |
| `db`     | `postgres:latest`         | `DATABASE_PORT` (5432)             |
| `api`    | `apps/api/Dockerfile`     | `API_PORT` (8787)                  |
| `portal` | `apps/portal/Dockerfile`  | `PORTAL_PORT` (5173) → container 80 |
| `admin`  | `apps/admin/Dockerfile`   | `ADMIN_PORT` (5174) → container 80  |

```bash
docker compose up --build          # full stack
docker compose up -d db            # database only, for local npm run dev
```

Notes:

- All images build on **Node 24**. The API image uses a build stage plus a runtime stage with
  production dependencies only, runs as the non-root `node` user, and exposes a healthcheck.
- The portal and admin images serve the Vite build through nginx (`docker/nginx-spa.conf`) and
  reverse-proxy `/api` to the `api` service, so the apps keep using relative API paths.
- `docker compose` sets `DATABASE_DIALECT=postgres`, `DATABASE_HOST=db` and an empty `DATABASE_URL`
  for the API container, so containerised runs always use the bundled database.
- Switching from an older PostgreSQL major (for example 16) requires a fresh volume:
  `docker compose down -v` before `docker compose up --build`.

## Verify

```bash
npm test
npm run build
```

## Demo security note

The actor selector sends an `x-demo-actor` header so policy behavior can be demonstrated locally. It is not authentication. A production deployment must replace this with a verified session/token, MFA and step-up controls, server-side session management, and production audit storage.

## Backend structure

```text
apps/api/src/
  config/       Environment configuration
  controllers/  HTTP request/response adapters
  database/     Sequelize connection and seed lifecycle
  middleware/   Demo authentication and error handling
  models/       Sequelize models and associations
  routes/       Express 5 route modules
  services/     Authorization and business logic
  types/        Express type augmentation
  utils/        Shared backend utilities
```

## Local persistence

With PostgreSQL (the default) all state lives in the `sentinel` database, created and seeded on first
run. When the API runs on the SQLite fallback it creates `.data/sentinel.sqlite` at the repository root
and seeds it when empty. The legacy JSON store is no longer used.

## Database configuration

PostgreSQL is the default backend; SQLite is an offline fallback.

`DATABASE_DIALECT` selects the backend (`postgres` default, or `sqlite` with the file at
`DATABASE_STORAGE`). When `DATABASE_URL` is present it takes precedence over
`DATABASE_HOST`/`DATABASE_PORT`, so leave it empty when the individual host settings should apply
(`docker compose` does exactly that). `DATABASE_STORAGE` paths are resolved relative to `apps/api`,
which is why the SQLite default is `../../.data/sentinel.sqlite`.

```bash
docker compose up -d db          # PostgreSQL 18 on localhost:5432
npm run dev                      # API + portal + admin
```

SQLite fallback (no server, no Docker):

```bash
DATABASE_DIALECT=sqlite npm run dev
```

Tests always run on in-memory SQLite (`NODE_ENV=test DATABASE_STORAGE=:memory:`), so `npm test`
never needs a database server.

## Dependency note

The latest stable Sequelize 6 package currently includes a moderate transitive `uuid` advisory. npm's automated remediation recommends downgrading Sequelize to an obsolete major release, so that unsafe downgrade was not applied. No high or critical advisories were reported.
