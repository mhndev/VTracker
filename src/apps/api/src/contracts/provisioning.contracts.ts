export const PLATFORM_ROLES = ['PLATFORM_SUPPORT', 'PLATFORM_VIEWER'] as const;
export const RESELLER_ROLES = ['RESELLER_ADMIN', 'SUPPORT_AGENT', 'DEVICE_INSTALLER'] as const;
export const CUSTOMER_ROLES = ['ORG_ADMIN', 'FLEET_MANAGER', 'PRIVACY_ADMIN', 'VIEWER'] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type ResellerRole = (typeof RESELLER_ROLES)[number];
export type CustomerRole = (typeof CUSTOMER_ROLES)[number];
export type MembershipRole = PlatformRole | ResellerRole | CustomerRole;

export const ORGANIZATION_LIFECYCLE = ['ACTIVE', 'SUSPENDED'] as const;
export const SERVICE_RELATIONSHIP_LIFECYCLE = ['ACTIVE', 'SUSPENDED', 'ENDED'] as const;
export type OrganizationLifecycle = (typeof ORGANIZATION_LIFECYCLE)[number];
export type ServiceRelationshipLifecycle = (typeof SERVICE_RELATIONSHIP_LIFECYCLE)[number];

export const DELEGATED_CAPABILITIES = [
  'CUSTOMER_PROVISION',
  'CUSTOMER_SETTINGS',
  'FLEET_MANAGE',
  'DEVICE_MANAGE',
  'SUPPORT_OPERATIONS'
] as const;
export type DelegatedCapability = (typeof DELEGATED_CAPABILITIES)[number];

export const PROVISIONING_AUDIT_ACTIONS = [
  'RESELLER_CREATED',
  'RESELLER_UPDATED',
  'RESELLER_LIFECYCLE_CHANGED',
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'SERVICE_RELATIONSHIP_CREATED',
  'SERVICE_RELATIONSHIP_LIFECYCLE_CHANGED',
  'DELEGATED_CAPABILITIES_CHANGED',
  'VEHICLE_CREATED',
  'VEHICLE_UPDATED',
  'VEHICLE_ARCHIVED',
  'VEHICLE_RESTORED',
  'DEVICE_ASSIGNED',
  'DEVICE_UNASSIGNED'
] as const;
export type ProvisioningAuditAction = (typeof PROVISIONING_AUDIT_ACTIONS)[number];

export interface ProvisioningCapabilities {
  createResellers: boolean;
  createCustomersForResellerIds: string[];
  manageVehiclesForCustomerIds: string[];
  manageDeviceAssignmentsForCustomerIds: string[];
  platformCustomerLocationAccess: 'NONE';
}
