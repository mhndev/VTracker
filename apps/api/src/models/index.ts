import { AccessGrant } from './AccessGrant.js';
import { Alert } from './Alert.js';
import { AuditEvent } from './AuditEvent.js';
import { Device } from './Device.js';
import { DeviceAssignment } from './DeviceAssignment.js';
import { LatestPosition } from './LatestPosition.js';
import { Membership } from './Membership.js';
import { Organization } from './Organization.js';
import { ServiceRelationship } from './ServiceRelationship.js';
import { TelemetryEvent } from './TelemetryEvent.js';
import { User } from './User.js';
import { Vehicle } from './Vehicle.js';

export function initializeAssociations(): void {
  Organization.hasMany(Membership, { foreignKey: 'organizationId', as: 'memberships' });
  Membership.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
  User.hasMany(Membership, { foreignKey: 'userId', as: 'memberships' });
  Membership.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Organization.hasMany(Vehicle, { foreignKey: 'ownerOrganizationId', as: 'vehicles' });
  Vehicle.belongsTo(Organization, { foreignKey: 'ownerOrganizationId', as: 'ownerOrganization' });
  Organization.hasMany(Device, { foreignKey: 'custodyOrganizationId', as: 'devicesInCustody' });
  Device.belongsTo(Organization, { foreignKey: 'custodyOrganizationId', as: 'custodyOrganization' });

  Vehicle.hasMany(DeviceAssignment, { foreignKey: 'vehicleId', as: 'assignments' });
  DeviceAssignment.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Device.hasMany(DeviceAssignment, { foreignKey: 'deviceId', as: 'assignments' });
  DeviceAssignment.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });

  Vehicle.hasMany(TelemetryEvent, { foreignKey: 'vehicleId', as: 'telemetryEvents' });
  TelemetryEvent.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasOne(LatestPosition, { foreignKey: 'vehicleId', as: 'latestPosition' });
  LatestPosition.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(Alert, { foreignKey: 'vehicleId', as: 'alerts' });
  Alert.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(AccessGrant, { foreignKey: 'vehicleId', as: 'accessGrants' });
  AccessGrant.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

  Organization.hasMany(ServiceRelationship, { foreignKey: 'resellerOrganizationId', as: 'customerRelationships' });
  Organization.hasMany(ServiceRelationship, { foreignKey: 'customerOrganizationId', as: 'resellerRelationships' });
  ServiceRelationship.belongsTo(Organization, { foreignKey: 'resellerOrganizationId', as: 'resellerOrganization' });
  ServiceRelationship.belongsTo(Organization, { foreignKey: 'customerOrganizationId', as: 'customerOrganization' });

  Organization.hasMany(AccessGrant, { foreignKey: 'granteeOrganizationId', as: 'receivedAccessGrants' });
  AccessGrant.belongsTo(Organization, { foreignKey: 'granteeOrganizationId', as: 'granteeOrganization' });
  User.hasMany(AuditEvent, { foreignKey: 'actorId', as: 'auditEvents' });
  AuditEvent.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
}

export {
  AccessGrant, Alert, AuditEvent, Device, DeviceAssignment, LatestPosition,
  Membership, Organization, ServiceRelationship, TelemetryEvent, User, Vehicle
};
