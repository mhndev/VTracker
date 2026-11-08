# AGENTS.md — working guide for AI coding agents

This file is the fastest path to being productive in this repository without breaking it.
Read it fully before editing. It documents the layout, the commands, the conventions, and —
most importantly — the **product and privacy invariants that must never be relaxed**.

Human-facing docs: `README.md` (run/build/deploy) and `DECISIONS.md` (locked product decisions
and what is deliberately out of scope). If a change contradicts `DECISIONS.md`, stop and ask.

---

## 1. What this project is

**Sentinel Fleet** is a runnable multi-tenant GPS / vehicle-telematics MVP: a customer &
reseller portal, an isolated platform-admin console, an isolated Coban device simulator, a TCP/UDP
telematics gateway, and a policy-enforced Express API. It is a *demonstrator*, not a production
system: authentication is simulated, billing is absent, the protocol implementation is based on
published/manual evidence rather than certified hardware captures, and production remote vehicle
control remains outside the locked product scope.

The domain model in one paragraph: an `Organization` (PLATFORM / RESELLER / CUSTOMER) is the
isolation boundary. Customers own `Vehicle`s; `Device`s are assigned to vehicles through
a historical `DeviceAssignment`. A reseller only sees operational health through an active
`ServiceRelationship`, and location only through an explicit, time-limited `AccessGrant`
(`LOCATION_CURRENT`) created by the customer. Platform support sees aggregate metadata and
**never** coordinates.

### Repository layout

```text
package.json                    npm workspaces root; all documented scripts live here
.env / .env.example             single source of truth for ports, CORS, database (committed)
docker-compose.yml              db (postgres) + api + portal + admin; reads the same .env
docker/nginx-spa.conf           shared nginx config for both SPA images (/api reverse proxy)
Start Sentinel Fleet.command    macOS double-click launcher (not part of the build)

src/apps/api/       Express 5 + TypeScript + Sequelize API  (API_PORT,    default 8787)
src/apps/portal/    Customer/reseller React + TS portal      (PORTAL_PORT, default 5173)
src/apps/admin/     Platform-admin React + TS console        (ADMIN_PORT,  default 5174)
src/apps/device-simulator/ React device lab + TCP/UDP bridge  (SIMULATOR_PORT, default 5175)
src/packages/ui/    Shared React UI components and styles

html/           Orphaned standalone RTL (Persian) prototype mockups — not built, not served
shots/          Reference screenshots of the running UIs — not part of the build
```

---

## 2. Commands (run from the repo root)

| Task | Command | Notes |
| --- | --- | --- |
| Install | `npm install` | npm workspaces; native `sqlite3` build (see §9) |
| Everything (dev) | `npm run dev` | API + portal + admin + simulator; PostgreSQL when reachable, otherwise SQLite |
| Strict DB dev | `npm run dev:postgres` / `npm run dev:sqlite` | Require one backend; no automatic fallback |
| API only | `npm run dev:api` | One API process; exits immediately on startup failure |
| API with reload | `npm --workspace @sentinel/api run dev:watch` | Optional watcher while editing backend code |
| Portal / admin / simulator only | `npm run dev:portal` / `npm run dev:admin` / `npm run dev:simulator` | Vite dev servers |
| Test | `npm test` | API integration plus simulator protocol/route tests; SQLite is in-memory |
| Build / typecheck | `npm run build` | portal, admin, simulator Vite builds plus API `tsc` |
| Typecheck only | `npm run build:api` / `:portal` / `:admin` | Fastest gate while iterating |
| DB (Postgres) | `docker compose up -d db` | Required for `npm run dev` unless SQLite fallback |
| No-Docker dev | `npm run dev:sqlite` | Creates `.data/sentinel.sqlite` |
| Full stack | `docker compose up --build` | Node 24 images, nginx-fronted SPAs |

`npm test && npm run build` is the project's definition of verified (README "Verify"). The root
`scripts/dev.mjs` performs the database reachability preflight used by `npm run dev`; keep its
strict `dev:postgres` and `dev:sqlite` modes working when changing startup configuration.

### Ports and origin wiring

