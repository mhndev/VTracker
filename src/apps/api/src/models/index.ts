import { AccessGrant } from './AccessGrant.js';
import { Alert } from './Alert.js';
import { AuditEvent } from './AuditEvent.js';
import { Device } from './Device.js';
import { DeviceAssignment } from './DeviceAssignment.js';
import { DeviceMessageLog } from './DeviceMessageLog.js';
import { DeviceCommandDefinition } from './DeviceCommandDefinition.js';
import { DeviceMessageDefinition } from './DeviceMessageDefinition.js';
import { DeviceProtocolBinding } from './DeviceProtocolBinding.js';
import { DeviceProtocolProfile } from './DeviceProtocolProfile.js';
import { LatestPosition } from './LatestPosition.js';
import { Membership } from './Membership.js';
import { Organization } from './Organization.js';
import { OrganizationRetentionPolicy } from './OrganizationRetentionPolicy.js';
import { RetentionPolicy } from './RetentionPolicy.js';
import { ResellerCapability } from './ResellerCapability.js';
import { ResellerDeviceProtocolAvailability } from './ResellerDeviceProtocolAvailability.js';
import { ServiceRelationship } from './ServiceRelationship.js';
import { ServiceRelationshipCapability } from './ServiceRelationshipCapability.js';
import { TelemetryEvent } from './TelemetryEvent.js';
import { Trip } from './Trip.js';
import { TripPoint } from './TripPoint.js';
import { User } from './User.js';
import { Vehicle } from './Vehicle.js';
import { VehicleState } from './VehicleState.js';

