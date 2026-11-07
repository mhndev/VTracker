# Sentinel Fleet implementation status

Last updated: 2026-11-07 09:45 Europe/Berlin
Current package: S20
Overall state: READY_FOR_NEXT

## Package status

| Package | State | Verification | Notes |
| --- | --- | --- | --- |
| S00 | DONE | `npm test`; `npm run build`; portal/admin browser load | Baseline captured; both apps have only the known missing-favicon console error |
| S01 | DONE | `npm run build:portal`; `npm test`; `npm run build`; desktop/mobile browser checks | Vehicle creation now has isolated progress state and duplicate-submit protection |
| S02 | DONE | `npm run build:portal`; `npm test`; `npm run build`; desktop/mobile delayed-revalidation browser checks | Confirmed vehicle appears locally with an accessible five-second success toast before background revalidation completes |
| S03 | DONE | `npm test` (18/18); `npm run build`; desktop/mobile browser checks on isolated stack | Form values preserved on failure; accessible error focus; field-level plate collision mapping; database unique index and retry verified |
| S04 | DONE | `npm test` (18/18); `npm run build` | Typed English-only i18n in `@sentinel/ui`; `StatusPill` is the reference consumer |
| S05 | DONE | `npm test` (18/18); `npm run build`; desktop/mobile browser checks on isolated stack | Customer/owner portal converted to typed translation keys, Intl helpers, and catalog copy |
| S06 | DONE | `npm test` (18/18); `npm run build`; desktop/mobile reseller browser and privacy checks | Reseller workspace fully catalog-driven with distinct terminology, locked private map states, and empty states |
| S07 | DONE | `npm run build:admin`; `npm run build:api`; `npm test`; `npm run build`; desktop/mobile browser checks | Platform-admin navigation, views, tables, filters, metrics, checks, audit labels, errors, accessibility copy, and locale formatting are catalog-driven |
| S08 | DONE | `npm run build:portal`; `npm run build:admin`; catalog assertion; `npm test`; `npm run build` | Complete typed Farsi catalog with exact key and placeholder coverage; runtime activation remains deferred to S09 |
| S09 | DONE | `npm test`; `npm run build`; English/Farsi desktop and 390 × 844 browser checks | Runtime locale switching, dynamic lang/dir, RTL layout, Persian calendar, bundled Vazirmatn, and LTR technical islands verified |
| S10 | DONE | `npm run build:api`; `npm test` (22/22); `npm run build`; allowed/denied API checks | Organization locale persists, is exposed through session/settings APIs, and is policy-protected and audited |
| S11 | DONE | `npm test` (22/22); `npm run build`; desktop/mobile browser and allowed/denied policy checks | Locale resolves from session/active organization, persists after refresh and scope switches, and policy-authorized controls update it |
| S12 | DONE | `npm run build:api`; `npm test` (24/24); `npm run build`; black-box session and location-denial checks | Typed roles, lifecycle, delegated capabilities, audit actions, centralized policy decisions, and IdP gate documented |
| S13 | DONE | `npm run build:api`; `npm test` (27/27); `npm run build`; allowed/denied API checks | Platform support can list, create, update, suspend, and reactivate reseller organizations with normalized capabilities and complete audit events |
| S14 | DONE | `npm run build:admin`; `npm test` (27/27); `npm run build`; desktop/mobile browser and allowed/denied policy checks | Platform admin can search, filter, create, edit, suspend, reactivate, localize, and configure capabilities for reseller organizations |
| S15 | DONE | `npm run build:api`; `npm test` (29/29); `npm run build`; allowed/denied API and privacy checks | Reseller-scoped customer list/create/update is transactional, capability-gated, audited, localized, timezone-aware, and cross-reseller safe |
| S16 | DONE | `npm run build:portal`; `npm test` (29/29); `npm run build`; desktop/mobile English/Farsi browser and allowed/denied policy checks | Reseller admin can search, filter, create, edit, localize, lifecycle-manage, and open customer operational workspaces; support remains read-only and invitations remain gated |
| S17 | DONE | `npm run build:api`; `npm run build:portal`; `npm test` (31/31); `npm run build`; desktop/mobile English/Farsi browser and allowed/denied policy checks | Explicit relationship-level `FLEET_MANAGE` delegation lets reseller admins create customer-owned vehicle metadata without granting location access; support and undelegated scopes remain denied |
| S18 | DONE | `npm run build:api`; `npm run build:portal`; `npm test` (33/33); `npm run build`; desktop/mobile English/Farsi browser and allowed/denied policy checks | Vehicle metadata editing and reversible archive/restore preserve assignments and history, exclude archived vehicles from active views, expose an archived filter, and audit every change |
| S19 | DONE | `npm run build:api`; `npm test` (35/35); `npm run build`; allowed/denied API and conflict checks | Audited assignment list/create/end lifecycle preserves history, prevents active device/vehicle conflicts, enforces matching customer custody/ownership, and supports exact `DEVICE_MANAGE` delegation without location access |
| S20 | NOT_STARTED | — | — |
| S21 | NOT_STARTED | — | — |
| S22 | NOT_STARTED | — | — |
| S23 | NOT_STARTED | — | — |
| S24 | NOT_STARTED | — | Requires device-message evidence or explicit demo-fixture approval |
| S25 | NOT_STARTED | — | Prerequisite: S24 DONE |
| S26 | NOT_STARTED | — | Prerequisite: S24 DONE |
| S27 | NOT_STARTED | — | Requires retention and reseller history-access decisions |
| S28 | NOT_STARTED | — | Requires an approved production-identity ADR |
| S29 | NOT_STARTED | — | Prerequisite: S28 DONE |
| S30 | NOT_STARTED | — | Requires approved hardware/safety/legal/security ADR |
| S31 | NOT_STARTED | — | Final hardening and release audit |

## S00 baseline results

- `npm test` — PASS: 14 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API builds completed successfully.
- Portal `http://127.0.0.1:5173/` — PASS: loaded as **Sentinel Fleet Portal** with fleet data and map attribution visible.
- Admin `http://127.0.0.1:5174/` — PASS: loaded as **Sentinel Platform Admin** with aggregate data and coordinate-exclusion messaging visible.
- Portal console — one error: `GET /favicon.ico` returned 404; no warnings.
- Admin console — one error: `GET /favicon.ico` returned 404; no warnings.
- API health — PASS: returned `status: ok` and `highRiskCommandsEnabled: false`.
- Starting another `npm run dev:sqlite` instance reported ports 5173 and 5174 already in use; the already-running repository stack on 5173, 5174, and 8787 was healthy and used for browser verification.