All ports come from `.env`, which is **committed** (demo credentials only). `WEB_HOST` sets the
interface the Vite dev servers bind (`127.0.0.1` locally; use `0.0.0.0` inside containers,
sandboxes, or when the dev server is reached through a tunnel/proxy — `strictPort: true` means a
bad port fails loudly instead of silently shifting).

`CORS_ORIGIN` must list the exact portal/admin/simulator browser origins and stay in sync with
`PORTAL_PORT`/`ADMIN_PORT`/`SIMULATOR_PORT`; changing a port in one place and not the others is the most common
local breakage. The SPAs themselves always call **relative** `/api/...` paths and rely on the
Vite dev proxy (`VITE_API_BASE`) or the nginx `/api` proxy in Docker.

### Docker

`docker-compose.yml` defines `db` (postgres), `api`, `portal`, `admin` — all reading the same
`.env`. Images build on **Node 24**; the API uses a build+runtime split (`node:24-slim`, glibc so
the `sqlite3` native module resolves, runs as the non-root `node` user, has a `/api/health`
healthcheck), and the two SPAs are Vite builds served by nginx (`docker/nginx-spa.conf`, which
also reverse-proxies `/api` to the `api` service). Compose deliberately pins
`DATABASE_DIALECT=postgres`, `DATABASE_HOST=db` and an empty `DATABASE_URL` for the API container.
If you change a build step, check all three Dockerfiles and `docker/nginx-spa.conf`, not just the
one you touched.

---

## 3. Backend map (`src/apps/api`)

```text
src/
  server.ts        entrypoint: initialize DB, then listen on env.host/env.port
  app.ts           express app factory: CORS, json (32kb), /api/health, /api, error handlers
  config/env.ts    the ONLY module allowed to read process.env
  routes/          one Router per resource; mounted in routes/index.ts under /api
  controllers/     thin HTTP adapter: read request -> call service -> response.json
  services/        business logic + authorization; the only place policy is decided
  middleware/      attachActor (demo auth) and error handling
  database/        connection.ts (sequelize instance), index.ts (init), seed.ts
  models/          Sequelize models; index.ts exports + initializeAssociations()
  telematics/      Coban decoding/encoding, TCP/UDP sessions, ingestion, SSE broadcasts
  types/           Express Request augmentation (request.actor)
  utils/           HttpError, asyncHandler
test/api.test.ts   the primary API integration suite (node:test + supertest)
```

### Device protocol catalog

- Keep `database/protocol-catalog.ts` and `docs/devices/` aligned. The database catalog is rendered in the admin **Device documentation** view.
- `ACTIVE` means a tested runtime decoder/adapter exists. `CATALOG_ONLY` is documentation and must never be presented as ingestion or command support.
- Reseller device-family access belongs in `reseller_device_protocol_availability`, not UI-only configuration. Platform mutations must be audited.
- Most catalogued trackers send vendor frames over raw TCP/UDP or SMS. JSON is the normalized platform representation after decoding, not a claim that the tracker calls a JSON API.

### Request flow

`/api/health` is public. Every other `/api/*` request passes through `attachActor`, which reads
the `x-demo-actor` header (defaulting to `user-customer-admin`), loads the `User`, sets
`request.actor`, and 401s with `UNKNOWN_ACTOR` if the actor does not exist. Controllers may then
use `request.actor!.id` — it is always set inside `/api`.

### Error contract

Throw `HttpError(status, CODE, message)` from services/controllers; `errorHandler` converts it to
`{ "error": { "code": "SCOPE_DENIED", "message": "..." } }`. Anything else becomes a 500
`INTERNAL_ERROR` (and is logged server-side). Wrap async handlers in `asyncHandler(...)` — the
codebase does this consistently even though Express 5 also forwards rejected promises. Never leak
internal messages, SQL, or stack traces in the response body.

Existing codes worth reusing: `UNKNOWN_ACTOR` (401), `SCOPE_DENIED` / `GRANT_ADMIN_REQUIRED` /
`PLATFORM_ADMIN_REQUIRED` / `AUDIT_SCOPE_DENIED` / `TELEMETRY_WRITE_DENIED` (403),
`INVALID_GRANT` (400).

### Authorization rules (single source of truth: `services/policy.service.ts`)

