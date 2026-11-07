import { Op } from 'sequelize';
import { AccessGrant, Membership, Organization, ResellerCapability, ServiceRelationship, ServiceRelationshipCapability, Vehicle } from '../models/index.js';
import type { ProvisioningCapabilities } from '../contracts/provisioning.contracts.js';

export type AccessMode = 'member' | 'service' | 'platform';

export interface ActorContext {
  memberships: Membership[];
  organizationIds: string[];
  resellerOrganizationIds: string[];
  isPlatform: boolean;
}

// Loads the actor's memberships once so per-vehicle/per-organization checks
// (canViewLocation, getAccessMode) can reuse it instead of re-querying
// Membership/Organization for every item in a list (previously an N+1 pattern).
export async function getActorContext(actorId: string): Promise<ActorContext> {
  const memberships = await Membership.findAll({ where: { userId: actorId } });
  const organizationIds = memberships.map(item => item.organizationId);
  if (!organizationIds.length) {
    return { memberships, organizationIds, resellerOrganizationIds: [], isPlatform: false };
  }
  const organizations = await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });
  const platformOrganizationIds = new Set(organizations.filter(item => item.type === 'PLATFORM').map(item => item.id));
  return {
    memberships,
    organizationIds,
    resellerOrganizationIds: organizations.filter(item => item.type === 'RESELLER').map(item => item.id),
    isPlatform: memberships.some(item => item.role === 'PLATFORM_SUPPORT' && platformOrganizationIds.has(item.organizationId))
  };
}

export async function getMembership(actorId: string, organizationId: string): Promise<Membership | null> {
  return Membership.findOne({ where: { userId: actorId, organizationId } });
}

export async function hasPlatformRole(actorId: string): Promise<boolean> {
  const memberships = await Membership.findAll({ where: { userId: actorId, role: 'PLATFORM_SUPPORT' } });
  if (!memberships.length) return false;
  const organizationIds = memberships.map(item => item.organizationId);
  return Boolean(await Organization.findOne({ where: { id: { [Op.in]: organizationIds }, type: 'PLATFORM' } }));
}

export async function getResellerOrganizationIds(actorId: string): Promise<string[]> {
  const memberships = await Membership.findAll({ where: { userId: actorId } });
  const organizations = await Organization.findAll({ where: { id: { [Op.in]: memberships.map(item => item.organizationId) }, type: 'RESELLER' } });
  return organizations.map(item => item.id);
}

export async function getAccessMode(actorId: string, customerOrganizationId: string, context?: ActorContext): Promise<AccessMode | null> {
  const ctx = context ?? await getActorContext(actorId);
  if (ctx.organizationIds.includes(customerOrganizationId)) return 'member';
  if (ctx.resellerOrganizationIds.length && await ServiceRelationship.findOne({ where: { resellerOrganizationId: { [Op.in]: ctx.resellerOrganizationIds }, customerOrganizationId, status: 'ACTIVE' } })) return 'service';
  if (ctx.isPlatform) return 'platform';
  return null;
}

export async function canViewLocation(actorId: string, vehicleId: string, at = new Date(), context?: ActorContext, knownVehicle?: Vehicle | null): Promise<boolean> {
  const vehicle = knownVehicle ?? await Vehicle.findByPk(vehicleId);
  if (!vehicle) return false;
  const ctx = context ?? await getActorContext(actorId);
  if (ctx.organizationIds.includes(vehicle.ownerOrganizationId)) return true;
  if (!ctx.resellerOrganizationIds.length) return false;
  return Boolean(await AccessGrant.findOne({ where: {
    vehicleId,
    granteeOrganizationId: { [Op.in]: ctx.resellerOrganizationIds },
    permission: 'LOCATION_CURRENT',
    revokedAt: null,
    expiresAt: { [Op.gt]: at }
  } }));
}

export async function canManageGrants(actorId: string, organizationId: string): Promise<boolean> {
  const membership = await getMembership(actorId, organizationId);
  return Boolean(membership && ['ORG_ADMIN', 'PRIVACY_ADMIN'].includes(membership.role));
}

