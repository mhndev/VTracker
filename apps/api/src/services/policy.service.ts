import { Op } from 'sequelize';
import { AccessGrant, Membership, Organization, ServiceRelationship, Vehicle } from '../models/index.js';

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
  return {
    memberships,
    organizationIds,
    resellerOrganizationIds: organizations.filter(item => item.type === 'RESELLER').map(item => item.id),
    isPlatform: organizations.some(item => item.type === 'PLATFORM')
  };
}

export async function getMembership(actorId: string, organizationId: string): Promise<Membership | null> {
  return Membership.findOne({ where: { userId: actorId, organizationId } });
}

export async function hasPlatformRole(actorId: string): Promise<boolean> {
  const memberships = await Membership.findAll({ where: { userId: actorId } });
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