- `getActorContext(actorId)` loads memberships once; pass the returned context into
  `canViewLocation` / `getAccessMode` for list endpoints instead of re-querying per item.
- `getAccessMode(actorId, customerOrgId)` → `'member' | 'service' | 'platform' | null`.
  `null` means "outside scope" and must become a 403, never an empty 200.
- `canViewLocation(actorId, vehicleId, at, context, vehicle)` is the only correct way to decide
  whether coordinates may be returned. Owning-organization members always can; resellers need an
  unexpired, unrevoked `AccessGrant` with `permission: 'LOCATION_CURRENT'`.
- `canManageGrants` (customer `ORG_ADMIN` / `PRIVACY_ADMIN`) and `canSimulateTelemetry`
  (customer `ORG_ADMIN` / `FLEET_MANAGER`) gate the write paths.
- `canManageVehicles` permits customer `ORG_ADMIN` / `FLEET_MANAGER` members and delegated
  reseller admins. Reseller authority requires an active reseller organization, reseller-wide
  `FLEET_MANAGE`, an active service relationship, and an unrevoked relationship-level
  `FLEET_MANAGE`; it never grants location access.
- `canManageDeviceAssignments` permits customer `ORG_ADMIN` / `FLEET_MANAGER` members and
  delegated reseller `RESELLER_ADMIN` / `DEVICE_INSTALLER` members. Reseller authority requires
  the same active organization and relationship checks plus reseller-wide and relationship-level
  `DEVICE_MANAGE`; it never grants location access. A device may be assigned only to an active
  vehicle owned by the same customer organization that holds device custody.
- Device assignments are historical: an active record has `unassignedAt: null`; ending it sets a
  timestamp. Partial unique indexes prevent more than one active assignment for either a device or
  a vehicle. Assignment mutations write `DEVICE_ASSIGNED` / `DEVICE_UNASSIGNED` audit events.
- Vehicle lifecycle is reversible: `archivedAt: null` is active, while a timestamp is archived.
  Default dashboards, platform counts, and telemetry simulation exclude archived vehicles. Edit,
  archive, and restore reuse `canManageVehicles`, preserve all related records, and write
  `VEHICLE_UPDATED`, `VEHICLE_ARCHIVED`, or `VEHICLE_RESTORED` audit events.
- Vehicle state and trip/log reads contain location-derived data and must pass `canViewLocation`.
  Platform support remains denied; owning members and explicitly granted resellers are the only
  callers that can receive coordinates or compact trip paths.
- Retention assignments are customer-organization resources. Platform administrators may inspect
  capacity and change an assignment; customer/reseller roles may not. New customers receive the
  one-month policy transactionally with provisioning.
- Never trust `organizationId` from a query string or body. Always resolve it through
  `getAccessMode` / `getMembership` / `canManageGrants` first (this is what the tests pin down).

### Audit trail rules

`recordAudit` writes append-only `AuditEvent` rows. Two rules, both covered by tests — keep them:

1. **Cross-tenant location reads must be audited** as `LOCATION_VIEWED` with `outcome: 'SUCCESS'`
   (reseller granted access, platform actor). A customer must be able to see who received
   coordinates. `dashboard.service.ts` does this per vehicle when `accessMode !== 'member'`.
2. **Owning-organization member reads must NOT be audited.** Self-access is the customer's own
   data; logging it would bury the meaningful trail. Do not "fix" the asymmetry.

Existing actions: `LOCATION_VIEWED`, `ACCESS_GRANT_CREATED`, `ACCESS_GRANT_REVOKED`,
`TELEMETRY_SIMULATION_RUN`.

### Data conventions

- IDs are explicit strings (`vehicle-1`, `grant-<uuid>`, `audit-<uuid>`, `telemetry-<uuid>`).
  Use `crypto.randomUUID()` with the matching prefix for new rows; never rely on auto-increment.
- Sequelize global defaults: `timestamps: false`, `underscored: true`, `freezeTableName: true`.
  Declare timestamps explicitly on the model (`createdAt`, `occurredAt`, `expiresAt`, ...).
  Model attributes are camelCase; columns and tables are snake_case; declare an `indexes` entry
  for every column you filter or join on.
- New model checklist: create `models/X.ts` → export from `models/index.ts` → register
  associations in `initializeAssociations()` (aliases are used by the services).
