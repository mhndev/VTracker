import { sequelize } from './connection.js';
import {
  AccessGrant, Alert, AuditEvent, Device, DeviceAssignment, DeviceMessageLog, DeviceProtocolProfile, LatestPosition, Membership,
  Organization, OrganizationRetentionPolicy, ResellerCapability, RetentionPolicy, ServiceRelationship,
  ResellerDeviceProtocolAvailability, ServiceRelationshipCapability, TelemetryEvent, User, Vehicle
} from '../models/index.js';
import { seedProtocolCatalog } from './protocol-catalog.js';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

export async function seedDatabase(force = false): Promise<void> {
  await seedProtocolCatalog();
  await RetentionPolicy.bulkCreate([
    { id: 'retention-1-month', name: '1 month', logRetentionDays: 30, estimatedMessagesPerVehiclePerDay: 1440, averageMessageBytes: 600, estimatedTelemetryEventsPerVehiclePerDay: 1440, averageTelemetryEventBytes: 160, estimatedTripsPerVehiclePerDay: 4, maxPointsPerTrip: 100, averageTripPointBytes: 128 },
    { id: 'retention-6-months', name: '6 months', logRetentionDays: 183, estimatedMessagesPerVehiclePerDay: 1440, averageMessageBytes: 600, estimatedTelemetryEventsPerVehiclePerDay: 1440, averageTelemetryEventBytes: 160, estimatedTripsPerVehiclePerDay: 4, maxPointsPerTrip: 100, averageTripPointBytes: 128 },
    { id: 'retention-1-year', name: '1 year', logRetentionDays: 365, estimatedMessagesPerVehiclePerDay: 1440, averageMessageBytes: 600, estimatedTelemetryEventsPerVehiclePerDay: 1440, averageTelemetryEventBytes: 160, estimatedTripsPerVehiclePerDay: 4, maxPointsPerTrip: 100, averageTripPointBytes: 128 },
    { id: 'retention-5-years', name: '5 years', logRetentionDays: 1826, estimatedMessagesPerVehiclePerDay: 1440, averageMessageBytes: 600, estimatedTelemetryEventsPerVehiclePerDay: 1440, averageTelemetryEventBytes: 160, estimatedTripsPerVehiclePerDay: 4, maxPointsPerTrip: 100, averageTripPointBytes: 128 }
  ], { ignoreDuplicates: true });
  if (!force && await Organization.count() > 0) {
    const customers = await Organization.findAll({ where: { type: 'CUSTOMER' } });
    for (const customer of customers) {
      await OrganizationRetentionPolicy.findOrCreate({
        where: { organizationId: customer.id },
        defaults: { organizationId: customer.id, retentionPolicyId: 'retention-1-month', assignedAt: new Date(), assignedBy: null }
      });
    }
    const [resellers, protocolProfiles] = await Promise.all([
      Organization.findAll({ where: { type: 'RESELLER' } }),
      DeviceProtocolProfile.findAll()
    ]);
    for (const reseller of resellers) {
      for (const profile of protocolProfiles) {
        await ResellerDeviceProtocolAvailability.findOrCreate({
          where: { resellerOrganizationId: reseller.id, protocolProfileId: profile.id },
          defaults: {
            id: `device-availability-${reseller.id}-${profile.id}`,
            resellerOrganizationId: reseller.id,
            protocolProfileId: profile.id,
            available: profile.id === 'protocol-coban-gps103',
            updatedAt: new Date(),
            updatedBy: null
          }
        });
      }
    }
    return;
  }
  await sequelize.transaction(async transaction => {
    await Organization.bulkCreate([
      { id: 'org-platform', name: 'Sentinel Platform', type: 'PLATFORM', defaultLocale: 'en', status: 'ACTIVE' },
      { id: 'org-reseller', name: 'NordTrack Services', type: 'RESELLER', defaultLocale: 'en', status: 'ACTIVE' },
      { id: 'org-customer', name: 'Berlin Field Logistics', type: 'CUSTOMER', defaultLocale: 'en', status: 'ACTIVE' },
      { id: 'org-private', name: 'Meyer Household', type: 'CUSTOMER', defaultLocale: 'en', status: 'ACTIVE' }
    ], { transaction });
    await OrganizationRetentionPolicy.bulkCreate([
      { organizationId: 'org-customer', retentionPolicyId: 'retention-1-month', assignedAt: new Date(), assignedBy: null },
      { organizationId: 'org-private', retentionPolicyId: 'retention-1-month', assignedAt: new Date(), assignedBy: null }
    ], { transaction });
    await User.bulkCreate([
      { id: 'user-customer-admin', name: 'Maya Chen', email: 'maya@berlin-logistics.demo' },
      { id: 'user-reseller-admin', name: 'Leila Haddad', email: 'leila@nordtrack.demo' },
      { id: 'user-reseller-support', name: 'Noah Fischer', email: 'noah@nordtrack.demo' },
      { id: 'user-platform-support', name: 'Ari Morgan', email: 'ari@sentinel.demo' },
      { id: 'user-platform-viewer', name: 'Sam Rivera', email: 'sam@sentinel.demo' }
    ], { transaction });
    await Membership.bulkCreate([
      { id: 'member-1', userId: 'user-customer-admin', organizationId: 'org-customer', role: 'ORG_ADMIN' },
      { id: 'member-reseller-admin', userId: 'user-reseller-admin', organizationId: 'org-reseller', role: 'RESELLER_ADMIN' },
      { id: 'member-2', userId: 'user-reseller-support', organizationId: 'org-reseller', role: 'SUPPORT_AGENT' },
      { id: 'member-3', userId: 'user-platform-support', organizationId: 'org-platform', role: 'PLATFORM_SUPPORT' },
      { id: 'member-4', userId: 'user-platform-viewer', organizationId: 'org-platform', role: 'PLATFORM_VIEWER' }
    ], { transaction });
    await ResellerCapability.bulkCreate([
      { id: 'reseller-capability-1', resellerOrganizationId: 'org-reseller', capability: 'CUSTOMER_PROVISION', grantedAt: minutesAgo(90_000), grantedBy: 'user-platform-support' },
      { id: 'reseller-capability-2', resellerOrganizationId: 'org-reseller', capability: 'CUSTOMER_SETTINGS', grantedAt: minutesAgo(90_000), grantedBy: 'user-platform-support' },
      { id: 'reseller-capability-3', resellerOrganizationId: 'org-reseller', capability: 'SUPPORT_OPERATIONS', grantedAt: minutesAgo(90_000), grantedBy: 'user-platform-support' },
      { id: 'reseller-capability-4', resellerOrganizationId: 'org-reseller', capability: 'FLEET_MANAGE', grantedAt: minutesAgo(90_000), grantedBy: 'user-platform-support' },
      { id: 'reseller-capability-5', resellerOrganizationId: 'org-reseller', capability: 'DEVICE_MANAGE', grantedAt: minutesAgo(90_000), grantedBy: 'user-platform-support' }
    ], { transaction });
    await ResellerDeviceProtocolAvailability.bulkCreate([
      { id: 'device-availability-org-reseller-protocol-coban-gps103', resellerOrganizationId: 'org-reseller', protocolProfileId: 'protocol-coban-gps103', available: true, updatedAt: new Date(), updatedBy: null },
      { id: 'device-availability-org-reseller-protocol-teltonika-codec8', resellerOrganizationId: 'org-reseller', protocolProfileId: 'protocol-teltonika-codec8', available: false, updatedAt: new Date(), updatedBy: null },
      { id: 'device-availability-org-reseller-protocol-gt06', resellerOrganizationId: 'org-reseller', protocolProfileId: 'protocol-gt06', available: false, updatedAt: new Date(), updatedBy: null },
      { id: 'device-availability-org-reseller-protocol-queclink-gv300', resellerOrganizationId: 'org-reseller', protocolProfileId: 'protocol-queclink-gv300', available: false, updatedAt: new Date(), updatedBy: null }
    ], { transaction });
    await ServiceRelationship.bulkCreate([
      { id: 'relationship-1', resellerOrganizationId: 'org-reseller', customerOrganizationId: 'org-customer', status: 'ACTIVE', startedAt: minutesAgo(90_000) },
      { id: 'relationship-2', resellerOrganizationId: 'org-reseller', customerOrganizationId: 'org-private', status: 'ACTIVE', startedAt: minutesAgo(40_000) }
    ], { transaction });
    await ServiceRelationshipCapability.bulkCreate([
      { id: 'relationship-capability-1', serviceRelationshipId: 'relationship-1', capability: 'FLEET_MANAGE', grantedAt: minutesAgo(80_000), grantedBy: 'user-customer-admin', revokedAt: null, revokedBy: null },
      { id: 'relationship-capability-2', serviceRelationshipId: 'relationship-1', capability: 'DEVICE_MANAGE', grantedAt: minutesAgo(80_000), grantedBy: 'user-customer-admin', revokedAt: null, revokedBy: null }
    ], { transaction });
    await Vehicle.bulkCreate([
      { id: 'vehicle-1', ownerOrganizationId: 'org-customer', name: 'Delivery Van 12', plate: 'B-FL 1204', kind: 'VAN', markerStyle: 'SILHOUETTE', markerColor: 'BLUE', markerSize: 'MEDIUM' },
      { id: 'vehicle-2', ownerOrganizationId: 'org-customer', name: 'Service Car 07', plate: 'B-FL 0702', kind: 'CAR', markerStyle: 'DOT', markerColor: 'VIOLET', markerSize: 'MEDIUM' },
      { id: 'vehicle-3', ownerOrganizationId: 'org-customer', name: 'Cargo Van 19', plate: 'B-FL 1901', kind: 'VAN', markerStyle: 'PIN', markerColor: 'GREEN', markerSize: 'LARGE' },
      { id: 'vehicle-4', ownerOrganizationId: 'org-customer', name: 'Pool Car 03', plate: 'B-FL 0308', kind: 'CAR', markerStyle: 'HIGH_VISIBILITY', markerColor: 'AMBER', markerSize: 'MEDIUM' },
      { id: 'vehicle-private', ownerOrganizationId: 'org-private', name: 'Family Car', plate: 'B-MM 4431', kind: 'CAR', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' }
    ], { transaction });
    await Device.bulkCreate([
      { id: 'device-1', serial: '358123049582103', model: 'Coban GPS-303FG', radio: 'GSM/GPRS', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 91, signalQuality: 'GOOD', lastCommunicationAt: minutesAgo(1) },
      { id: 'device-2', serial: '358123049582104', model: 'Coban GPS-303FG', radio: 'GSM/GPRS', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 78, signalQuality: 'GOOD', lastCommunicationAt: minutesAgo(3) },
      { id: 'device-3', serial: '358123049582105', model: 'Coban GPS-303FG', radio: 'GSM/GPRS', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 39, signalQuality: 'FAIR', lastCommunicationAt: minutesAgo(18) },
      { id: 'device-4', serial: '358123049582106', model: 'Coban GPS-303FG', radio: 'GSM/GPRS', custodyOrganizationId: 'org-customer', status: 'QUARANTINED', batteryPercent: 16, signalQuality: 'UNKNOWN', lastCommunicationAt: minutesAgo(190) },
      { id: 'device-6', serial: 'NT-DE-210086', model: 'LTE-C1 Pilot', radio: 'LTE Cat 1 bis', custodyOrganizationId: 'org-customer', status: 'ACTIVE', batteryPercent: 100, signalQuality: 'GOOD', lastCommunicationAt: minutesAgo(4) },
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
    await DeviceMessageLog.bulkCreate([
      { id: 'seed-message-1', vehicleId: 'vehicle-1', imei: '358123049582103', actorId: null, direction: 'INBOUND', kind: 'LOCATION', raw: 'imei:358123049582103,tracker,seeded location;', recordedAt: positions[0]!.occurredAt },
      { id: 'seed-message-2', vehicleId: 'vehicle-2', imei: '358123049582104', actorId: null, direction: 'INBOUND', kind: 'LOCATION', raw: 'imei:358123049582104,tracker,seeded location;', recordedAt: positions[1]!.occurredAt },
      { id: 'seed-message-3', vehicleId: 'vehicle-3', imei: '358123049582105', actorId: null, direction: 'INBOUND', kind: 'LOCATION', raw: 'imei:358123049582105,tracker,seeded location;', recordedAt: positions[2]!.occurredAt },
      { id: 'seed-message-4', vehicleId: 'vehicle-4', imei: '358123049582106', actorId: null, direction: 'INBOUND', kind: 'LOCATION', raw: 'imei:358123049582106,tracker,seeded location;', recordedAt: positions[3]!.occurredAt },
      { id: 'seed-message-5', vehicleId: 'vehicle-private', imei: 'NT-DE-210099', actorId: null, direction: 'INBOUND', kind: 'LOCATION', raw: 'seeded LTE location report', recordedAt: positions[4]!.occurredAt },
      { id: 'seed-message-6', vehicleId: null, imei: 'NT-DE-210086', actorId: null, direction: 'INBOUND', kind: 'HEARTBEAT', raw: 'seeded LTE heartbeat', recordedAt: minutesAgo(4) }
    ], { transaction });
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