## S01 verification results

- `npm run build:portal` — PASS.
- `npm test` — PASS: 14 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API builds completed successfully.
- Current-source browser stack — PASS on temporary ports 5273/5274/8877 with an isolated SQLite database.
- Keyboard submit — PASS: pressing Enter submitted the vehicle form.
- Progress feedback — PASS: within 100 ms the form reported `aria-busy="true"`, the live region announced `Creating vehicle…`, and the disabled primary button showed the same label with a visible spinner.
- Mutation isolation — PASS: telemetry refresh remained enabled while vehicle creation was submitting.
- Rapid double-click — PASS: exactly one `POST /api/vehicles` was observed and exactly one vehicle row appeared.
- In-flight dismissal protection — PASS: Cancel and Back controls were disabled, and backdrop dismissal was ignored while submitting.
- Mobile width 390 × 844 — PASS: the submitting button remained visible and the dialog retained `aria-busy="true"`.
- Browser console — only the known `/favicon.ico` 404; no warnings.
- The pre-existing stack on port 8787 was stale and did not expose the current vehicle route, so S01 browser verification used the isolated current-source stack rather than relying on that process.

## S02 verification results

- `npm run build:portal` — PASS.
- `npm test` — PASS: 14 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API builds completed successfully.
- Current-source browser stack — PASS on temporary ports 5275/5276/8878 with an isolated SQLite database.
- Delayed dashboard revalidation — PASS: the dashboard GET was held for four seconds; 250 ms after the confirmed POST, the modal was closed, the accessible success toast was visible, and exactly one new vehicle row was already rendered.
- Toast lifetime — PASS: the toast dismissed automatically after five seconds and could also be dismissed manually.
- `View vehicle` action — PASS: it opened the vehicle directory, scrolled to the new row, and moved focus to that row.
- Mobile width 390 × 844 — PASS: the toast stayed within the viewport and the immediate row insertion and action remained usable.
- Reduced motion — PASS: toast animation computed to `none` when `prefers-reduced-motion: reduce` was active.
- Browser console — only the known `/favicon.ico` 404; no warnings.

## S03 verification results

- `npm run build` — PASS: portal, admin, and API builds completed successfully.
- `npm test` — PASS: 18 tests passed, 0 failed (added 4 new tests for input validation violations, duplicate plate rejection with retry, and authorization denial codes).
- Current-source browser stack — PASS on temporary ports 5283/5284/8883 with an isolated SQLite database.
- Error recovery with preserved inputs — PASS: submitting with duplicate plate `B-FL 1204` kept the modal open with entered name and plate intact.
- Accessible error alert focus — PASS: `.vehicle-form-error[role="alert"]` displayed "A vehicle with this plate already exists." and programmatically received focus.
- Field-level duplicate mapping — PASS: the plate input received `aria-invalid="true"`, `aria-describedby="vehicle-plate-error"`, and rendered "Use a registration plate that is not already in this fleet.".
- Form interaction clears error — PASS: typing a corrected plate cleared the error banner and field-level error.
- Retry submission — PASS: pressing Enter with the corrected plate `B-FL 9876` immediately created the vehicle, closed the modal, displayed the success toast, and added the vehicle to the fleet list.
- Mobile width 390 × 844 — PASS: error alert and field error remained properly aligned and readable.
- Browser console — only the known `/favicon.ico` 404; no unexpected warnings.

## S04 verification results

- `npm test` — PASS: 18 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API builds completed successfully.
- Visible English copy is unchanged: catalog values for status codes match the previous `humanizeStatus` output (`ONLINE`, `GOOD`, and so on).
- Level C was not required for this package.

## S05 verification results

- `npm test` — PASS: 18 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API builds completed successfully (`npm run build:portal`, `npm run build:admin`, `npm run build:api`).
- Current-source browser stack — PASS on temporary ports 5285/8885 with an isolated SQLite database using Playwright automated headless tests.
- Customer Overview — PASS: verified welcome header, section titles, all 4 metric cards, focus card, speed orb, safety notice, vehicle list, and alerts preview.
- Live Map view — PASS: verified section title, real-time tracking eyebrow, OSM attribution, map float visible vehicle counter, and map popup speed/report timestamp.
- Vehicles directory — PASS: verified section title, add vehicle button, vehicle rows, and localized speed, battery, and last report readings.
- Devices inventory — PASS: verified device cards, serial numbers, models, and dl metadata terms (Vehicle, Network, Signal, Last seen).
- Alerts view — PASS: verified section title and alert cards with severity status pills.
- Privacy & access view — PASS: verified section title, active grants list with localized revocation/expiry dates, grant builder with localized duration options and submit action.
- Vehicle Studio dialog — PASS: verified dialog opening, steps, section titles, inputs, type radiogroup, marker style radiogroup with descriptions, live map preview, colors, sizes, and clean cancellation.
- Mobile width 390 × 844 — PASS: responsive layout preserved, mobile menu trigger and collapsible navigation drawer verified.
- Browser console — PASS: 0 errors recorded.

## S06 verification results

- `npm test` — PASS: 18 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built cleanly with zero errors.
- Current-source browser stack — PASS on temporary ports 5286/8886 with an isolated SQLite database using automated Playwright browser checks.
- Reseller navigation — PASS: verified distinct labels ("Service desk", "Granted map", "Customer fleet", "Device health", "Support alerts"), absence of customer privacy grant tab, partner logo subtitle ("Partner portal"), and account selector label ("CUSTOMER ACCOUNT").
- Reseller overview — PASS: verified distinct welcome header ("CUSTOMER SUPPORT WORKSPACE", "Good morning, Noah.", "Operational health is available. Locations remain customer-controlled."), metrics ("Customer vehicles", "Granted locations", "Support alerts"), focus card ("DEVICE INSPECTION"), and safety notice ("Remote commands and immobilization are disabled. Resellers provide operational support only.").
- Reseller privacy check (partial grant) — PASS: for customer account `Berlin Field Logistics` with active `grant-1` on vehicle-1, granted map reported exactly 1 visible vehicle; vehicle-1 rendered localized speed reading (`38 km/h`), while ungranted vehicles rendered "Requires grant" with no GPS leaks.
- Reseller privacy check (zero grants) — PASS: switching customer account to `Meyer Household` with zero grants rendered the locked private map overlay ("Locations are private", "Customer approval is required for this view.") and "Requires grant" for all speeds.
- Reseller customer fleet view — PASS: verified title "Customer vehicles", eyebrow "CUSTOMER INVENTORY", and absence of customer "Add vehicle" button.
- Reseller device health view — PASS: verified device hardware tiles with localized status and attributes.
- Reseller support alerts view — PASS: verified title "Customer alerts and anomalies", eyebrow "SUPPORT DESK", and support severity pills.
- Mobile width 390 × 844 — PASS: verified mobile hamburger toggle, open drawer with "Partner portal" brand label, and clean drawer dismissal.
- Browser console — PASS: 0 errors recorded.