- **No migrations exist.** Schema is created with `sequelize.sync()`; `force = true` drops and
  recreates. Changing a column therefore requires a reset (see §7).
- Avoid N+1 queries: the codebase deliberately batches with `Op.in` + `Map` lookups and comments
  say so. Follow that pattern; a per-item `await` inside a `.map` is a review blocker.

### Telemetry semantics

Telemetry is append-only (`TelemetryEvent`) plus mutable `LatestPosition` and `VehicleState`
projections. Events carry both `occurredAt` (device time) and `ingestedAt` (server time), a
`schemaVersion`, a `quality` and a `source`, and are idempotent-friendly by event ID. Both the local
HTTP simulator (`services/telemetry.service.ts`) and valid Coban gateway frames write normalized
telemetry in transactions. Invalid GPS fixes refresh device/state health without replacing trusted
coordinates.

Trip segmentation lives in `telematics/ingestion.ts`: movement is speed above 2 km/h; a stop of at
least five minutes closes the active trip at the first stationary point. `TripPoint` uses
`(tripId, slot)` as a compact composite key and is capped at 100 rows per trip. The first/latest
points are preserved and interior slots are sampled as reports arrive. Raw message and telemetry
retention must never delete `Trip` or `TripPoint` rows.

`retention_policies` contains the four seeded durations and sizing assumptions;
`organization_retention_policies` assigns a customer plan. `startRetentionScheduler()` runs once at
API startup and every 24 hours, deleting expired `DeviceMessageLog` and `TelemetryEvent` rows only.
Storage estimates are planning calculations, not measured database sizes.

---

## 4. Hard invariants — do not break these

1. **No supported production remote vehicle commands, ever.** The repository currently contains
   experimental Coban command plumbing used by the isolated lab/demo; this is a known inconsistency
   with the locked production decision and must not be expanded, marketed as supported, or enabled
   as a production capability without a separate safety/legal ADR. `GET /api/health` returns
   `highRiskCommandsEnabled: false`; the dashboard returns
   `capabilities.remoteImmobilization: false`; the admin console shows the "high-risk commands"
   check as `DISABLED`; the portal displays the "vehicle control is unavailable" notice. Requiring
   an immobilization feature means stopping and asking for a separate safety/legal ADR
   (`DECISIONS.md`).
2. **Platform support never receives coordinates.** `/api/admin/overview` returns aggregates and
   inventory only; a test asserts the payload contains no `latitude`/`longitude` string at all.
   Break-glass location access is not implemented — do not add it silently.
3. **Admin stays a separate application and API surface.** `src/apps/admin` is its own build, port,
   navigation and deployment (`/api/admin/*`, guarded by `hasPlatformRole`). Do not fold admin
   screens into `src/apps/portal` or expose admin data through portal endpoints.
4. **Tenant isolation is enforced server-side, per request.** Frontend role switching is a demo
   affordance, not a security control; the API must produce identical results regardless of what
   the UI believes.
5. **`x-demo-actor` is not authentication.** Keep the demo simple; never invent passwords, tokens,
   sessions, or credentials for it. Production identity is explicitly out of scope for the MVP.
6. **Audit asymmetry** (§3) and **grant expiry checks** (`revokedAt: null` and
   `expiresAt > now`) stay as they are.
7. **No new product surface without asking:** billing, payments, SMS/push, white-label domains,
   real map/geocoder providers, device protocol handling, or a durable event broker are all
   deliberately excluded (see `README.md` → "Deliberately excluded" and `DECISIONS.md`).

---

## 5. Frontend conventions (`src/apps/portal`, `src/apps/admin`)

- React 19 + TypeScript, Vite, plain CSS files per app (`src/styles.css`). **No Tailwind, no CSS
  modules, no component library.** Icons come from `lucide-react`.
- **No router.** Each app is one component (`PortalApp.tsx` / `AdminApp.tsx`) that switches views
  with local state and a `nav`/`VIEWS` array; keep it that way unless asked to add routing.
- Data access is a small local `request<T>()` helper around `fetch` in the portal
  (`PortalApp.tsx`) and a `fetchAdmin()` in the admin app. The portal sends the actor id in the
  `x-demo-actor` header chosen by the role selector; the admin console always sends
  `user-platform-support`. Always use relative `/api/...` URLs — never `http://localhost:8787`
  in browser code (that breaks Docker/nginx and remote previews).
