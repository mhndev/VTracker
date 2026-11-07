export type PortalView = 'overview' | 'map' | 'vehicles' | 'devices' | 'alerts' | 'privacy' | 'customers';
export type VehicleKind = 'CAR' | 'VAN' | 'TRUCK' | 'MOTORCYCLE' | 'SCOOTER' | 'BICYCLE' | 'BUS' | 'UTILITY';
export type MarkerStyle = 'DOT' | 'SILHOUETTE' | 'DIRECTIONAL' | 'BADGE' | 'PIN' | 'OUTLINE' | 'STATUS' | 'HIGH_VISIBILITY';
export type MarkerColor = 'BLUE' | 'VIOLET' | 'GREEN' | 'AMBER';
export type MarkerSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export interface Scope { id: string; name: string; type: string; defaultLocale: 'en' | 'fa'; effectiveLocale: 'en' | 'fa'; access: 'member' | 'service' | 'platform' }
export interface Session {
  actor: { id: string; name: string; email: string };
  effectiveLocale: 'en' | 'fa';
  scopes: Scope[];
  memberships: Array<{ organizationId: string; role: string }>;
  provisioningCapabilities: {
    createResellers: boolean;
    createCustomersForResellerIds: string[];
    manageVehiclesForCustomerIds: string[];
    manageDeviceAssignmentsForCustomerIds: string[];
    platformCustomerLocationAccess: 'NONE';
  };
}
export interface Vehicle {
  id: string; name: string; plate: string; kind: VehicleKind; markerStyle: MarkerStyle; markerColor: MarkerColor; markerSize: MarkerSize; locationAccess: boolean;
  createdAt?: string; updatedAt?: string; archivedAt?: string | null;
  device?: { id: string; serial: string; model: string; status: string; lastCommunicationAt: string; batteryPercent: number; signalQuality: string; radio: string };
  location?: { latitude: number; longitude: number; speedKph: number; heading: number; occurredAt: string; quality: string };
}
export interface NewVehicleInput { organizationId: string; name: string; plate: string; kind: VehicleKind; markerStyle: MarkerStyle; markerColor: MarkerColor; markerSize: MarkerSize }
export type VehicleUpdateInput = Omit<NewVehicleInput, 'organizationId'>;
export interface AlertItem { id: string; vehicleId: string; vehicleName: string; type: string; severity: string; status: string; occurredAt: string; summary: string }
export interface Dashboard {
  organization: { id: string; name: string; type: string };
  accessMode: 'member' | 'service';
  stats: { vehicles: number; online: number; activeAlerts: number; locationVisible: number };
  vehicles: Vehicle[]; alerts: AlertItem[];
  capabilities: { remoteImmobilization: false; reason: string };
}
export interface Grant { id: string; vehicleId: string; vehicleName: string; granteeOrganizationName: string; purpose: string; permission: string; expiresAt: string; revokedAt: string | null }
export type CustomerLifecycle = 'ACTIVE' | 'SUSPENDED';
export interface ManagedCustomer {
  id: string;
  name: string;
  defaultLocale: 'en' | 'fa';
  timezone: string;
  status: CustomerLifecycle;
  serviceRelationship: { id: string; status: string; startedAt: string };
}
export interface ManagedCustomerInput { name: string; defaultLocale: 'en' | 'fa'; timezone: string; status: CustomerLifecycle }
export interface DeviceInventoryItem {
  id: string; serial: string; model: string; radio: string; custodyOrganizationId: string; status: string;
  batteryPercent: number; signalQuality: string; lastCommunicationAt: string;
  currentAssignment: { id: string; assignedAt: string; vehicle?: { id: string; name: string; plate: string; archivedAt: string | null } } | null;
}
export interface DeviceAssignmentHistory {
  id: string; deviceId: string; vehicleId: string; assignedAt: string; unassignedAt: string | null;
  device?: Pick<DeviceInventoryItem, 'id' | 'serial' | 'model' | 'radio' | 'custodyOrganizationId' | 'status'>;
  vehicle?: { id: string; ownerOrganizationId: string; name: string; plate: string; archivedAt: string | null };
}