## S07 verification results

- `npm run build:admin` — PASS.
- `npm run build:api` — PASS.
- `npm test` — PASS: 18 tests passed, 0 failed, including the platform-overview coordinate-exclusion policy test.
- `npm run build` — PASS: portal, admin, and API workspaces built cleanly with zero errors.
- Current-source browser stack — PASS on temporary ports 5297/5298/8897 with an isolated SQLite database using Playwright CLI.
- Control center — PASS: translated metrics, organization-health table, four catalog-driven system checks, localized connectivity figures, audit pulse, generated timestamp, and explicit coordinate-exclusion copy rendered correctly.
- Organizations — PASS: translated navigation, heading, search label, table headings, record count, status labels, and empty-state path remained available.
- Device network — PASS: translated navigation, heading, search label, table headings, status labels, locale-aware relative timestamps, and record count rendered correctly.
- Risk & incidents — PASS: translated incident table and the explicit guardrail stating that coordinates, trips, and addresses never appear and break-glass location access is not implemented.
- Global audit — PASS: translated audit actions, resource types, outcomes, headings, relative times, and filters rendered correctly.
- Mobile width 390 × 844 — PASS: all five admin views were opened successfully; the document width stayed at 390 px with no page-level horizontal overflow.
- Browser console — only the known `/favicon.ico` 404; no warnings or unexpected errors.
- Existing-stack review and repair — PASS on the user-facing 5173/5174/8787 stack. The persistent SQLite database predated the S02 marker fields, so `vehicles.marker_style`, `marker_color`, and `marker_size` were added in place with the seeded marker values restored; no vehicle rows were removed. Both `/api/dashboard` and `/api/admin/overview` then returned 200.
- Live portal recheck — PASS: Overview and Live map rendered all four customer vehicles. Disabled animated `fitBounds` transitions so React remounts cannot leave Leaflet zoom callbacks attached to a removed map; the two `_leaflet_pos` console errors no longer occur.
- Live admin recheck — PASS: Control center rendered from the existing API process. System-check interpolation now accepts both the new `detailCount` response field and legacy count-prefixed detail strings, avoiding literal `{count}` placeholders during rolling/local restarts.

## S08 verification results

- `npm run build:portal` — PASS: TypeScript accepted the complete Farsi catalog and the portal production build completed.
- `npm run build:admin` — PASS: TypeScript accepted the same catalog contract and the admin production build completed.
- Catalog coverage assertion — PASS: English and Farsi have identical leaf keys and interpolation placeholders; a translation smoke check preserved the technical identifier `B-FL 1410` unchanged.
- `npm test` — PASS: 18 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Level C was not required for S08 because Farsi remains intentionally inactive until S09.

## S09 verification results

- `npm test` — PASS: 18 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully; portal/admin output includes local Vazirmatn Arabic and Latin WOFF2 assets.
- Runtime locale — PASS: the development QA selector switches both apps between English and Farsi and persists the selection per app origin; `<html lang>` and `<html dir>` update to `en`/`ltr` or `fa`/`rtl` automatically.
- Typography and dates — PASS: Farsi computed to `Vazirmatn Variable, Tahoma, Arial, sans-serif`; numbers and relative times localized; user-facing Farsi dates use `fa-IR-u-ca-persian`, including Persian-calendar day numbers in the timeline rail.
- Customer portal — PASS in Farsi across Overview, Live map, Vehicles, Devices, Alerts, Privacy & access, and Vehicle Studio. Stable alert type codes now select localized summaries instead of rendering seeded English API copy.
- Reseller portal — PASS in Farsi across Service desk, Granted map, Customer fleet, Device health, and Support alerts; privacy overlays and restricted-location states remained enforced.
- Platform admin — PASS in Farsi across Control center, Organizations, Device network, Risk & incidents, and Global audit.
- Direction and technical data — PASS: desktop sidebars moved to the inline start in RTL; the mobile customer drawer opened from the right; toast/dialog/table alignment mirrored; plates, serials, device models/radios, emails, IDs, and coordinates computed as LTR islands.
- Responsive layout — PASS at 1280 px and 390 × 844; document width matched viewport width in customer, reseller, and admin views with no page-level horizontal overflow.
- Locale reversal — PASS: switching back to English restored `lang="en"`, `dir="ltr"`, and the English font stack.
- Browser console — PASS: final Playwright console query returned 0 errors and 0 warnings.

## S10 verification results

- `npm run build:api` — PASS: the locale model, settings routes, policy helpers, and session response typechecked successfully.
- `npm test` — PASS: 22 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Persisted locale — PASS: an `ORG_ADMIN` changed `org-customer` from `en` to `fa`; the settings response and a fresh session response both returned `fa` as the default and effective locale.
- Platform scope — PASS: `user-platform-support` changed the reseller organization's locale and read it back.
- Denied scope — PASS: reseller `SUPPORT_AGENT`, unrelated customer membership, and platform `PLATFORM_VIEWER` attempts were rejected with 403 responses.
- Validation — PASS: unsupported locale `de` returned `INVALID_ORGANIZATION_SETTINGS` with HTTP 400.
- Audit — PASS: the successful customer locale change created `ORGANIZATION_LOCALE_CHANGED` with the previous and new locale values.
- Database lifecycle — documented the required SQLite/PostgreSQL reset for existing databases because the repository has no migration framework.
- Level C was not required for this API-only package; UI locale resolution remains exclusively in S11.

## S11 verification results

