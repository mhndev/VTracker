import {
  Device,
  DeviceCommandDefinition,
  DeviceMessageDefinition,
  DeviceProtocolBinding,
  DeviceProtocolProfile,
  Organization,
  ResellerDeviceProtocolAvailability
} from '../models/index.js';
import { HttpError } from '../utils/errors.js';
import { hasPlatformRole } from './policy.service.js';
import { recordAudit } from './audit.service.js';

export const COBAN_PROTOCOL_PROFILE_ID = 'protocol-coban-gps103';

export interface ProtocolDetection {
  protocolProfileId: string;
  confidence: number;
  evidence: Record<string, unknown>;
}

export function detectProtocolFromFrame(rawFrame: string): ProtocolDetection | null {
  const frame = rawFrame.trim();
  if (/^##,imei:\d+,A;/i.test(frame)) {
    return {
      protocolProfileId: COBAN_PROTOCOL_PROFILE_ID,
      confidence: 1,
      evidence: { rule: 'COBAN_ASCII_LOGIN', signature: '##,imei:<imei>,A;' }
    };
  }
  if (/^imei:\d+,(?:tracker|status|vvt),/i.test(frame)) {
    return {
      protocolProfileId: COBAN_PROTOCOL_PROFILE_ID,
      confidence: 0.98,
      evidence: { rule: 'COBAN_ASCII_KEYWORD', keyword: frame.split(',')[1]?.trim().toLowerCase() }
    };
  }
  return null;
}

export function buildIdentificationQuery(protocolProfileId: string, imei: string): string | null {
  if (protocolProfileId === COBAN_PROTOCOL_PROFILE_ID) return `**,imei:${imei},vv;\r\n`;
  return null;
}

export async function recordProtocolDetection(imei: string, detection: ProtocolDetection): Promise<void> {
  const now = new Date();
  const device = await Device.findOne({ where: { serial: imei } });
  const existing = await DeviceProtocolBinding.findByPk(imei);
  const identifiedAt = existing?.identifiedAt ?? now;
  await DeviceProtocolBinding.upsert({
    imei,
    deviceId: device?.id ?? existing?.deviceId ?? null,
    protocolProfileId: detection.protocolProfileId,
    detectedModel: existing?.detectedModel ?? null,
    firmwareVersion: existing?.firmwareVersion ?? null,
    protocolVersion: existing?.protocolVersion ?? null,
    variantVersion: existing?.variantVersion ?? null,
    confidence: detection.confidence,
    evidence: { ...(existing?.evidence ?? {}), ...detection.evidence },
    identifiedAt,
    lastSeenAt: now,
    lastQueriedAt: existing?.lastQueriedAt ?? null
  });
}

export async function markIdentificationQuery(imei: string): Promise<void> {
  await DeviceProtocolBinding.update({ lastQueriedAt: new Date() }, { where: { imei } });
}

export async function recordDeviceInformation(input: {
  imei: string;
  detectedModel?: string;
  firmwareVersion?: string;
  protocolVersion?: string;
  variantVersion?: string;
  raw: string;
}): Promise<void> {
  const detection = detectProtocolFromFrame(input.raw) ?? {
    protocolProfileId: COBAN_PROTOCOL_PROFILE_ID,
    confidence: 0.95,
    evidence: { rule: 'COBAN_VVT_RESPONSE' }
  };
  await recordProtocolDetection(input.imei, detection);
  await DeviceProtocolBinding.update({
    detectedModel: input.detectedModel || null,
    firmwareVersion: input.firmwareVersion || null,
    protocolVersion: input.protocolVersion || null,
    variantVersion: input.variantVersion || null,
    evidence: { ...detection.evidence, deviceInfoFrame: true },
    lastSeenAt: new Date()
  }, { where: { imei: input.imei } });
}

export async function listProtocolCatalog() {
  return DeviceProtocolProfile.findAll({
    include: [
      { model: DeviceMessageDefinition, as: 'messageDefinitions' },
      { model: DeviceCommandDefinition, as: 'commandDefinitions' }
    ],
    order: [
      ['implementationStatus', 'ASC'],
      ['vendor', 'ASC'],
      [{ model: DeviceMessageDefinition, as: 'messageDefinitions' }, 'messageType', 'ASC'],
      [{ model: DeviceCommandDefinition, as: 'commandDefinitions' }, 'commandKey', 'ASC']
    ]
  });
}

export async function getAdminDeviceCatalog(actorId: string) {
  if (!await hasPlatformRole(actorId)) throw new HttpError(403, 'PLATFORM_ADMIN_REQUIRED', 'This endpoint is restricted to the platform administration plane.');
  const [profiles, resellers, availability] = await Promise.all([
    listProtocolCatalog(),
    Organization.findAll({ where: { type: 'RESELLER' }, order: [['name', 'ASC']] }),
    ResellerDeviceProtocolAvailability.findAll()
  ]);
  return {
    profiles,
    resellers: resellers.map(reseller => ({ id: reseller.id, name: reseller.name, status: reseller.status })),
    availability: availability.map(item => item.get())
  };
}

export async function setResellerDeviceAvailability(actorId: string, resellerOrganizationId: string, protocolProfileId: string, available: boolean) {
  if (!await hasPlatformRole(actorId)) throw new HttpError(403, 'PLATFORM_ADMIN_REQUIRED', 'This endpoint is restricted to the platform administration plane.');
  const [reseller, profile] = await Promise.all([
    Organization.findOne({ where: { id: resellerOrganizationId, type: 'RESELLER' } }),
    DeviceProtocolProfile.findByPk(protocolProfileId)
  ]);
  if (!reseller) throw new HttpError(404, 'RESELLER_NOT_FOUND', 'The reseller organization does not exist.');
  if (!profile) throw new HttpError(404, 'DEVICE_PROTOCOL_NOT_FOUND', 'The device protocol profile does not exist.');
  const id = `device-availability-${resellerOrganizationId}-${protocolProfileId}`;
  await ResellerDeviceProtocolAvailability.upsert({
    id, resellerOrganizationId, protocolProfileId, available, updatedAt: new Date(), updatedBy: actorId
  });
  await recordAudit({
    actorId,
    action: 'RESELLER_DEVICE_AVAILABILITY_UPDATED',
    resourceType: 'DEVICE_PROTOCOL',
    resourceId: protocolProfileId,
    outcome: 'SUCCESS',
    details: { resellerOrganizationId, available }
  });
  return ResellerDeviceProtocolAvailability.findByPk(id);
}
