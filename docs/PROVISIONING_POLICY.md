# Sentinel Fleet provisioning policy and contracts

Status: approved implementation contract for S12. Provisioning mutation endpoints begin in S13; this document does not authorize invitation or login flows.

## Role and capability matrix

| Scope | Role | Provisioning authority |
| --- | --- | --- |
| Platform | `PLATFORM_SUPPORT` | Create and manage reseller organizations; read aggregate operational metadata; never receive customer coordinates or private message content |
| Platform | `PLATFORM_VIEWER` | Read-only platform views; no provisioning mutations |
| Reseller | `RESELLER_ADMIN` | Create and manage customer organizations for its own reseller organization; update customer settings only through an active relationship and permitted policy |
| Reseller | `SUPPORT_AGENT` | Read allowed operational support data; no provisioning, fleet, device-assignment, or settings mutations |
| Reseller | `DEVICE_INSTALLER` | Reserved for explicitly delegated device work; no authority until `DEVICE_MANAGE` is active for the customer relationship |
| Customer | `ORG_ADMIN` | Manage customer settings, vehicles, device assignments, privacy grants, and future memberships in its own organization |
| Customer | `FLEET_MANAGER` | Manage vehicles and device assignments in its own organization; no privacy-grant or membership administration |
| Customer | `PRIVACY_ADMIN` | Manage location grants in its own organization; no fleet provisioning by role alone |
| Customer | `VIEWER` | Read-only access to owned customer resources |

Membership role names are defined in `src/apps/api/src/contracts/provisioning.contracts.ts`. A role is always interpreted with the membership organization's type; a matching string in the wrong organization type grants nothing.

## Lifecycle contracts

- Organization lifecycle: `ACTIVE | SUSPENDED`.
- Service relationship lifecycle: `ACTIVE | SUSPENDED | ENDED`.
- Only an `ACTIVE` service relationship can convey reseller operational or delegated administration scope.
- Suspension stops new reseller-scoped mutations without deleting organizations, vehicles, assignments, grants, or audit history.
- `ENDED` is terminal for that relationship record. Re-establishing service creates a new relationship instead of rewriting history.
- Location grants remain independently time-limited and revocable. Relationship status or delegated administration never substitutes for `LOCATION_CURRENT`.

S13 added the queryable `Organization.status` lifecycle column and a normalized `ResellerCapability` table for platform-controlled reseller entitlements. S15 added `Organization.timezone` and reseller-scoped customer list/create/update APIs; customer creation and its active service relationship commit in one transaction. `CUSTOMER_PROVISION` gates creation, while `CUSTOMER_SETTINGS` plus an active relationship gates metadata changes. S17 added normalized relationship-level delegation and uses it for reseller vehicle creation. S19 applies the same two-layer delegation contract to device assignments. Authorization-critical permissions are not stored in an opaque JSON blob. Existing local databases require the documented reset before new seeded capabilities appear.

## Delegated reseller capabilities

| Capability | Meaning | Does not grant |
| --- | --- | --- |
| `CUSTOMER_PROVISION` | Create a customer and its service relationship inside the reseller's own scope | Membership invitations, location, fleet, or device access |
| `CUSTOMER_SETTINGS` | Update allowed customer metadata through an active relationship | Customer ownership, membership management, or location |
| `FLEET_MANAGE` | Create/edit/archive customer-owned vehicle metadata | Location, telemetry history, or device-message content |
| `DEVICE_MANAGE` | List assignment history and assign/unassign same-customer devices and vehicles | Location, commands, or private messages |
| `SUPPORT_OPERATIONS` | Read allowed health/support metadata | Coordinates or customer-private content |

Delegated capability names are defined in `provisioning.contracts.ts`. S17 implements the normalized `ServiceRelationshipCapability` persistence contract with a unique `(serviceRelationshipId, capability)` key, grant/revoke timestamps, and actor attribution. A reseller-wide entitlement and an active relationship-level capability are both required for delegated fleet management.

## Central policy decisions

The API session returns read-only `provisioningCapabilities` derived by `policy.service.ts`:

- `createResellers`
- `createCustomersForResellerIds`
- `manageVehiclesForCustomerIds`
- `manageDeviceAssignmentsForCustomerIds`
- `platformCustomerLocationAccess: 'NONE'`

These values help clients hide impossible actions but are not an authorization boundary. Every mutation service must call the matching centralized policy function again. S17 populates `manageVehiclesForCustomerIds` for a `RESELLER_ADMIN` only when the reseller organization is active, has the reseller-wide `FLEET_MANAGE` entitlement, and has an active service relationship carrying an unrevoked relationship-level `FLEET_MANAGE` delegation. S19 populates `manageDeviceAssignmentsForCustomerIds` for `RESELLER_ADMIN` / `DEVICE_INSTALLER` under the equivalent two-layer `DEVICE_MANAGE` contract. Customer `ORG_ADMIN` / `FLEET_MANAGER` roles retain assignment authority only in their own organization.

Assignment creation additionally requires an active vehicle, a device held in custody by the same customer that owns the vehicle, and no existing active assignment for either resource. Ending an assignment timestamps `unassignedAt`; it never deletes history. Neither action creates location access.

## Audit action names

Provisioning packages must use the typed action names in `PROVISIONING_AUDIT_ACTIONS`: reseller/customer creation and updates, lifecycle changes, relationship creation, delegated-capability changes, vehicle lifecycle actions, and device assign/unassign actions. Stored action codes remain stable English identifiers; localization happens only in the UI.

## Identity decision gate

The production IdP, MFA, invitation, recovery, federation, and external-identity mapping decisions are still unresolved. Therefore:

- S12 defines roles and policy only.
- S13–S27 must not invent passwords, login tokens, invitation secrets, or owner-user creation flows.
- Initial reseller/customer administrator invitation remains blocked until S28 produces an approved identity ADR.
