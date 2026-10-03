# MVP Decision Record

## Fixed for this implementation

- `Organization` is the isolation boundary for platform, reseller, and customer accounts.
- Vehicles, telemetry, trips, alerts, and grants are customer-organization resources.
- Resellers receive operational health through an active `ServiceRelationship`; location requires a specific active grant.
- Platform support sees coarse operational health only. Break-glass location access is not implemented.
- Remote immobilization is outside the MVP and there is no command endpoint.
- Telemetry uses at-least-once-friendly event identifiers, event time plus ingestion time, immutable normalized events, and a latest-position projection.
- Device protocol traffic is not implemented until exact hardware and capture fixtures exist.
- The local demonstrator uses Sequelize with SQLite and an interactive Leaflet/OpenStreetMap map. SQLite and OSM standard tiles are local-demo dependencies; the production database and map provider remain evidence-based decisions.
- All three applications are TypeScript workspaces. The Express 5 API is modularized into routes, controllers, services, middleware, database setup, and Sequelize models.
- Platform administration is a physically separate React application and API surface. Its aggregate operations endpoint omits coordinates; customer and reseller workflows live in a separate portal with role-specific navigation.

## Still required before production

1. Initial markets, legal roles, DPIA, lawful bases, retention, deletion/export, residency, and employee-monitoring policy.
2. Exact hardware, firmware, radio, SIM/carrier, and protocol capture evidence.
3. Production identity provider, MFA, organization federation, machine identities, and step-up policies.
4. Service-level objectives, scale model, RPO/RTO, alert latency, and packet-loss budget.
5. Durable database/event transport selection based on workload tests.
6. Map/geocoder selection based on countries, legal terms, volume, and cost.
7. Billing boundary and merchant-of-record decision.
8. White-label domain, cookie, callback, certificate, sender-identity, CSP, and brand-account model.
9. Notification channel guarantees and incident response.
10. Separate safety/legal ADR before any immobilization work.