- Types shared by portal components live in `src/apps/portal/src/types.ts`; the admin app keeps its
  `AdminData` type local. Keep API response types in sync with the services that produce them.
- Shared presentation components and the portal visual system live in `src/packages/ui`; use them
  from both web workspaces instead of duplicating shared UI. Shared i18n lives in
  `src/packages/ui/src/i18n`: use `t('domain.key')` and the locale formatters from `useI18n()` /
  `createI18n()`. English and Farsi are active; do not add `locale === 'fa'` ternaries. Farsi uses
  the Persian calendar and bundled Vazirmatn. Wrap plates, serials, emails, coordinates, IDs, and
  technical values with `LtrText` or `dir="ltr"`. Key naming and locale rules are in
  `src/packages/ui/src/i18n/README.md`.
- The portal's Leaflet maps (`LiveMap.tsx` and trip maps in `VehicleTelematicsDialog.tsx`) use OSM
  tiles and **must keep the OpenStreetMap attribution**; access-denied states render the
  "locations are private" overlay rather than hiding the feature.
- `VehicleTelematicsDialog.tsx` owns Current state, Trips, Logs, and Controls. State/details poll
  independently from the persisted log feed. Do not make offline history depend on a live socket.
- Accessibility and polish already present (aria labels, `aria-current`, focusable buttons,
  responsive layout) should be preserved when editing TSX.
- **Both `vite.config.ts` files are intentionally duplicated and contain a hand-written `.env`
  parser** — not `loadEnv()` — because `loadEnv()` copies `NODE_ENV` into
  `process.env.VITE_USER_NODE_ENV` and makes `vite build` bundle the development React runtime.
  Do not "simplify" it back to `loadEnv()`; if you change one config, mirror the change in the
  other. Build output goes to the repo-root `dist/portal` / `dist/admin` (`emptyOutDir: true`).

---

## 6. Config and environment

- Only `src/apps/api/src/config/env.ts` reads `process.env` outside the two Vite configs. Add new
  variables there, with a sane default, and expose them through the `env` object.
- Load order: workspace `.env` → `src/apps/api/.env`, with the first loaded value winning, then
  `dotenv.config()`. Tests set
  `NODE_ENV=test` and `DATABASE_STORAGE=:memory:`.
- Database selection: `DATABASE_DIALECT` (`postgres` default, `sqlite` fallback).
  `DATABASE_URL` **wins over** `DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_NAME`, which is why
  `docker compose` explicitly sets `DATABASE_URL: ""` for the API container. `DATABASE_STORAGE`
  is resolved relative to `src/apps/api` (default `../../../.data/sentinel.sqlite`, i.e. repo root).
- In tests (`NODE_ENV=test`) or with `DATABASE_STORAGE=:memory:`, the connection layer forces
  SQLite regardless of dialect.
- When you add or rename a variable, update `.env`, `.env.example`, this file where relevant, and
  `README.md`/`docker-compose.yml` if they mention it. `.env` is committed — keep it free of
  real secrets.

---

## 7. Database lifecycle, seeding, and how to reset

`initializeDatabase(force)` runs `initializeAssociations()` once, connects, then
`seedDatabase(force)`, which calls `sequelize.sync({ force })`. Protocol and retention catalogs are
seeded idempotently on every startup; the main demo fixtures are inserted only when
`Organization.count() === 0`. Existing customer organizations missing a retention assignment
receive the one-month default.

Seeded fixtures (use these exact IDs in tests and manual checks):