- `npm test` — PASS: 22 tests passed, 0 failed, including top-level session effective-locale assertions and the existing allowed/denied settings policy coverage.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Current-source browser stack — PASS on temporary ports 5291/5292/8891 with an isolated SQLite database using Playwright CLI.
- Customer organization setting — PASS: changing Berlin Field Logistics from English to Farsi immediately set `<html lang="fa" dir="rtl">`, rendered the Persian success notice, and persisted after a full refresh.
- Organization scope switching — PASS: reseller support opened the Farsi customer in Farsi/RTL, then switching to the English-default Meyer Household scope immediately restored English/LTR.
- Platform setting — PASS: the separate admin app stayed English from the platform session while platform support changed Meyer Household to Farsi through the translated organization-table control; the persisted value rendered after the mutation.
- Authorization — PASS: reseller `SUPPORT_AGENT` had no locale settings control and a forged PATCH returned 403 `ORGANIZATION_SETTINGS_UPDATE_DENIED`.
- Responsive layout — PASS: portal and admin document widths matched the 390 px viewport with no page-level horizontal overflow; desktop checks passed at 1280 × 900.
- Console — no unexpected errors or warnings; the admin initial load reported only the known `/favicon.ico` 404 baseline issue.

## S12 verification results

- `npm run build:api` — PASS: typed provisioning contracts, policy functions, session capabilities, and role fixtures compiled successfully.
- `npm test` — PASS: 24 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Platform provisioning policy — PASS: platform support reports `createResellers: true`; platform viewer reports false; neither receives customer fleet/device management scope.
- Reseller provisioning policy — PASS: `RESELLER_ADMIN` reports customer-creation scope only for `org-reseller`; `SUPPORT_AGENT` reports no customer, fleet, or assignment mutation scope.
- Customer provisioning policy — PASS: customer `ORG_ADMIN` reports vehicle and device-assignment scope only for `org-customer` and no reseller/customer creation authority.
- Location boundary — PASS: platform support operational dashboard returned zero visible locations and contained no latitude/longitude fields; provisioning capabilities explicitly report platform customer-location access as `NONE`.
- Contract review — PASS: `docs/PROVISIONING_POLICY.md` defines role/capability names, organization and service-relationship lifecycle, normalized delegated permissions, stable audit action names, and the unresolved IdP/invitation gate.
- Level C was not required because S12 adds no UI or mutation workflow.

## S13 verification results

- `npm run build:api` — PASS: reseller lifecycle, normalized capability persistence, provisioning service, controller, and routes typechecked successfully.
- `npm test` — PASS: 27 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Allowed provisioning — PASS: platform support created a Farsi-default reseller with explicit capabilities, listed it, renamed it, changed its capabilities, and suspended it through `/api/admin/resellers`.
- Lifecycle policy — PASS: suspending the seeded reseller removed its `createCustomersForResellerIds` session capability; reactivation restored it.
- Denied provisioning — PASS: platform viewer, reseller admin, and customer admin attempts returned 403; invalid locale, lifecycle, and capability values returned 400.
- Audit — PASS: create, metadata update, lifecycle change, and capability change produced `RESELLER_CREATED`, `RESELLER_UPDATED`, `RESELLER_LIFECYCLE_CHANGED`, and `DELEGATED_CAPABILITIES_CHANGED` events.
- Privacy — PASS: reseller responses and the platform overview contained no latitude/longitude fields or private message content.
- Database lifecycle — documented the reset required for existing SQLite/PostgreSQL databases after adding `Organization.status` and `ResellerCapability`.
- Level C was not required because S13 adds no UI.

## S14 verification results

- `npm run build:admin` — PASS: the reseller directory, create/edit dialog, translated catalogs, responsive styles, and shared status/toast integrations typechecked and built successfully.
- `npm test` — PASS: 27 tests passed, 0 failed, including the existing S13 allowed/denied provisioning and privacy coverage.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Current-source browser stack — PASS on temporary ports 5314/8914 with an isolated SQLite database using Playwright CLI.
- Create and refresh — PASS: platform support created `Pars Mobility Systems` with Farsi as its default locale and explicit `CUSTOMER_PROVISION` / `SUPPORT_OPERATIONS` capabilities; the new row appeared immediately with an accessible success toast and remained in the list after a full data refresh.
- Edit and lifecycle — PASS: the same reseller reopened with its persisted values and changed from `ACTIVE` to `SUSPENDED`; the updated status and success toast rendered immediately.
- Directory states — PASS: name/capability search, lifecycle filter, filtered count, and translated no-results state all rendered correctly.
- Validation and feedback — PASS: a one-character organization name kept the dialog open, marked the field invalid, and rendered its linked validation message; failed server mutations preserve dialog values and map duplicate, permission, validation, and availability errors to translated catalog messages.
- Responsive layout — PASS at desktop and 390 × 844; the reseller table becomes a mobile card layout, the dialog measured 370 px inside the 390 px viewport, and document width equaled viewport width with no page-level horizontal overflow.
- Authorization — PASS: a forged reseller-admin `POST /api/admin/resellers` returned 403 `RESELLER_PROVISIONING_DENIED`; the successful UI mutation used platform support authority.
- Privacy — PASS: the reseller list payload contained no latitude, longitude, private-message, or message-content fields; the UI repeats the explicit coordinate/private-content boundary.
- Browser console — only the known `/favicon.ico` 404; no warnings or unexpected errors.

## S15 verification results

- `npm run build:api` — PASS: organization timezone persistence, customer provisioning policy/service/controller/routes, and tests typechecked successfully.
- `npm test` — PASS: 29 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Allowed provisioning — PASS: seeded `RESELLER_ADMIN` created a Farsi-default customer in `Asia/Tehran`, received an active service relationship in the same response, listed it in its reseller scope, and updated its name, locale, timezone, and lifecycle state.
- Transactionality — PASS: the created customer and matching active `ServiceRelationship` both persisted with the expected reseller/customer IDs; both writes and both creation audit events share the same database transaction.
- Capability policy — PASS: customer creation requires `CUSTOMER_PROVISION`; metadata updates require `CUSTOMER_SETTINGS`, an active reseller organization, `RESELLER_ADMIN`, and an active relationship to the target customer.
- Denied provisioning — PASS: reseller support, customer actors, a forged reseller scope, and a forged cross-reseller update returned 403; invalid locale, timezone, and lifecycle values returned 400.
- Audit — PASS: creation produced `CUSTOMER_CREATED` and `SERVICE_RELATIONSHIP_CREATED`; the metadata/lifecycle mutation produced `CUSTOMER_UPDATED`.
- Identity gate — PASS: customer provisioning created no user, membership, password, token, invitation, or sign-in credential.
- Privacy — PASS: create/list/update responses contain no coordinates or private message content.
- Database lifecycle — documented the reset required for existing SQLite/PostgreSQL databases after adding `Organization.timezone`; the pre-existing local SQLite file remains untouched because it contains user-visible demo state and predates multiple current schema columns.
- Level C was not required because S15 adds no UI.

## S16 verification results