export async function canSimulateTelemetry(actorId: string, organizationId: string): Promise<boolean> {
  const membership = await getMembership(actorId, organizationId);
  return Boolean(membership && ['ORG_ADMIN', 'FLEET_MANAGER'].includes(membership.role));
}

export async function canManageVehicles(actorId: string, organizationId: string): Promise<boolean> {
  return (await getProvisioningCapabilities(actorId)).manageVehiclesForCustomerIds.includes(organizationId);
}

export async function canCreateResellers(actorId: string): Promise<boolean> {
  return (await getProvisioningCapabilities(actorId)).createResellers;
}

export async function canCreateCustomers(actorId: string, resellerOrganizationId: string): Promise<boolean> {
  return (await getProvisioningCapabilities(actorId)).createCustomersForResellerIds.includes(resellerOrganizationId);
}

export async function canManageCustomerSettings(actorId: string, resellerOrganizationId: string): Promise<boolean> {
  const membership = await Membership.findOne({ where: {
    userId: actorId,
    organizationId: resellerOrganizationId,
    role: 'RESELLER_ADMIN'
  } });
  if (!membership) return false;
  const reseller = await Organization.findOne({ where: {
    id: resellerOrganizationId,
    type: 'RESELLER',
    status: 'ACTIVE'
  } });
  if (!reseller) return false;
  return Boolean(await ResellerCapability.findOne({ where: {
    resellerOrganizationId,
    capability: 'CUSTOMER_SETTINGS'
  } }));
}

export async function canManageDeviceAssignments(actorId: string, customerOrganizationId: string): Promise<boolean> {
  return (await getProvisioningCapabilities(actorId)).manageDeviceAssignmentsForCustomerIds.includes(customerOrganizationId);
}

