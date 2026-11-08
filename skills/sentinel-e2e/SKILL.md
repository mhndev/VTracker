---
name: sentinel-e2e
description: Maintain and run Sentinel Fleet's deterministic Playwright regression journeys when changing customer, reseller, admin, or simulator UI flows.
---

# Sentinel Fleet E2E

Read `AGENTS.md` and `docs/TEST_SCENARIOS.md` before changing browser coverage. The executable journeys live in `e2e/sentinel-flows.spec.ts`; configuration and isolated ports live in `playwright.config.ts`.

Use `npm run test:e2e` for the normal headless regression suite and `npm run test:e2e:ui` only for interactive debugging. The runner starts an in-memory SQLite stack, uses fixed test ports, and stops it afterward. Test execution must remain deterministic and must not call an AI model or regenerate onboarding media.

Prefer accessible role, label, and text locators. Cover outcomes and privacy boundaries rather than implementation details. In particular, reseller location access must remain grant-scoped and the platform-admin flow must never expose coordinates.

When a user-visible critical journey changes, update both the scenario catalog and its Playwright coverage. Before finishing, run `npm test`, `npm run build`, and `npm run test:e2e` unless the change is strictly documentation-only.