- `npm run build:portal` — PASS.
- `npm test` — PASS: 29 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Current-source browser stack — PASS on temporary ports 5273/5274/8887 with an isolated SQLite database.
- Customer directory — PASS: reseller admin saw three distinct customer-management and operational-support surfaces, with customer search, lifecycle filter, localized status, locale, timezone, relationship, and creation-date metadata.
- Create and validation — PASS: a one-character customer name stayed in the dialog with linked `aria-invalid` feedback; a valid Farsi-default customer in `Asia/Tehran` was created, added to the directory immediately, added to the customer-scope selector after session refresh, and confirmed through an accessible toast.
- Edit and lifecycle — PASS: the created customer reopened with its persisted values and changed from `ACTIVE` to `SUSPENDED`; the card and accessible success toast updated immediately.
- Operational workspace switch — PASS: `Open workspace` selected the created customer and opened its permitted reseller service desk; the empty fleet and private-location overlay remained intact.
- English/Farsi and RTL — PASS: selecting the Farsi-default customer changed `lang` to `fa`, `dir` to `rtl`, translated the customer directory and dialog surface, used Persian-calendar dates, and preserved organization IDs and IANA timezones as LTR islands.
- Responsive layout — PASS at desktop and 390 × 844; the customer cards collapsed to one column, controls and dialog remained usable, and document width equaled viewport width with no horizontal overflow in English/LTR or Farsi/RTL.
- Authorization — PASS: reseller support had no customer-management navigation entry; a forged support-agent `POST /api/resellers/org-reseller/customers` returned 403 `CUSTOMER_PROVISIONING_DENIED`. Existing cross-reseller API tests remained green.
- Identity/privacy boundary — PASS: the UI exposes no invitation action, states the S28 identity gate, distinguishes support scope from customer ownership, and repeats that metadata management grants no coordinates or location permission.
- Browser console — PASS: 0 errors and 0 warnings on the isolated verification stack.

## S17 verification results

- `npm run build:api` — PASS.
- `npm run build:portal` — PASS.
- `npm test` — PASS: 31 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Current-source browser stack — PASS on temporary ports 5273/5274/8887 with an isolated SQLite database.
- Delegated creation — PASS: seeded reseller admin opened the existing Vehicle Studio from the selected customer fleet and created `Browser Delegated Van` as customer-owned metadata.
- Customer visibility — PASS: the created vehicle appeared immediately in the reseller fleet and after switching to the owning customer, whose dashboard showed five vehicles.
- Location privacy — PASS: the newly created vehicle showed `Requires grant` to the reseller and returned no latitude or longitude; existing location visibility remained limited to the one vehicle with a live `LOCATION_CURRENT` grant.
- Exact scope — PASS: relationship-level `FLEET_MANAGE`, an active service relationship, an active reseller organization, the reseller-wide entitlement, and `RESELLER_ADMIN` role are all required. `org-private`, reseller support, suspended relationships, and forged requests remain denied.
- Audit — PASS: delegated creation produced `VEHICLE_CREATED` with the reseller actor and customer owner organization in the customer-visible audit trail.
- English/Farsi and RTL — PASS: the delegated entry point, Vehicle Studio copy, privacy boundary, and created row rendered in English/LTR and Farsi/RTL.
- Responsive layout — PASS at desktop and 390 × 844; document width equaled viewport width and the mobile Vehicle Studio remained within the viewport in both directions.
- Browser console — PASS on the final isolated-stack check: 0 errors and 0 warnings.

## S18 verification results

- `npm run build:api` — PASS.
- `npm run build:portal` — PASS.
- `npm test` — PASS: 33 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Owner lifecycle — PASS: customer admin edited a vehicle, archived it through an object-specific confirmation, saw it disappear from the active dashboard and appear under the archived filter, then restored it to the active fleet.
- History preservation — PASS: the restored vehicle retained its existing `device-1` assignment and operational projection; archive/restore never delete assignments, telemetry, alerts, grants, or audit rows.
- Delegated reseller lifecycle — PASS: the seeded reseller admin received edit/archive/restore controls only for `org-customer`; support and undelegated `org-private` attempts returned 403 `VEHICLE_ADMIN_REQUIRED`.
- Location privacy — PASS: delegated lifecycle management did not create location access; ungranted reseller vehicles still rendered `Requires grant` with no coordinates.
- Audit — PASS: metadata edits, archives, and restores produced `VEHICLE_UPDATED`, `VEHICLE_ARCHIVED`, and `VEHICLE_RESTORED` events in the customer-visible trail.
- English/Farsi and RTL — PASS: lifecycle filters, edit form, confirmations, statuses, empty states, and toasts rendered from typed catalogs; Farsi used `lang="fa"`, `dir="rtl"`, Persian-calendar timestamps, and preserved LTR plates.
- Responsive layout — PASS at desktop and 390 × 844; document width matched viewport width and the mobile edit dialog measured 374 px within the 390 px viewport.
- Browser console — PASS: 0 errors and 0 warnings on the final isolated-stack check.

## S19 verification results

- `npm run build:api` — PASS.
- `npm test` — PASS: 35 tests passed, 0 failed.
- `npm run build` — PASS: portal, admin, and API workspaces built successfully.
- Customer lifecycle — PASS: customer admin listed complete assignment history, ended an active assignment, created a replacement assignment, and retained both the ended and active records.
- Conflict protection — PASS: service checks and partial unique database indexes prevent a device or vehicle from having more than one active assignment; conflict responses use stable 409 error codes.
- Delegated reseller policy — PASS: reseller admin receives assignment authority only for `org-customer`, where active reseller-wide and relationship-level `DEVICE_MANAGE` entitlements both exist; reseller suspension removes that authority.
- Tenant isolation — PASS: reseller support, the undelegated `org-private` relationship, cross-customer device custody, and forged history access were rejected with 403 responses.
- Ownership and lifecycle — PASS: assignment creation requires an active vehicle and matching customer device custody/vehicle ownership; ending sets `unassignedAt` and never deletes the record.
- Audit and privacy — PASS: `DEVICE_ASSIGNED` and `DEVICE_UNASSIGNED` are transactionally recorded and visible in the owning customer's audit feed; assignment responses contain no coordinates and device authority never creates location access.
- Level C was not required because S19 adds no UI.

## Current working-tree notes

