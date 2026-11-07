import { Op } from 'sequelize';
import { DELEGATED_CAPABILITIES, ORGANIZATION_LIFECYCLE, type DelegatedCapability, type OrganizationLifecycle } from '../contracts/provisioning.contracts.js';
import { sequelize } from '../database/connection.js';
import { Organization, ResellerCapability, ServiceRelationship } from '../models/index.js';
import type { SupportedLocale } from '../models/Organization.js';
import { HttpError } from '../utils/errors.js';
import { recordAudit } from './audit.service.js';
import { canCreateResellers } from './policy.service.js';

const SUPPORTED_LOCALES = new Set<SupportedLocale>(['en', 'fa']);
const LIFECYCLE_VALUES = new Set<OrganizationLifecycle>(ORGANIZATION_LIFECYCLE);
const CAPABILITY_VALUES = new Set<DelegatedCapability>(DELEGATED_CAPABILITIES);

interface ResellerInput {
  name?: unknown;
  defaultLocale?: unknown;
  status?: unknown;
  capabilities?: unknown;
}

const requirePlatformProvisioning = async (actorId: string) => {
  if (!await canCreateResellers(actorId)) {
    throw new HttpError(403, 'RESELLER_PROVISIONING_DENIED', 'Reseller provisioning requires platform support authority.');
  }
};

const parseName = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 120) {
    throw new HttpError(400, 'INVALID_RESELLER', 'name must contain between 2 and 120 characters.');
  }
  return value.trim();
};

const parseLocale = (value: unknown): SupportedLocale => {
  if (typeof value !== 'string' || !SUPPORTED_LOCALES.has(value as SupportedLocale)) {
    throw new HttpError(400, 'INVALID_RESELLER', 'defaultLocale must be en or fa.');
  }
  return value as SupportedLocale;
};

const parseStatus = (value: unknown): OrganizationLifecycle => {
  if (typeof value !== 'string' || !LIFECYCLE_VALUES.has(value as OrganizationLifecycle)) {
    throw new HttpError(400, 'INVALID_RESELLER', 'status must be ACTIVE or SUSPENDED.');
  }
  return value as OrganizationLifecycle;
};

const parseCapabilities = (value: unknown): DelegatedCapability[] => {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !CAPABILITY_VALUES.has(item as DelegatedCapability))) {
    throw new HttpError(400, 'INVALID_RESELLER', 'capabilities must contain only supported capability codes.');
  }
  const capabilities = [...new Set(value as DelegatedCapability[])];
  if (capabilities.length !== value.length) {
    throw new HttpError(400, 'INVALID_RESELLER', 'capabilities must not contain duplicate values.');
  }
  return capabilities;
};

const serializeReseller = (organization: Organization, capabilities: DelegatedCapability[], customerCount: number) => ({
  id: organization.id,
  name: organization.name,
  defaultLocale: organization.defaultLocale,
  status: organization.status,
  capabilities,
  customerCount
});

export async function listResellers(actorId: string) {
  await requirePlatformProvisioning(actorId);
  const resellers = await Organization.findAll({ where: { type: 'RESELLER' }, order: [['name', 'ASC']] });
  if (!resellers.length) return [];
  const resellerIds = resellers.map(item => item.id);
  const [capabilities, relationships] = await Promise.all([
    ResellerCapability.findAll({ where: { resellerOrganizationId: { [Op.in]: resellerIds } } }),
    ServiceRelationship.findAll({ where: { resellerOrganizationId: { [Op.in]: resellerIds }, status: 'ACTIVE' } })
  ]);
  const capabilitiesByReseller = new Map<string, DelegatedCapability[]>();
  for (const capability of capabilities) {
    capabilitiesByReseller.set(capability.resellerOrganizationId, [...(capabilitiesByReseller.get(capability.resellerOrganizationId) ?? []), capability.capability]);
  }
  return resellers.map(reseller => serializeReseller(
    reseller,
    capabilitiesByReseller.get(reseller.id) ?? [],
    relationships.filter(relationship => relationship.resellerOrganizationId === reseller.id).length
  ));
}

