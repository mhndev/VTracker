import type { SupportedLocale } from '@sentinel/ui';
import type { AdminData, DeviceCatalogData, ResellerInput, ResellerRecord } from './types';

export class AdminFetchError extends Error {
  constructor(readonly code: 'forbidden' | 'unavailable' | 'duplicate' | 'invalid') { super(code); }
}

const adminHeaders = { 'x-demo-actor': 'user-platform-support' };

async function parseAdminResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as T | { error?: { code?: string } } | null;
  if (!response.ok) {
    const errorCode = payload && typeof payload === 'object' && 'error' in payload ? payload.error?.code : undefined;
    throw new AdminFetchError(response.status === 403 ? 'forbidden' : errorCode === 'RESELLER_NAME_EXISTS' ? 'duplicate' : response.status === 400 ? 'invalid' : 'unavailable');
  }
  return payload as T;
}

export async function fetchAdmin(): Promise<AdminData> {
  return parseAdminResponse(await fetch('/api/admin/overview', { headers: adminHeaders }));
}

export async function fetchResellers(): Promise<ResellerRecord[]> {
  return parseAdminResponse(await fetch('/api/admin/resellers', { headers: adminHeaders }));
}

export async function fetchDeviceCatalog(): Promise<DeviceCatalogData> {
  return parseAdminResponse(await fetch('/api/admin/device-catalog', { headers: adminHeaders }));
}

export async function saveDeviceAvailability(resellerId: string, protocolProfileId: string, available: boolean) {
  return parseAdminResponse<{ id: string; resellerOrganizationId: string; protocolProfileId: string; available: boolean }>(await fetch(`/api/admin/device-catalog/resellers/${resellerId}/protocols/${protocolProfileId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', ...adminHeaders }, body: JSON.stringify({ available })
  }));
}

export async function fetchSession(): Promise<{ effectiveLocale: SupportedLocale }> {
  return parseAdminResponse(await fetch('/api/session', { headers: adminHeaders }));
}

export async function updateOrganizationLocale(organizationId: string, defaultLocale: SupportedLocale): Promise<{ defaultLocale: SupportedLocale }> {
  return parseAdminResponse(await fetch(`/api/organizations/${organizationId}/settings`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', ...adminHeaders }, body: JSON.stringify({ defaultLocale })
  }));
}

export async function saveReseller(input: ResellerInput, resellerId?: string): Promise<ResellerRecord> {
  return parseAdminResponse(await fetch(resellerId ? `/api/admin/resellers/${resellerId}` : '/api/admin/resellers', {
    method: resellerId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json', ...adminHeaders }, body: JSON.stringify(input)
  }));
}
