import { sequelize } from './connection.js';
import {
  AccessGrant, Alert, AuditEvent, Device, DeviceAssignment, LatestPosition, Membership,
  Organization, ServiceRelationship, TelemetryEvent, User, Vehicle
} from '../models/index.js';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

export async function seedDatabase(force = false): Promise<void> {
  await sequelize.sync({ force });
  if (!force && await Organization.count() > 0) return;
  await sequelize.transaction(async transaction => {
    await Organization.bulkCreate([
      { id: 'org-platform', name: 'Sentinel Platform', type: 'PLATFORM' },
      { id: 'org-reseller', name: 'NordTrack Services', type: 'RESELLER' },
      { id: 'org-customer', name: 'Berlin Field Logistics', type: 'CUSTOMER' },
      { id: 'org-private', name: 'Meyer Household', type: 'CUSTOMER' }
    ], { transaction });
    await User.bulkCreate([
      { id: 'user-customer-admin', name: 'Maya Chen', email: 'maya@berlin-logistics.demo' },
      { id: 'user-reseller-support', name: 'Noah Fischer', email: 'noah@nordtrack.demo' },
      { id: 'user-platform-support', name: 'Ari Morgan', email: 'ari@sentinel.demo' }
    ], { transaction });
    await Membership.bulkCreate([
      { id: 'member-1', userId: 'user-customer-admin', organizationId: 'org-customer', role: 'ORG_ADMIN' },
      { id: 'member-2', userId: 'user-reseller-support', organizationId: 'org-reseller', role: 'SUPPORT_AGENT' },
      { id: 'member-3', userId: 'user-platform-support', organizationId: 'org-platform', role: 'PLATFORM_SUPPORT' }
    ], { transaction });
    await ServiceRelationship.bulkCreate([
      { id: 'relationship-1', resellerOrganizationId: 'org-reseller', customerOrganizationId: 'org-customer', status: 'ACTIVE', startedAt: minutesAgo(90_000) },
      { id: 'relationship-2', resellerOrganizationId: 'org-reseller', customerOrganizationId: 'org-private', status: 'ACTIVE', startedAt: minutesAgo(40_000) }
    ], { transaction });
    await Vehicle.bulkCreate([
      { id: 'vehicle-1', ownerOrganizationId: 'org-customer', name: 'Delivery Van 12', plate: 'B-FL 1204', kind: 'VAN' },
      { id: 'vehicle-2', ownerOrganizationId: 'org-customer', name: 'Service Car 07', plate: 'B-FL 0702', kind: 'CAR' },
      { id: 'vehicle-3', ownerOrganizationId: 'org-customer', name: 'Cargo Van 19', plate: 'B-FL 1901', kind: 'VAN' },
      { id: 'vehicle-4', ownerOrganizationId: 'org-customer', name: 'Pool Car 03', plate: 'B-FL 0308', kind: 'CAR' },
      { id: 'vehicle-private', ownerOrganizationId: 'org-private', name: 'Family Car', plate: 'B-MM 4431', kind: 'CAR' }
    ], { transaction });
    await Device.bulkCreate([
      { id: 'device-1', serial: 'NT-DE-210041', model: 'LTE-C1 Pilot', radio: 'LTE Cat 1 bis', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 91, signalQuality: 'GOOD', lastCommunicationAt: minutesAgo(1) },
      { id: 'device-2', serial: 'NT-DE-210052', model: 'LTE-C1 Pilot', radio: 'LTE Cat 1 bis', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 78, signalQuality: 'GOOD', lastCommunicationAt: minutesAgo(3) },
      { id: 'device-3', serial: 'NT-DE-210063', model: 'LTE-C1 Pilot', radio: 'LTE Cat 1 bis', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 39, signalQuality: 'FAIR', lastCommunicationAt: minutesAgo(18) },
      { id: 'device-4', serial: 'NT-DE-210074', model: 'LTE-C1 Pilot', radio: 'LTE Cat 1 bis', custodyOrganizationId: 'org-customer', status: 'QUARANTINED', batteryPercent: 16, signalQuality: 'UNKNOWN', lastCommunicationAt: minutesAgo(190) },
      { id: 'device-5', serial: 'NT-DE-210099', model: 'LTE-C1 Pilot', radio: 'LTE Cat 1 bis', custodyOrganizationId: 'org-private', status: 'ACTIVE', batteryPercent: 84, signalQuality: 'GOOD', lastCommunicationAt: minutesAgo(2) }
    ], { transaction });
    await DeviceAssignment.bulkCreate(['1','2','3','4'].map(value => ({ id: `assignment-${value}`, deviceId: `device-${value}`, vehicleId: `vehicle-${value}`, assignedAt: minutesAgo(60_000 - Number(value) * 10_000), unassignedAt: null })).concat([{ id: 'assignment-5', deviceId: 'device-5', vehicleId: 'vehicle-private', assignedAt: minutesAgo(10_000), unassignedAt: null }]), { transaction });
    const positions = [
      { vehicleId: 'vehicle-1', id: 'telemetry-seed-1', latitude: 52.5208, longitude: 13.4095, speedKph: 38, heading: 112, occurredAt: minutesAgo(1), quality: 'VALID' },
      { vehicleId: 'vehicle-2', id: 'telemetry-seed-2', latitude: 52.5073, longitude: 13.3762, speedKph: 0, heading: 248, occurredAt: minutesAgo(3), quality: 'VALID' },
      { vehicleId: 'vehicle-3', id: 'telemetry-seed-3', latitude: 52.5355, longitude: 13.3481, speedKph: 0, heading: 15, occurredAt: minutesAgo(18), quality: 'STALE' },
      { vehicleId: 'vehicle-4', id: 'telemetry-seed-4', latitude: 52.4917, longitude: 13.4513, speedKph: 0, heading: 0, occurredAt: minutesAgo(190), quality: 'STALE' },
      { vehicleId: 'vehicle-private', id: 'telemetry-seed-5', latitude: 52.5452, longitude: 13.4147, speedKph: 12, heading: 190, occurredAt: minutesAgo(2), quality: 'VALID' }
    ];
    await TelemetryEvent.bulkCreate(positions.map(position => ({ ...position, ingestedAt: position.occurredAt, schemaVersion: 1, source: 'SEEDED_SIMULATOR' })), { transaction });
    await LatestPosition.bulkCreate(positions.map(({ id, ...position }) => ({ ...position, eventId: id, ingestedAt: position.occurredAt })), { transaction });
    await Alert.bulkCreate([
      { id: 'alert-1', organizationId: 'org-customer', vehicleId: 'vehicle-3', type: 'DEVICE_OFFLINE', severity: 'HIGH', status: 'OPEN', occurredAt: minutesAgo(13), summary: 'Device has missed its expected reporting window.' },
      { id: 'alert-2', organizationId: 'org-customer', vehicleId: 'vehicle-4', type: 'DEVICE_QUARANTINED', severity: 'CRITICAL', status: 'OPEN', occurredAt: minutesAgo(175), summary: 'Device was quarantined after repeated session anomalies.' },
      { id: 'alert-3', organizationId: 'org-customer', vehicleId: 'vehicle-1', type: 'GEOFENCE_EXIT', severity: 'MEDIUM', status: 'ACKNOWLEDGED', occurredAt: minutesAgo(46), summary: 'Vehicle left the Berlin Mitte service zone.' }
    ], { transaction });
    await AccessGrant.create({ id: 'grant-1', vehicleId: 'vehicle-1', granteeOrganizationId: 'org-reseller', permission: 'LOCATION_CURRENT', purpose: 'Diagnose intermittent reporting requested by customer', createdBy: 'user-customer-admin', createdAt: minutesAgo(30), expiresAt: hoursFromNow(2), revokedAt: null }, { transaction });
    await AuditEvent.bulkCreate([
      { id: 'audit-1', actorId: 'user-customer-admin', action: 'ACCESS_GRANT_CREATED', resourceType: 'VEHICLE', resourceId: 'vehicle-1', outcome: 'SUCCESS', occurredAt: minutesAgo(30), details: { permission: 'LOCATION_CURRENT', durationHours: 2 } },
      { id: 'audit-2', actorId: 'user-reseller-support', action: 'LOCATION_VIEWED', resourceType: 'VEHICLE', resourceId: 'vehicle-1', outcome: 'SUCCESS', occurredAt: minutesAgo(8), details: { purpose: 'Customer support case NT-284' } },
      { id: 'audit-3', actorId: 'user-platform-support', action: 'LOCATION_VIEWED', resourceType: 'VEHICLE', resourceId: 'vehicle-1', outcome: 'DENIED', occurredAt: minutesAgo(5), details: { reason: 'No break-glass authorization' } }
    ], { transaction });
  });
}