export function initializeAssociations(): void {
  Organization.hasMany(Membership, { foreignKey: 'organizationId', as: 'memberships' });
  Membership.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
  User.hasMany(Membership, { foreignKey: 'userId', as: 'memberships' });
  Membership.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Organization.hasMany(Vehicle, { foreignKey: 'ownerOrganizationId', as: 'vehicles' });
  Vehicle.belongsTo(Organization, { foreignKey: 'ownerOrganizationId', as: 'ownerOrganization' });
  Organization.hasMany(Device, { foreignKey: 'custodyOrganizationId', as: 'devicesInCustody' });
  Device.belongsTo(Organization, { foreignKey: 'custodyOrganizationId', as: 'custodyOrganization' });
  Organization.hasOne(OrganizationRetentionPolicy, { foreignKey: 'organizationId', as: 'retentionAssignment' });
  OrganizationRetentionPolicy.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
  RetentionPolicy.hasMany(OrganizationRetentionPolicy, { foreignKey: 'retentionPolicyId', as: 'organizationAssignments' });
  OrganizationRetentionPolicy.belongsTo(RetentionPolicy, { foreignKey: 'retentionPolicyId', as: 'retentionPolicy' });

  Vehicle.hasMany(DeviceAssignment, { foreignKey: 'vehicleId', as: 'assignments' });
  DeviceAssignment.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Device.hasMany(DeviceAssignment, { foreignKey: 'deviceId', as: 'assignments' });
  DeviceAssignment.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });
  Vehicle.hasMany(DeviceMessageLog, { foreignKey: 'vehicleId', as: 'deviceMessages' });
  DeviceMessageLog.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Device.hasOne(DeviceProtocolBinding, { foreignKey: 'deviceId', as: 'protocolBinding' });
  DeviceProtocolBinding.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });
  DeviceProtocolProfile.hasMany(DeviceProtocolBinding, { foreignKey: 'protocolProfileId', as: 'deviceBindings' });
  DeviceProtocolBinding.belongsTo(DeviceProtocolProfile, { foreignKey: 'protocolProfileId', as: 'protocolProfile' });
  DeviceProtocolProfile.hasMany(DeviceMessageDefinition, { foreignKey: 'protocolProfileId', as: 'messageDefinitions' });
  DeviceMessageDefinition.belongsTo(DeviceProtocolProfile, { foreignKey: 'protocolProfileId', as: 'protocolProfile' });
  DeviceProtocolProfile.hasMany(DeviceCommandDefinition, { foreignKey: 'protocolProfileId', as: 'commandDefinitions' });
  DeviceCommandDefinition.belongsTo(DeviceProtocolProfile, { foreignKey: 'protocolProfileId', as: 'protocolProfile' });
  DeviceProtocolProfile.hasMany(ResellerDeviceProtocolAvailability, { foreignKey: 'protocolProfileId', as: 'resellerAvailability' });
  ResellerDeviceProtocolAvailability.belongsTo(DeviceProtocolProfile, { foreignKey: 'protocolProfileId', as: 'protocolProfile' });

  Vehicle.hasMany(TelemetryEvent, { foreignKey: 'vehicleId', as: 'telemetryEvents' });
  TelemetryEvent.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasOne(LatestPosition, { foreignKey: 'vehicleId', as: 'latestPosition' });
  LatestPosition.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasOne(VehicleState, { foreignKey: 'vehicleId', as: 'currentState' });
  VehicleState.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(Trip, { foreignKey: 'vehicleId', as: 'trips' });
  Trip.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Trip.hasMany(TripPoint, { foreignKey: 'tripId', as: 'points' });
  TripPoint.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });
  Vehicle.hasMany(Alert, { foreignKey: 'vehicleId', as: 'alerts' });
  Alert.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(AccessGrant, { foreignKey: 'vehicleId', as: 'accessGrants' });
  AccessGrant.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

  Organization.hasMany(ServiceRelationship, { foreignKey: 'resellerOrganizationId', as: 'customerRelationships' });
  Organization.hasMany(ServiceRelationship, { foreignKey: 'customerOrganizationId', as: 'resellerRelationships' });
  ServiceRelationship.belongsTo(Organization, { foreignKey: 'resellerOrganizationId', as: 'resellerOrganization' });
  ServiceRelationship.belongsTo(Organization, { foreignKey: 'customerOrganizationId', as: 'customerOrganization' });
  ServiceRelationship.hasMany(ServiceRelationshipCapability, { foreignKey: 'serviceRelationshipId', as: 'capabilities' });
  ServiceRelationshipCapability.belongsTo(ServiceRelationship, { foreignKey: 'serviceRelationshipId', as: 'serviceRelationship' });

  Organization.hasMany(ResellerCapability, { foreignKey: 'resellerOrganizationId', as: 'capabilities' });
  ResellerCapability.belongsTo(Organization, { foreignKey: 'resellerOrganizationId', as: 'resellerOrganization' });
  Organization.hasMany(ResellerDeviceProtocolAvailability, { foreignKey: 'resellerOrganizationId', as: 'deviceProtocolAvailability' });
  ResellerDeviceProtocolAvailability.belongsTo(Organization, { foreignKey: 'resellerOrganizationId', as: 'resellerOrganization' });

  Organization.hasMany(AccessGrant, { foreignKey: 'granteeOrganizationId', as: 'receivedAccessGrants' });
  AccessGrant.belongsTo(Organization, { foreignKey: 'granteeOrganizationId', as: 'granteeOrganization' });
  User.hasMany(AuditEvent, { foreignKey: 'actorId', as: 'auditEvents' });
  AuditEvent.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
}

export {
  AccessGrant, Alert, AuditEvent, Device, DeviceAssignment, DeviceCommandDefinition, DeviceMessageDefinition,
  DeviceMessageLog, DeviceProtocolBinding, DeviceProtocolProfile, LatestPosition,
  Membership, Organization, OrganizationRetentionPolicy, ResellerCapability, ResellerDeviceProtocolAvailability, RetentionPolicy, ServiceRelationship, ServiceRelationshipCapability,
  TelemetryEvent, Trip, TripPoint, User, Vehicle, VehicleState
};