| Kind | IDs |
| --- | --- |
| Organizations | `org-platform` (PLATFORM), `org-reseller` (NordTrack Services), `org-customer` (Berlin Field Logistics), `org-private` (Meyer Household) |
| Users / memberships | `user-customer-admin` (Maya Chen, `ORG_ADMIN` @ org-customer), `user-reseller-admin` (Leila Haddad, `RESELLER_ADMIN` @ org-reseller), `user-reseller-support` (Noah Fischer, `SUPPORT_AGENT` @ org-reseller), `user-platform-support` (Ari Morgan, `PLATFORM_SUPPORT` @ org-platform), `user-platform-viewer` (negative authorization fixture, `PLATFORM_VIEWER` @ org-platform) |
| Service relationships | `relationship-1` (reseller → org-customer, ACTIVE), `relationship-2` (reseller → org-private, ACTIVE) |
| Delegated capability | `relationship-capability-1`: `FLEET_MANAGE` and `relationship-capability-2`: `DEVICE_MANAGE` on `relationship-1`; `relationship-2` is intentionally undelegated |
| Vehicles | `vehicle-1` … `vehicle-4` (org-customer), `vehicle-private` (org-private) |
| Devices / assignments | `device-1` … `device-4` (org-customer, `device-4` is `QUARANTINED`), `device-5` (org-private); matching active records `assignment-1` … `assignment-5` |
| Access grant | `grant-1`: `vehicle-1` → `org-reseller`, `LOCATION_CURRENT`, expires 2 h after seeding |
| Alerts | `alert-1` … `alert-3`; audit events `audit-1` … `audit-3` |
| Retention | `retention-1-month`, `retention-6-months`, `retention-1-year`, `retention-5-years`; seeded customers default to `retention-1-month` |

The protocol/retention catalogs use idempotent startup seeding, but edits to the main demo fixtures
have no effect when organizations already exist. Column changes still require a reset because there
is no migration framework. Reset explicitly:

```bash
npm test                                   # always force-recreates the in-memory DB
rm -f .data/sentinel.sqlite                # SQLite fallback
docker compose down -v && docker compose up --build   # Postgres (also required after a Postgres major upgrade)
```

There is no migration tool. If you need one, raise it with the user first.

---

## 8. Testing

- API integration suite: `src/apps/api/test/api.test.ts`, run by `npm test` (`tsx --test`). It calls
  `createApp()` directly with `supertest` (no listening socket) and boots the DB via
  `initializeDatabase(true)` in `before`, closing it in `after`.
- Keep tests black-box: go through HTTP, assert status codes and response shapes, and use the
  seeded fixtures above. Do not reach into services or the DB to fabricate state when a seeded
  fixture or an API call can do it.
- When you touch authorization, grants, audit, telemetry writes, or the admin boundary, add or
  extend a test. The existing tests encode the invariants: reseller sees exactly one granted
  vehicle, cross-tenant views appear in the customer's audit feed, member views do not, platform
  payload contains no coordinates, malformed grant bodies return 400 not 500.
- Tests rely on relative time (`grant-1` expires 2 h after seeding, `minutesAgo()` fixtures), so
  a long-running process may drift; that is expected.
- The simulator has separate `node:test` suites under `src/apps/device-simulator/test/` for protocol
  packets and route interpolation. Root `npm test` runs both API and simulator suites.
- For browser smoke tests, use the `playwright` Codex skill/CLI, start `npm run dev:sqlite`, snapshot
  before using element refs, and cover the portal vehicle Current state/Trips/Logs tabs, offline
  labeling, customer map, admin aggregate view, and simulator landing page. Browser checks do not
  replace `npm test && npm run build`.
- **No linter, formatter, or CI is configured.** TypeScript `strict` +
  `noUncheckedIndexedAccess` in `src/apps/api`, and `tsc --noEmit` in both web apps, are the real
  gates — keep them green.

### Style, in one glance

2-space indentation, single quotes, semicolons, trailing commas avoided, long single-line JSX and
chained expressions are normal here (do not reformat whole files or "wrap" existing long lines —
it creates noisy diffs). Prefer `const` arrow helpers plus `function` components, `async/await`,
template literals, and `.map` over loops. Named exports in the API; `export default` for the two
app components. `.js` extensions in relative imports (see §9). Comments explain *why* a
non-obvious choice exists (batching, audit asymmetry, env parser) — preserve them and write in
the same voice.

---

## 9. Gotchas that cost real time

- **ESM/NodeNext:** every relative import in `src/apps/api` must end in `.js` even though the source
  is `.ts` (`from '../models/index.js'`). Omitting it breaks both `tsx` and the compiled output.
- **Express 5 routing:** path-to-regexp v8 no longer accepts a bare `*`. Use named wildcards
  (`/{*splat}`) instead of `'*'`.
