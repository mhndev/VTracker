import { Op } from 'sequelize';
import { Alert, Device, DeviceAssignment, LatestPosition, Organization, Vehicle } from '../models/index.js';
import { canViewLocation, getAccessMode, getActorContext } from './policy.service.js';
import { recordAudit } from './audit.service.js';

export function isDeviceOnline(device: Device): boolean {
  return device.status === 'ACTIVE' && Date.now() - device.lastCommunicationAt.getTime() < 10 * 60_000;
}

export async function getDashboard(actorId: string, organizationId: string) {
  const organization = await Organization.findOne({ where: { id: organizationId, type: 'CUSTOMER' } });
  const context = await getActorContext(actorId);
  const mode = await getAccessMode(actorId, organizationId, context);
  if (!organization || !mode) return null;
  const vehicles = await Vehicle.findAll({ where: { ownerOrganizationId: organizationId } });
  const vehicleIds = vehicles.map(vehicle => vehicle.id);
  // Batch the per-vehicle projections (assignment, device, latest position) into
  // one query each instead of querying inside the per-vehicle loop.
  const assignments = vehicleIds.length ? await DeviceAssignment.findAll({ where: { vehicleId: { [Op.in]: vehicleIds }, unassignedAt: null } }) : [];
  const devices = assignments.length ? await Device.findAll({ where: { id: { [Op.in]: assignments.map(assignment => assignment.deviceId) } } }) : [];
  const positions = vehicleIds.length ? await LatestPosition.findAll({ where: { vehicleId: { [Op.in]: vehicleIds } } }) : [];
  const deviceById = new Map(devices.map(device => [device.id, device]));
  const deviceByVehicleId = new Map(assignments.map(assignment => [assignment.vehicleId, deviceById.get(assignment.deviceId)]));
  const positionByVehicleId = new Map(positions.map(position => [position.vehicleId, position]));
  const viewedAt = new Date();
  const projectedVehicles = await Promise.all(vehicles.map(async vehicle => {
    const device = deviceByVehicleId.get(vehicle.id) ?? null;
    const locationAccess = await canViewLocation(actorId, vehicle.id, viewedAt, context, vehicle);
    const projectedLocation = locationAccess ? positionByVehicleId.get(vehicle.id) : undefined;
    // Cross-tenant (non-member) location views are privacy-sensitive and must be
    // auditable. Member (owning-organization) views are the customer's own data
    // and are not audited to avoid flooding the log with routine self-access.
    if (projectedLocation && mode !== 'member') {
      await recordAudit({
        actorId,
        action: 'LOCATION_VIEWED',
        resourceType: 'VEHICLE',
        resourceId: vehicle.id,
        outcome: 'SUCCESS',
        details: { accessMode: mode }
      });
    }
    return {
      ...vehicle.get(),
      device: device ? { ...device.get(), status: isDeviceOnline(device) ? 'ONLINE' : device.status === 'QUARANTINED' ? 'QUARANTINED' : 'OFFLINE' } : undefined,
      location: projectedLocation?.get(),
      locationAccess
    };
  }));
  const alerts = await Alert.findAll({ where: { organizationId }, order: [['occurredAt', 'DESC']] });
  const alertVehicleIds = [...new Set(alerts.map(alert => alert.vehicleId))];
  const alertVehicles = alertVehicleIds.length ? await Vehicle.findAll({ where: { id: { [Op.in]: alertVehicleIds } } }) : [];
  const alertVehicleNames = new Map(alertVehicles.map(vehicle => [vehicle.id, vehicle.name]));
  const alertViews = alerts.map(alert => ({ ...alert.get(), vehicleName: alertVehicleNames.get(alert.vehicleId) ?? 'Unknown vehicle' }));
  return {
    organization: organization.get(),
    accessMode: mode,
    stats: {
      vehicles: projectedVehicles.length,
      online: projectedVehicles.filter(vehicle => vehicle.device?.status === 'ONLINE').length,
      activeAlerts: alertViews.filter(alert => alert.status === 'OPEN').length,
      locationVisible: projectedVehicles.filter(vehicle => vehicle.locationAccess).length
    },
    vehicles: projectedVehicles,
    alerts: alertViews,
    capabilities: { remoteImmobilization: false, reason: 'Excluded until hardware, legal, safety, and end-to-end verification gates are satisfied.' }
  };
}
