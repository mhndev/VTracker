import type { SupportedLocale } from '@sentinel/ui';

export type AdminView = 'overview' | 'resellers' | 'organizations' | 'devices' | 'catalog' | 'incidents' | 'audit' | 'onboarding';
export type ResellerStatus = 'ACTIVE' | 'SUSPENDED';
export type DelegatedCapability = 'CUSTOMER_PROVISION' | 'CUSTOMER_SETTINGS' | 'FLEET_MANAGE' | 'DEVICE_MANAGE' | 'SUPPORT_OPERATIONS';
export type ResellerRecord = { id: string; name: string; defaultLocale: SupportedLocale; status: ResellerStatus; capabilities: DelegatedCapability[]; customerCount: number };
export type ResellerInput = Omit<ResellerRecord, 'id' | 'customerCount'>;
export type ProtocolDefinition = {
  id: string; displayName: string; description: string; messageType?: string; direction?: string;
  commandKey?: string; wireTemplate?: string | null; riskLevel?: string; implementationStatus?: string;
  example?: string | null; fieldSchema?: Array<Record<string, unknown>>;
};
export type ProtocolProfile = {
  id: string; vendor: string; family: string; displayName: string; transport: string; frameFormat: string;
  implementationStatus: 'ACTIVE' | 'CATALOG_ONLY' | 'DISABLED'; documentationUrl: string; notes: string | null;
  messageDefinitions: ProtocolDefinition[]; commandDefinitions: ProtocolDefinition[];
};
export type DeviceCatalogData = {
  profiles: ProtocolProfile[];
  resellers: Array<{ id: string; name: string; status: string }>;
  availability: Array<{ id: string; resellerOrganizationId: string; protocolProfileId: string; available: boolean }>;
};
export type AdminData = {
  actor: { name: string; email: string };
  generatedAt: string;
  privacyBoundary: string;
  stats: { customers: number; resellers: number; devices: number; onlineDevices: number; openAlerts: number; quarantinedDevices: number };
  organizations: Array<{
    id: string; name: string; resellerName: string; vehicles: number; devices: number;
    onlineDevices: number; openAlerts: number; serviceStatus: string; defaultLocale: SupportedLocale;
  }>;
  devices: Array<{
    id: string; serial: string; model: string; radio: string; status: string;
    signalQuality: string; lastCommunicationAt: string; custodyOrganizationName: string;
  }>;
  systemChecks: Array<{ id: string; name: string; status: string; detail: string; detailCount?: number }>;
  recentAudit: Array<{ id: string; action: string; outcome: string; occurredAt: string; actorName: string; resourceType: string }>;
};

export const DELEGATED_CAPABILITIES: readonly DelegatedCapability[] = [
  'CUSTOMER_PROVISION', 'CUSTOMER_SETTINGS', 'FLEET_MANAGE', 'DEVICE_MANAGE', 'SUPPORT_OPERATIONS'
];
