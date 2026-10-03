import { AccessGrant, Organization, ServiceRelationship, Vehicle } from '../models/index.js';
import { canManageGrants } from './policy.service.js';
import { recordAudit } from './audit.service.js';
import { HttpError } from '../utils/errors.js';

export async function listGrants(actorId: string, organizationId: string) {
  if (!await canManageGrants(actorId, organizationId)) throw new HttpError(403, 'GRANT_ADMIN_REQUIRED', 'Only customer privacy administrators may manage access grants.');
  const vehicles = await Vehicle.findAll({ where: { ownerOrganizationId: organizationId } });
  const vehicleNames = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.name]));
  const grants = await AccessGrant.findAll({ where: { vehicleId: vehicles.map(vehicle => vehicle.id) }, order: [['createdAt', 'DESC']] });
  // Resolve grantee names in a single query instead of one lookup per grant.
  const granteeIds = [...new Set(grants.map(grant => grant.granteeOrganizationId))];
  const grantees = granteeIds.length ? await Organization.findAll({ where: { id: granteeIds } }) : [];
  const granteeNames = new Map(grantees.map(organization => [organization.id, organization.name]));
  return grants.map(grant => ({
    ...grant.get(),
    vehicleName: vehicleNames.get(grant.vehicleId),
    granteeOrganizationName: granteeNames.get(grant.granteeOrganizationId)
  }));
}

export async function createGrant(actorId: string, input: { organizationId: string; vehicleId: string; durationHours: number; purpose: string }) {
  const organizationId = String(input.organizationId ?? '').trim();
  const vehicleId = String(input.vehicleId ?? '').trim();
  const purpose = String(input.purpose ?? '').trim();
  const hours = Number(input.durationHours);
  // Validate the request shape before any database access so malformed input is
  // always a client error rather than an internal error.
  if (!organizationId || !vehicleId || !Number.isFinite(hours) || hours < 1 || hours > 24 || purpose.length < 8) {
    throw new HttpError(400, 'INVALID_GRANT', 'Select a vehicle, a duration from 1 to 24 hours, and a meaningful purpose.');
  }
  if (!await canManageGrants(actorId, organizationId)) throw new HttpError(403, 'GRANT_ADMIN_REQUIRED', 'Only customer privacy administrators may manage access grants.');
  const vehicle = await Vehicle.findOne({ where: { id: vehicleId, ownerOrganizationId: organizationId } });
  const relationship = await ServiceRelationship.findOne({ where: { customerOrganizationId: organizationId, status: 'ACTIVE' } });
  if (!vehicle || !relationship) {
    throw new HttpError(400, 'INVALID_GRANT', 'Select a vehicle, a duration from 1 to 24 hours, and a meaningful purpose.');
  }
  const grant = await AccessGrant.create({
    id: `grant-${crypto.randomUUID()}`,
    vehicleId: vehicle.id,
    granteeOrganizationId: relationship.resellerOrganizationId,
    permission: 'LOCATION_CURRENT',
    purpose,
    createdBy: actorId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + hours * 3_600_000),
    revokedAt: null
  });
  await recordAudit({ actorId, action: 'ACCESS_GRANT_CREATED', resourceType: 'VEHICLE', resourceId: vehicle.id, outcome: 'SUCCESS', details: { permission: grant.permission, durationHours: hours, purpose: grant.purpose } });
  return grant.get();
}

export async function revokeGrant(actorId: string, grantId: string): Promise<void> {
  const grant = await AccessGrant.findByPk(grantId);
  const vehicle = grant ? await Vehicle.findByPk(grant.vehicleId) : null;
  if (!grant || !vehicle || !await canManageGrants(actorId, vehicle.ownerOrganizationId)) throw new HttpError(403, 'GRANT_ADMIN_REQUIRED', 'The grant cannot be revoked in this scope.');
  if (!grant.revokedAt) {
    grant.revokedAt = new Date();
    await grant.save();
    await recordAudit({ actorId, action: 'ACCESS_GRANT_REVOKED', resourceType: 'VEHICLE', resourceId: vehicle.id, outcome: 'SUCCESS', details: { grantId } });
  }
}
