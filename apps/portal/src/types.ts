export type PortalView = 'overview' | 'map' | 'vehicles' | 'devices' | 'alerts' | 'privacy';
export interface Scope { id: string; name: string; type: string; access: 'member' | 'service' }
export interface Session { actor: { id: string; name: string; email: string }; scopes: Scope[] }
export interface Vehicle {
  id: string; name: string; plate: string; kind: string; locationAccess: boolean;
  device?: { id: string; serial: string; model: string; status: string; lastCommunicationAt: string; batteryPercent: number; signalQuality: string; radio: string };
  location?: { latitude: number; longitude: number; speedKph: number; heading: number; occurredAt: string; quality: string };
}
export interface AlertItem { id: string; vehicleId: string; vehicleName: string; type: string; severity: string; status: string; occurredAt: string; summary: string }
export interface Dashboard {
  organization: { id: string; name: string; type: string };
  accessMode: 'member' | 'service';
  stats: { vehicles: number; online: number; activeAlerts: number; locationVisible: number };
  vehicles: Vehicle[]; alerts: AlertItem[];
  capabilities: { remoteImmobilization: false; reason: string };
}
export interface Grant { id: string; vehicleId: string; vehicleName: string; granteeOrganizationName: string; purpose: string; permission: string; expiresAt: string; revokedAt: string | null }