- **API build output is `src/apps/api/dist/src/server.js`** (rootDir `.`), which is what the Docker
  `CMD` runs after `npm run build:api`.
- **`html/*.html` and `shots/` are not part of the product.** The HTML files are Persian/RTL
  standalone mockups with inline scripts and their own CDN copies of Leaflet; nothing builds or
  serves them. Do not wire them into the workspaces, and do not treat their markup as the source
  of truth for the React apps.
- **`Start Sentinel Fleet.command`** is a macOS convenience launcher only; it falls back to SQLite
  when Docker/Postgres is unavailable. Keep it consistent with port/env changes but don't refactor
  it into a cross-platform script without being asked.
- **API startup failures must terminate.** The default API dev command intentionally uses `tsx`
  without watch mode so a failed database connection stops `concurrently` and both web servers.
  The optional `dev:watch` command is for active backend editing, not stack startup diagnostics.
- **`docker compose` upgrade path:** switching PostgreSQL majors (e.g. 16 → 18) requires
  `docker compose down -v`; the volume target is `/var/lib/postgresql`.
- **Payload limit:** `express.json({ limit: '32kb' })`; large uploads need a deliberate change.
- **Dev server behind a proxy/tunnel/sandbox:** Vite (5.4.12+) rejects requests whose `Host`
  header is not allowed, which surfaces as "Blocked request. This host is … not allowed." when the
  dev server is reached through a preview URL. Fix it by binding `WEB_HOST=0.0.0.0` and adding
  `server.allowedHosts` to **both** `vite.config.ts` files (mirror the change), e.g.
  `allowedHosts: ['.preview.example']` or `true` for ephemeral environments — and keep
  `CORS_ORIGIN` in sync if the API is called from that origin directly.
- **Native dependency:** `sqlite3` (used by tests and the SQLite fallback) is a native module.
  If `npm install` cannot build or download a prebuilt binary, `npm install --ignore-scripts`
  still installs everything and lets `npm run build` / `tsc --noEmit` run, but `npm test` and the
  SQLite dev fallback will fail — use PostgreSQL (`docker compose up -d db`) or a machine with a
  toolchain, and say so instead of masking the failure.
- **Don't commit generated state:** `node_modules/`, `dist/`, `.data/`, `*.log` are already
  gitignored. Demo database files never belong in a commit.
- **Audit pagination:** `listOrganizationAudit` caps responses at 200 rows by design; pagination
  is a known follow-up, not a bug to fix incidentally while doing something else.

---

## 10. Recipes

**Add an API endpoint**

1. `routes/<name>.routes.ts` (or extend an existing router) → mount in `routes/index.ts`
   (`/api/<name>...`, admin-only paths under `/api/admin/`).
2. `controllers/<name>.controller.ts` — thin adapter, wrapped in `asyncHandler`, types from
   `express`.
3. `services/<name>.service.ts` — authorization first (`getMembership` /
   `getAccessMode` / `canManageGrants` / `hasPlatformRole`), then batched queries, then
   `recordAudit` if it is a cross-tenant or write action.
4. Add a test in `src/apps/api/test/api.test.ts` covering the allowed and the denied actor.
5. If the portal/admin consumes it, extend the frontend type and the relevant view.

**Change a model or seed** — edit the model and `models/index.ts` if associations change, reset the
database (§7), and rerun `npm test`. Update `README.md` only if documented behavior changed.

**Change a port or env var** — `.env`, `.env.example`, then `docker-compose.yml`,
`docker/nginx-spa.conf` (only if proxying changes), `vite.config.ts` (both apps) and `README.md`.

**Before you finish, always run** `npm test && npm run build`, and state plainly if either could
not be run (and why) rather than claiming success.

**New dependencies** — the stack is fixed (Express 5, Sequelize 6, React 19, Vite, Leaflet, lucide-react,
`node:test` + supertest). Prefer solving problems with what is already installed and ask before
adding a package, especially anything native, stateful, or license-encumbered.

**When in doubt about product scope**, `DECISIONS.md` + §4 here win over "it would be nicer if…".
Ask instead of guessing on anything that touches safety, privacy, identity, billing, or hardware.
