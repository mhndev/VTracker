import { Op } from 'sequelize';
import { Alert, AuditEvent, Device, DeviceAssignment, Organization, ServiceRelationship, TelemetryEvent, User, Vehicle } from '../models/index.js';
import { HttpError } from '../utils/errors.js';
import { hasPlatformRole } from './policy.service.js';
import { isDeviceOnline } from './dashboard.service.js';

export async function getAdminOverview(actorId: string) {
  if (!await hasPlatformRole(actorId)) throw new HttpError(403, 'PLATFORM_ADMIN_REQUIRED', 'This endpoint is restricted to the platform administration plane.');
  const [actor, customers, resellers, devices, alerts, telemetryCount, auditEvents, relationships, vehicles, assignments] = await Promise.all([
    User.findByPk(actorId),
    Organization.findAll({ where: { type: 'CUSTOMER' } }),
    Organization.findAll({ where: { type: 'RESELLER' } }),
    Device.findAll(),
    Alert.findAll(),
    TelemetryEvent.count(),
    AuditEvent.findAll({ order: [['occurredAt', 'DESC']], limit: 8 }),
    ServiceRelationship.findAll({ where: { status: 'ACTIVE' } }),
    Vehicle.findAll(),
    DeviceAssignment.findAll({ where: { unassignedAt: null } })
  ]);
  const onlineDevices = devices.filter(isDeviceOnline);
  // Resolve audit actor names in one query instead of one lookup per event.
  const auditActorIds = [...new Set(auditEvents.map(event => event.actorId))];
  const auditActors = auditActorIds.length ? await User.findAll({ where: { id: { [Op.in]: auditActorIds } } }) : [];
  const auditActorNames = new Map(auditActors.map(item => [item.id, item.name]));
  const organizationViews = customers.map(organization => {
    const ownedVehicles = vehicles.filter(vehicle => vehicle.ownerOrganizationId === organization.id);
    const vehicleIds = new Set(ownedVehicles.map(vehicle => vehicle.id));
    const deviceIds = new Set(assignments.filter(assignment => vehicleIds.has(assignment.vehicleId)).map(assignment => assignment.deviceId));
    const ownedDevices = devices.filter(device => deviceIds.has(device.id));
    const relationship = relationships.find(item => item.customerOrganizationId === organization.id);
    const reseller = resellers.find(item => item.id === relationship?.resellerOrganizationId);
    return {
      id: organization.id,
      name: organization.name,
      resellerName: reseller?.name ?? 'Direct',
      vehicles: ownedVehicles.length,
      devices: ownedDevices.length,
      onlineDevices: ownedDevices.filter(isDeviceOnline).length,
      openAlerts: alerts.filter(alert => alert.organizationId === organization.id && alert.status === 'OPEN').length,
      serviceStatus: 'ACTIVE'
    };
  });
  return {
    actor: actor?.get(),
    generatedAt: new Date(),
    privacyBoundary: 'Platform operations receives aggregate health and inventory metadata only. Coordinates are omitted.',
    stats: {
      customers: customers.length,
      resellers: resellers.length,
      devices: devices.length,
      onlineDevices: onlineDevices.length,
      openAlerts: alerts.filter(alert => alert.status === 'OPEN').length,
      quarantinedDevices: devices.filter(device => device.status === 'QUARANTINED').length
    },
    organizations: organizationViews,
    devices: devices.map(device => ({
      id: device.id,
      serial: device.serial,
      model: device.model,
      radio: device.radio,
      status: isDeviceOnline(device) ? 'ONLINE' : device.status === 'QUARANTINED' ? 'QUARANTINED' : 'OFFLINE',
      signalQuality: device.signalQuality,
      lastCommunicationAt: device.lastCommunicationAt,
      custodyOrganizationName: customers.concat(resellers).find(organization => organization.id === device.custodyOrganizationId)?.name ?? 'Unassigned'
    })),
    systemChecks: [
      { id: 'gateway', name: 'Device gateway', status: 'OPERATIONAL', detail: `${onlineDevices.length} live device sessions` },
      { id: 'ingestion', name: 'Telemetry ingestion', status: 'OPERATIONAL', detail: `${telemetryCount} events retained locally` },
      { id: 'policy', name: 'Authorization policy', status: 'OPERATIONAL', detail: 'Resource grants enforced' },
      { id: 'commands', name: 'High-risk commands', status: 'DISABLED', detail: 'Safety decision gate not satisfied' }
    ],
    recentAudit: auditEvents.map(event => ({ ...event.get(), actorName: auditActorNames.get(event.actorId) ?? 'System' }))
  };
}