- Existing user-owned changes that must be preserved: the large `apps/*` to `src/apps/*` restructure, modified root configuration/documentation files, and existing untracked `.playwright-cli/`, `.superdesign/`, `AGENTS.md`, `output/`, `scripts/`, and `src/` content shown by the S00 `git status --short` snapshot.
- Files changed through S03: `src/apps/portal/src/PortalApp.tsx`, `src/apps/api/src/models/Vehicle.ts`, `src/apps/api/src/services/vehicle.service.ts`, `src/apps/api/test/api.test.ts`, `src/packages/ui/src/index.tsx`, `src/packages/ui/src/styles.css`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S04: `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/index.tsx`, `src/packages/ui/src/i18n/README.md`, `src/packages/ui/src/index.tsx`, `src/apps/portal/src/main.tsx`, `src/apps/admin/src/main.tsx`, `AGENTS.md`, and `docs/IMPLEMENTATION_STATUS.md`.
- Files changed by S05: `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/index.tsx`, `src/packages/ui/src/index.tsx`, `src/apps/portal/src/LiveMap.tsx`, `src/apps/portal/src/PortalApp.tsx`, and `docs/IMPLEMENTATION_STATUS.md`.
- Files changed by S06: `src/packages/ui/src/i18n/en.ts`, `src/apps/portal/src/LiveMap.tsx`, `src/apps/portal/src/PortalApp.tsx`, and `docs/IMPLEMENTATION_STATUS.md`.
- Files changed by S07: `src/apps/admin/src/AdminApp.tsx`, `src/apps/api/src/services/admin.service.ts`, `src/apps/portal/src/LiveMap.tsx`, `src/packages/ui/src/i18n/en.ts`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S08: `src/packages/ui/src/i18n/fa.ts`, `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/index.tsx`, `src/packages/ui/src/i18n/README.md`, `src/packages/ui/src/index.tsx`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S09: `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/fa.ts`, `src/packages/ui/src/i18n/index.tsx`, `src/packages/ui/src/i18n/README.md`, `src/packages/ui/src/index.tsx`, `src/packages/ui/src/styles.css`, `src/packages/ui/package.json`, `src/apps/portal/src/main.tsx`, `src/apps/portal/src/PortalApp.tsx`, `src/apps/portal/src/LiveMap.tsx`, `src/apps/admin/src/main.tsx`, `src/apps/admin/src/AdminApp.tsx`, `src/apps/admin/src/styles.css`, `package-lock.json`, `AGENTS.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S10: `src/apps/api/src/models/Organization.ts`, `src/apps/api/src/database/seed.ts`, `src/apps/api/src/services/policy.service.ts`, `src/apps/api/src/services/session.service.ts`, `src/apps/api/src/services/organization-settings.service.ts`, `src/apps/api/src/controllers/organization-settings.controller.ts`, `src/apps/api/src/routes/organization-settings.routes.ts`, `src/apps/api/src/routes/index.ts`, `src/apps/api/test/api.test.ts`, `README.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S11: `src/packages/ui/src/i18n/index.tsx`, `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/fa.ts`, `src/packages/ui/src/i18n/README.md`, `src/packages/ui/src/styles.css`, `src/apps/portal/src/main.tsx`, `src/apps/portal/src/types.ts`, `src/apps/portal/src/PortalApp.tsx`, `src/apps/admin/src/main.tsx`, `src/apps/admin/src/AdminApp.tsx`, `src/apps/admin/src/styles.css`, `src/apps/api/src/services/session.service.ts`, `src/apps/api/src/services/admin.service.ts`, `src/apps/api/test/api.test.ts`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S12: `src/apps/api/src/contracts/provisioning.contracts.ts`, `src/apps/api/src/models/Membership.ts`, `src/apps/api/src/models/ServiceRelationship.ts`, `src/apps/api/src/services/policy.service.ts`, `src/apps/api/src/services/session.service.ts`, `src/apps/api/src/database/seed.ts`, `src/apps/api/test/api.test.ts`, `docs/PROVISIONING_POLICY.md`, `DECISIONS.md`, `AGENTS.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S13: `src/apps/api/src/models/Organization.ts`, `src/apps/api/src/models/ResellerCapability.ts`, `src/apps/api/src/models/index.ts`, `src/apps/api/src/database/seed.ts`, `src/apps/api/src/services/audit.service.ts`, `src/apps/api/src/services/policy.service.ts`, `src/apps/api/src/services/reseller-provisioning.service.ts`, `src/apps/api/src/controllers/admin.controller.ts`, `src/apps/api/src/routes/admin.routes.ts`, `src/apps/api/test/api.test.ts`, `README.md`, `docs/PROVISIONING_POLICY.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S14: `src/apps/admin/src/AdminApp.tsx`, `src/apps/admin/src/styles.css`, `src/packages/ui/src/index.tsx`, `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/fa.ts`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S15: `src/apps/api/src/models/Organization.ts`, `src/apps/api/src/services/policy.service.ts`, `src/apps/api/src/services/customer-provisioning.service.ts`, `src/apps/api/src/controllers/customer-provisioning.controller.ts`, `src/apps/api/src/routes/customer-provisioning.routes.ts`, `src/apps/api/src/routes/index.ts`, `src/apps/api/test/api.test.ts`, `README.md`, `docs/PROVISIONING_POLICY.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S16: `src/apps/portal/src/PortalApp.tsx`, `src/apps/portal/src/types.ts`, `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/fa.ts`, `src/packages/ui/src/styles.css`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S17: `src/apps/api/src/models/ServiceRelationshipCapability.ts`, `src/apps/api/src/models/index.ts`, `src/apps/api/src/database/seed.ts`, `src/apps/api/src/services/policy.service.ts`, `src/apps/api/src/services/vehicle.service.ts`, `src/apps/api/test/api.test.ts`, `src/apps/portal/src/PortalApp.tsx`, `src/apps/portal/src/types.ts`, `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/fa.ts`, `AGENTS.md`, `README.md`, `docs/PROVISIONING_POLICY.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S18: `src/apps/api/src/models/Vehicle.ts`, `src/apps/api/src/services/vehicle.service.ts`, `src/apps/api/src/controllers/vehicle.controller.ts`, `src/apps/api/src/routes/vehicle.routes.ts`, `src/apps/api/src/services/dashboard.service.ts`, `src/apps/api/src/services/telemetry.service.ts`, `src/apps/api/src/services/admin.service.ts`, `src/apps/api/src/services/grant.service.ts`, `src/apps/api/test/api.test.ts`, `src/apps/portal/src/PortalApp.tsx`, `src/apps/portal/src/types.ts`, `src/packages/ui/src/i18n/en.ts`, `src/packages/ui/src/i18n/fa.ts`, `src/packages/ui/src/styles.css`, `AGENTS.md`, `README.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- Files changed by S19: `src/apps/api/src/models/DeviceAssignment.ts`, `src/apps/api/src/services/policy.service.ts`, `src/apps/api/src/services/device-assignment.service.ts`, `src/apps/api/src/services/audit-query.service.ts`, `src/apps/api/src/controllers/device-assignment.controller.ts`, `src/apps/api/src/routes/device-assignment.routes.ts`, `src/apps/api/src/routes/index.ts`, `src/apps/api/src/database/seed.ts`, `src/apps/api/test/api.test.ts`, `AGENTS.md`, `README.md`, `docs/PROVISIONING_POLICY.md`, and `docs/IMPLEMENTATION_STATUS.md`. The companion execution plan outside the repository was also updated with the checkpoint.
- S01–S19 preserved the existing restructuring, configuration changes, persistent local database contents, and all other user-owned work. S18 browser verification used a separate temporary database; S19 used the force-recreated in-memory test database only.

## Decisions made

- Used the already-running local stack for browser verification after the strict-port dev servers confirmed ports 5173 and 5174 were occupied.
- Recorded the favicon 404s as baseline issues; fixing them is outside S00 because this package forbids application-code changes.
- Used independent local mutation states for vehicle creation, telemetry refresh, grant creation, and per-grant revocation so unrelated actions no longer control the create button.
- Kept S01 success behavior unchanged: the dashboard still revalidates before the modal closes and the existing page notice appears. Immediate local insertion and toast behavior remain scoped to S02.
- Added a synchronous in-flight ref in addition to the disabled button so two submit events in the same render window cannot create duplicate requests.
- Added a shared accessible toast primitive in `@sentinel/ui`; the portal owns its five-second lifecycle and vehicle-specific action.
- Adapted the confirmed create response into the dashboard's vehicle shape, inserted it once, and incremented the vehicle count before starting a non-blocking dashboard revalidation.
- The toast action navigates to and focuses the confirmed vehicle row, giving `View vehicle` a concrete keyboard-accessible result.
- Added database-level unique index on `(owner_organization_id, plate)` in `Vehicle.ts` and wrapped creation in `vehicle.service.ts` to catch `UniqueConstraintError` as defense-in-depth behind the `findOne` check.
- Form controls (type selection, marker style, marker color, marker size) now clear active error state on user interaction to provide responsive recovery feedback.
- Documented lock and duplicate guarantee: client-side synchronous ref + disabled button prevents multi-click duplication; server-side application check + database constraint ensures uniqueness under any concurrency condition.
- S05: Grouped translation keys into `common`, `status`, and `portal` domains in `en.ts`.
- S05: Replaced manual time formatting and `toLocaleString` in customer views with shared `formatDateTime`, `formatDate`, and `formatRelativeTime` helpers from `@sentinel/ui`.
- S05: Made `formatDateTime`, `formatDate`, and `formatRelativeTime` null-safe against missing or invalid timestamp values.
- S05: Translated all customer navigation items, overview metrics, map overlays/popups, vehicle directory, devices grid, alerts, privacy grants, notices, and vehicle studio form fields and preview copy through typed catalog keys.
- S06: Kept customer and reseller terminology distinct across navigation, metrics, headers, map titles, and status notices (e.g. "Customer fleet", "Customer inventory", "Granted location map", "Requires grant", "CUSTOMER ACCOUNT").
- S06: Translated locked/private map states for both zero-grant customer accounts and ungranted vehicles.
- S07: Kept the platform-admin privacy boundary explicit in the catalog and stopped rendering the API's English privacy-boundary fallback directly.
- S07: Added stable system-check IDs and numeric detail parameters to the admin response so dynamic counts can be formatted through the shared locale helpers while visible check names and descriptions come from translation keys.
- S07: Mapped API permission/unavailability failures to catalog messages rather than displaying server-provided English, and routed UTC clocks, dates, relative times, counts, and percentages through shared locale formatters.
- S07 review: Repaired the existing local SQLite schema in place instead of deleting `.data/sentinel.sqlite`, preserving all current demo vehicles while bringing it up to the marker-field contract used by the current model.
- S07 review: Kept the admin compatible with a still-running pre-change API process, and disabled Leaflet `fitBounds` animation to prevent unmount-time zoom callbacks in React Strict Mode.
- S08: Added a structurally typed Persian catalog covering every portal, reseller, platform-admin, status, and audit key while preserving IDs, codes, plates, serials, technical tokens, and interpolation placeholders.
- S08: Added a catalog assertion that compares leaf-key coverage and placeholder names against English. `fa.ts` also uses `satisfies Messages`, so missing, extra, or structurally incorrect keys fail TypeScript builds.
- S08: Kept `ACTIVE_LOCALES` set to English only; runtime Farsi selection, document language/direction, Persian date formatting, and RTL layout remained exclusively in S09.
- S09: Activated `en` and `fa`, centralized document language/direction synchronization in `I18nProvider`, and added a temporary development-only selector backed by local storage. Organization settings replace this QA source of truth in S10–S11.
- S09: Selected the Persian calendar (`fa-IR-u-ca-persian`) for user-facing dates while keeping API timestamps in ISO-8601 UTC.
- S09: Bundled `@fontsource-variable/vazirmatn` locally so Persian rendering does not depend on a remote font service.
- S09: Added the shared `LtrText` primitive and explicit LTR input/data islands instead of reversing plates, serials, coordinates, emails, IDs, or technical model/radio values in RTL.
- S09: Translated seeded alert summaries by stable alert `type` codes at the UI boundary; unknown/user-provided alert text still falls back to API content without altering stored values.
- S10: Added `Organization.defaultLocale` as a required `en | fa` setting with an English default; effective locale currently equals the organization default because user preferences are not yet implemented.
- S10: Added `GET`/`PATCH /api/organizations/:organizationId/settings`; readable customer scope follows existing member/service/platform access, while writes require platform support, the organization's own `ORG_ADMIN`, or a future `RESELLER_ADMIN` with an active customer relationship. Existing `SUPPORT_AGENT` remains read-only.
- S10: Audit events are written only for actual locale changes, not idempotent writes of the existing value.
- S10: Kept the no-migrations architecture and documented the destructive local reset required for existing SQLite/PostgreSQL demo databases instead of introducing a migration framework.
- S11: Removed the development/local-storage locale selector. `AppI18nProvider` now exposes a controlled locale setter, while the portal resolves from the active organization scope and the admin resolves from its platform session.
- S11: Added an owner `ORG_ADMIN` language control to Privacy & access and a platform-support language control to the customer organization table. Reseller `SUPPORT_AGENT` remains read-only and sees no control.
- S11: Kept the admin application's own language independent from customer settings; updating a customer locale does not change the platform session locale.
- S11: Added English fallback through the shared `resolveLocale` path and localized `ORGANIZATION_LOCALE_CHANGED` audit labels.
- S12: Fixed the provisioning role vocabulary as `PLATFORM_SUPPORT` / `PLATFORM_VIEWER`, `RESELLER_ADMIN` / `SUPPORT_AGENT` / `DEVICE_INSTALLER`, and `ORG_ADMIN` / `FLEET_MANAGER` / `PRIVACY_ADMIN` / `VIEWER`.
- S12: Defined delegated capabilities separately from roles. `FLEET_MANAGE` and `DEVICE_MANAGE` never grant location; `LOCATION_CURRENT` remains an independent customer-controlled grant.
- S12: Exposed read-only provisioning capability decisions through the session response for client affordances and black-box policy evidence. Mutation services remain responsible for re-checking centralized policy server-side.
- S12: Did not add lifecycle columns or a capability JSON field. Their owning packages must add queryable lifecycle fields and a normalized relationship-capability model.
- S12: Added a `user-reseller-admin` seed fixture for positive policy coverage and renamed the negative platform fixture role to `PLATFORM_VIEWER`. Existing non-empty local databases require the already-documented reset before those seed changes appear.
- S13: Added `Organization.status` and normalized platform-controlled `ResellerCapability` records; relationship-specific delegated capabilities remain a separate future model owned by later packages.
- S13: Kept reseller provisioning under platform-support authority, with strict validation for names, `en | fa`, `ACTIVE | SUSPENDED`, and the typed capability allowlist.
- S13: A suspended reseller retains data and read history but loses customer-provisioning mutation authority until reactivated. Capability entitlements never grant coordinates or private message content.
- S13: Used separate audit events for reseller creation, metadata changes, lifecycle changes, and capability changes, all inside the same database transaction as the mutation.
- S14: Added reseller provisioning as a distinct admin-console view instead of mixing resellers into the existing customer-organization directory.
- S14: Reused the shared accessible toast for confirmed mutation feedback, kept dialog values on server failure, and mapped stable API error codes to translated UI messages rather than displaying server text.
- S14: Kept capability descriptions explicit that operational entitlements never grant ownership, coordinates, or private content; invitations and initial administrator assignment remain gated on S28.
- S14: Rendered the wide reseller directory as mobile cards below 760 px so all actions remain available without page-level horizontal overflow.
- S15: Added `Organization.timezone` as an IANA time-zone identifier with `Europe/Berlin` as the schema default; customer provisioning validates supplied values through `Intl.DateTimeFormat`.
- S15: Kept customer creation under `CUSTOMER_PROVISION`, while customer metadata changes require `CUSTOMER_SETTINGS` and the reseller's active relationship to that exact customer. Neither capability grants location access.
- S15: Customer organization creation, active service-relationship creation, and their two audit events commit in a single transaction. No membership or identity artifacts are synthesized before the S28 identity decision.
- S15: Customer lifecycle changes update `Organization.status`; service-relationship lifecycle transitions remain a later explicit workflow and are not inferred from customer suspension.
- S16: Added customer management as a distinct reseller-admin workspace while retaining service desk, granted map, fleet, device, and alert views as separate customer operational workspaces.
- S16: Added the seeded reseller admin and support agent as separate demo role choices. Only the reseller admin receives the customer directory and mutation controls; server authorization remains authoritative.
- S16: Refreshes the reseller session after customer creation so the new active relationship immediately becomes an available operational scope without fabricating a customer membership.
- S16: Kept owner invitations visibly gated rather than adding a disabled or fake identity action; no user, password, token, or invitation fields appear in the customer dialog.
- S16: Customer management is fully typed and catalog-driven in English and Farsi, with automatic organization-locale RTL switching, Persian-calendar dates, and explicit LTR isolation for IDs and timezones.
- S17: Added normalized relationship-level delegated capabilities separately from platform-controlled reseller entitlements. Both `FLEET_MANAGE` layers are required, so a reseller-wide entitlement alone cannot authorize work for every customer.
- S17: Kept customer ownership unchanged on delegated creation and reused the existing audited vehicle service and Vehicle Studio rather than adding a parallel reseller-only mutation path.
- S17: Vehicle metadata creation never creates a location grant. Current coordinates remain controlled only by a live, customer-issued `LOCATION_CURRENT` grant.
- S17: Seeded delegation exists only for `relationship-1` (`org-customer`), leaving `org-private` as the explicit undelegated denial fixture.
- S18: Modeled lifecycle with nullable `Vehicle.archivedAt` plus explicit `createdAt` / `updatedAt` timestamps; archive is reversible and never performs destructive deletion.
- S18: Kept the main dashboard active-only and exposed a separate scoped vehicle list filter for archived records, so archived inspection does not distort active fleet metrics or operational views.
- S18: Reused the exact `canManageVehicles` policy for edit/archive/restore, keeping owner and relationship-delegated reseller behavior aligned without granting location access.
- S18: Preserved assignments and all related historical records in place. Telemetry simulation, default dashboard results, grant creation, and platform active counts exclude archived vehicles until restore.
- S19: Applied the existing two-layer delegation design to device assignments: reseller-wide `DEVICE_MANAGE` plus an active relationship carrying unrevoked `DEVICE_MANAGE`; authorized reseller roles are `RESELLER_ADMIN` and `DEVICE_INSTALLER`.
- S19: Required device custody and vehicle ownership to match the same customer organization, and rejected archived vehicles. Assignment authority does not grant current location, telemetry history, commands, or private content.
- S19: Preserved assignment history by timestamping `unassignedAt`; partial unique indexes plus transaction-time checks prevent conflicting active assignments for either resource.
- S19: Exposed scoped assignment history at `GET /api/device-assignments`, creation at `POST /api/device-assignments`, and end-state mutation at `DELETE /api/device-assignments/:assignmentId` for the later S20 UI.
- S19: Stored assignment audit events against assignment resource IDs and extended the customer audit query to include assignment resources belonging to the customer's vehicles.

## Blockers

- None for S20. Production identity, invitations, MFA, recovery, and federation remain blocked until the S28 identity ADR.

## Exact next action

Start S20 — Add device inventory and assignment UI. Do not begin S21 yet.
