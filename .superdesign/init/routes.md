# Routes and views

Sentinel consists of two independent Vite React SPAs with local-state navigation; there is no router.

| URL | Entry | Views |
| --- | --- | --- |
| `http://localhost:5173/` | `src/apps/portal/src/PortalApp.tsx` | overview, map, vehicles, devices, alerts, privacy (customer); service desk, granted map, customer fleet, device health, support alerts (reseller) |
| `http://localhost:5174/` | `src/apps/admin/src/AdminApp.tsx` | control center, organizations, device network, risk & incidents, global audit |

The requested marketing landing page is a **new target** and does not currently have a route or source file.

Key page summary:

- Portal overview: greeting, four metric cards, live Leaflet map, featured vehicle, vehicle list, recent alerts.
- Portal privacy: grant history plus a temporary-access grant builder.
- Admin overview: platform metrics, organization health, system checks, connectivity, and audit pulse; coordinates are excluded.