export async function createReseller(actorId: string, input: ResellerInput) {
  await requirePlatformProvisioning(actorId);
  const name = parseName(input.name);
  const defaultLocale = parseLocale(input.defaultLocale);
  const status = parseStatus(input.status);
  const capabilities = parseCapabilities(input.capabilities);
  const duplicate = await Organization.findOne({ where: { type: 'RESELLER', name } });
  if (duplicate) throw new HttpError(409, 'RESELLER_NAME_EXISTS', 'A reseller with this name already exists.');
  return sequelize.transaction(async transaction => {
    const reseller = await Organization.create({
      id: `org-reseller-${crypto.randomUUID()}`,
      name,
      type: 'RESELLER',
      defaultLocale,
      status
    }, { transaction });
    await ResellerCapability.bulkCreate(capabilities.map(capability => ({
      id: `reseller-capability-${crypto.randomUUID()}`,
      resellerOrganizationId: reseller.id,
      capability,
      grantedAt: new Date(),
      grantedBy: actorId
    })), { transaction });
    await recordAudit({
      actorId,
      action: 'RESELLER_CREATED',
      resourceType: 'ORGANIZATION',
      resourceId: reseller.id,
      outcome: 'SUCCESS',
      details: { name, defaultLocale, status, capabilities }
    }, transaction);
    return serializeReseller(reseller, capabilities, 0);
  });
}

export async function updateReseller(actorId: string, resellerId: string, input: ResellerInput) {
  await requirePlatformProvisioning(actorId);
  if (!resellerId) throw new HttpError(404, 'RESELLER_NOT_FOUND', 'The reseller does not exist.');
  const hasChanges = ['name', 'defaultLocale', 'status', 'capabilities'].some(key => Object.prototype.hasOwnProperty.call(input, key));
  if (!hasChanges) throw new HttpError(400, 'INVALID_RESELLER', 'At least one reseller field must be supplied.');
  const reseller = await Organization.findOne({ where: { id: resellerId, type: 'RESELLER' } });
  if (!reseller) throw new HttpError(404, 'RESELLER_NOT_FOUND', 'The reseller does not exist.');
  const name = Object.prototype.hasOwnProperty.call(input, 'name') ? parseName(input.name) : reseller.name;
  const defaultLocale = Object.prototype.hasOwnProperty.call(input, 'defaultLocale') ? parseLocale(input.defaultLocale) : reseller.defaultLocale;
  const status = Object.prototype.hasOwnProperty.call(input, 'status') ? parseStatus(input.status) : reseller.status;
  const currentCapabilities = await ResellerCapability.findAll({ where: { resellerOrganizationId: reseller.id } });
  const capabilities = Object.prototype.hasOwnProperty.call(input, 'capabilities')
    ? parseCapabilities(input.capabilities)
    : currentCapabilities.map(item => item.capability);
  if (name !== reseller.name && await Organization.findOne({ where: { type: 'RESELLER', name, id: { [Op.ne]: reseller.id } } })) {
    throw new HttpError(409, 'RESELLER_NAME_EXISTS', 'A reseller with this name already exists.');
  }
  const previous = { name: reseller.name, defaultLocale: reseller.defaultLocale, status: reseller.status, capabilities: currentCapabilities.map(item => item.capability) };
  return sequelize.transaction(async transaction => {
    reseller.name = name;
    reseller.defaultLocale = defaultLocale;
    reseller.status = status;
    await reseller.save({ transaction });
    if (Object.prototype.hasOwnProperty.call(input, 'capabilities')) {
      await ResellerCapability.destroy({ where: { resellerOrganizationId: reseller.id }, transaction });
      await ResellerCapability.bulkCreate(capabilities.map(capability => ({
        id: `reseller-capability-${crypto.randomUUID()}`,
        resellerOrganizationId: reseller.id,
        capability,
        grantedAt: new Date(),
        grantedBy: actorId
      })), { transaction });
    }
    const current = { name, defaultLocale, status, capabilities };
    if (previous.name !== name || previous.defaultLocale !== defaultLocale) {
      await recordAudit({
        actorId,
        action: 'RESELLER_UPDATED',
        resourceType: 'ORGANIZATION',
        resourceId: reseller.id,
        outcome: 'SUCCESS',
        details: { previous, current }
      }, transaction);
    }
    if (previous.status !== status) {
      await recordAudit({
        actorId,
        action: 'RESELLER_LIFECYCLE_CHANGED',
        resourceType: 'ORGANIZATION',
        resourceId: reseller.id,
        outcome: 'SUCCESS',
        details: { previousStatus: previous.status, status }
      }, transaction);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'capabilities') && (previous.capabilities.length !== capabilities.length || previous.capabilities.some(capability => !capabilities.includes(capability)))) {
      await recordAudit({
        actorId,
        action: 'DELEGATED_CAPABILITIES_CHANGED',
        resourceType: 'ORGANIZATION',
        resourceId: reseller.id,
        outcome: 'SUCCESS',
        details: { previousCapabilities: previous.capabilities, capabilities }
      }, transaction);
    }
    const customerCount = await ServiceRelationship.count({ where: { resellerOrganizationId: reseller.id, status: 'ACTIVE' }, transaction });
    return serializeReseller(reseller, capabilities, customerCount);
  });
}