export async function getProvisioningCapabilities(actorId: string): Promise<ProvisioningCapabilities> {
  const memberships = await Membership.findAll({ where: { userId: actorId } });
  const organizationIds = memberships.map(item => item.organizationId);
  const organizations = organizationIds.length
    ? await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } })
    : [];
  const organizationById = new Map(organizations.map(organization => [organization.id, organization]));
  const resellerOrganizationIds = organizations.filter(organization => organization.type === 'RESELLER').map(organization => organization.id);
  const resellerCapabilities = resellerOrganizationIds.length
    ? await ResellerCapability.findAll({ where: { resellerOrganizationId: { [Op.in]: resellerOrganizationIds } } })
    : [];
  const customerProvisionResellerIds = new Set(resellerCapabilities.filter(item => item.capability === 'CUSTOMER_PROVISION').map(item => item.resellerOrganizationId));
  const fleetManageResellerIds = new Set(resellerCapabilities.filter(item => item.capability === 'FLEET_MANAGE').map(item => item.resellerOrganizationId));
  const deviceManageResellerIds = new Set(resellerCapabilities.filter(item => item.capability === 'DEVICE_MANAGE').map(item => item.resellerOrganizationId));
  const createCustomersForResellerIds = memberships
    .filter(membership => membership.role === 'RESELLER_ADMIN'
      && organizationById.get(membership.organizationId)?.type === 'RESELLER'
      && organizationById.get(membership.organizationId)?.status === 'ACTIVE'
      && customerProvisionResellerIds.has(membership.organizationId))
    .map(membership => membership.organizationId);
  const customerFleetMemberships = memberships.filter(membership =>
    ['ORG_ADMIN', 'FLEET_MANAGER'].includes(membership.role)
    && organizationById.get(membership.organizationId)?.type === 'CUSTOMER'
  );
  const authorizedResellerAdminIds = memberships
    .filter(membership => membership.role === 'RESELLER_ADMIN'
      && organizationById.get(membership.organizationId)?.type === 'RESELLER'
      && organizationById.get(membership.organizationId)?.status === 'ACTIVE'
      && fleetManageResellerIds.has(membership.organizationId))
    .map(membership => membership.organizationId);
  const activeFleetRelationships = authorizedResellerAdminIds.length
    ? await ServiceRelationship.findAll({ where: { resellerOrganizationId: { [Op.in]: authorizedResellerAdminIds }, status: 'ACTIVE' } })
    : [];
  const relationshipCapabilities = activeFleetRelationships.length
    ? await ServiceRelationshipCapability.findAll({ where: {
        serviceRelationshipId: { [Op.in]: activeFleetRelationships.map(relationship => relationship.id) },
        capability: 'FLEET_MANAGE',
        revokedAt: null
      } })
    : [];
  const delegatedRelationshipIds = new Set(relationshipCapabilities.map(item => item.serviceRelationshipId));
  const delegatedCustomerIds = activeFleetRelationships
    .filter(relationship => delegatedRelationshipIds.has(relationship.id))
    .map(relationship => relationship.customerOrganizationId);
  const authorizedDeviceResellerIds = memberships
    .filter(membership => ['RESELLER_ADMIN', 'DEVICE_INSTALLER'].includes(membership.role)
      && organizationById.get(membership.organizationId)?.type === 'RESELLER'
      && organizationById.get(membership.organizationId)?.status === 'ACTIVE'
      && deviceManageResellerIds.has(membership.organizationId))
    .map(membership => membership.organizationId);
  const activeDeviceRelationships = authorizedDeviceResellerIds.length
    ? await ServiceRelationship.findAll({ where: { resellerOrganizationId: { [Op.in]: authorizedDeviceResellerIds }, status: 'ACTIVE' } })
    : [];
  const deviceRelationshipCapabilities = activeDeviceRelationships.length
    ? await ServiceRelationshipCapability.findAll({ where: {
        serviceRelationshipId: { [Op.in]: activeDeviceRelationships.map(relationship => relationship.id) },
        capability: 'DEVICE_MANAGE',
        revokedAt: null
      } })
    : [];
  const delegatedDeviceRelationshipIds = new Set(deviceRelationshipCapabilities.map(item => item.serviceRelationshipId));
  const delegatedDeviceCustomerIds = activeDeviceRelationships
    .filter(relationship => delegatedDeviceRelationshipIds.has(relationship.id))
    .map(relationship => relationship.customerOrganizationId);
  return {
    createResellers: memberships.some(membership =>
      membership.role === 'PLATFORM_SUPPORT'
      && organizationById.get(membership.organizationId)?.type === 'PLATFORM'
    ),
    createCustomersForResellerIds,
    manageVehiclesForCustomerIds: [...new Set([...customerFleetMemberships.map(membership => membership.organizationId), ...delegatedCustomerIds])],
    manageDeviceAssignmentsForCustomerIds: [...new Set([...customerFleetMemberships.map(membership => membership.organizationId), ...delegatedDeviceCustomerIds])],
    platformCustomerLocationAccess: 'NONE'
  };
}

export async function canReadOrganizationSettings(actorId: string, organizationId: string): Promise<boolean> {
  const organization = await Organization.findByPk(organizationId);
  if (!organization) return false;
  if (organization.type === 'CUSTOMER') return Boolean(await getAccessMode(actorId, organizationId));
  return Boolean(await getMembership(actorId, organizationId)) || await hasPlatformRole(actorId);
}

export async function canUpdateOrganizationSettings(actorId: string, organizationId: string): Promise<boolean> {
  if (await hasPlatformRole(actorId)) return true;
  const membership = await getMembership(actorId, organizationId);
  if (membership?.role === 'ORG_ADMIN') return true;
  const resellerOrganizationIds = await getResellerOrganizationIds(actorId);
  if (!resellerOrganizationIds.length) return false;
  const resellerAdminMembership = await Membership.findOne({ where: {
    userId: actorId,
    organizationId: { [Op.in]: resellerOrganizationIds },
    role: 'RESELLER_ADMIN'
  } });
  if (!resellerAdminMembership) return false;
  return Boolean(await ServiceRelationship.findOne({ where: {
    resellerOrganizationId: resellerAdminMembership.organizationId,
    customerOrganizationId: organizationId,
    status: 'ACTIVE'
  } }));
}
