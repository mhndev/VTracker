import { Op } from 'sequelize';
import { ORGANIZATION_LIFECYCLE, type OrganizationLifecycle } from '../contracts/provisioning.contracts.js';
import { sequelize } from '../database/connection.js';
import { Organization, ServiceRelationship } from '../models/index.js';
import type { SupportedLocale } from '../models/Organization.js';
import { HttpError } from '../utils/errors.js';
import { recordAudit } from './audit.service.js';
import { canCreateCustomers, canManageCustomerSettings, getMembership } from './policy.service.js';

const SUPPORTED_LOCALES = new Set<SupportedLocale>(['en', 'fa']);
const LIFECYCLE_VALUES = new Set<OrganizationLifecycle>(ORGANIZATION_LIFECYCLE);

interface CustomerInput {
  name?: unknown;
  defaultLocale?: unknown;
  timezone?: unknown;
  status?: unknown;
}

const parseName = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 120) {
    throw new HttpError(400, 'INVALID_CUSTOMER', 'name must contain between 2 and 120 characters.');
  }
  return value.trim();
};

const parseLocale = (value: unknown): SupportedLocale => {
  if (typeof value !== 'string' || !SUPPORTED_LOCALES.has(value as SupportedLocale)) {
    throw new HttpError(400, 'INVALID_CUSTOMER', 'defaultLocale must be en or fa.');
  }
  return value as SupportedLocale;
};

const parseTimezone = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new HttpError(400, 'INVALID_CUSTOMER', 'timezone must be a valid IANA time-zone identifier.');
  }
  const timezone = value.trim();
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new HttpError(400, 'INVALID_CUSTOMER', 'timezone must be a valid IANA time-zone identifier.');
  }
  return timezone;
};

const parseStatus = (value: unknown): OrganizationLifecycle => {
  if (typeof value !== 'string' || !LIFECYCLE_VALUES.has(value as OrganizationLifecycle)) {
    throw new HttpError(400, 'INVALID_CUSTOMER', 'status must be ACTIVE or SUSPENDED.');
  }
  return value as OrganizationLifecycle;
};

const requireResellerAdmin = async (actorId: string, resellerId: string) => {
  const membership = await getMembership(actorId, resellerId);
  if (membership?.role !== 'RESELLER_ADMIN') {
    throw new HttpError(403, 'CUSTOMER_PROVISIONING_DENIED', 'Customer provisioning requires reseller administrator authority.');
  }
};

const requireCustomerCreation = async (actorId: string, resellerId: string) => {
  if (!await canCreateCustomers(actorId, resellerId)) {
    throw new HttpError(403, 'CUSTOMER_PROVISIONING_DENIED', 'Customer provisioning is not enabled for this reseller.');
  }
};

const requireActiveRelationship = async (actorId: string, resellerId: string, customerId: string) => {
  if (!await canManageCustomerSettings(actorId, resellerId)) {
    throw new HttpError(403, 'CUSTOMER_SETTINGS_DENIED', 'Customer settings management is not enabled for this reseller.');
  }
  const relationship = await ServiceRelationship.findOne({ where: {
    resellerOrganizationId: resellerId,
    customerOrganizationId: customerId,
    status: 'ACTIVE'
  } });
  if (!relationship) {
    throw new HttpError(403, 'CUSTOMER_SCOPE_DENIED', 'The customer is outside this reseller scope.');
  }
  return relationship;
};

const serializeCustomer = (organization: Organization, relationship: ServiceRelationship) => ({
  id: organization.id,
  name: organization.name,
  defaultLocale: organization.defaultLocale,
  timezone: organization.timezone,
  status: organization.status,
  serviceRelationship: {
    id: relationship.id,
    status: relationship.status,
    startedAt: relationship.startedAt
  }
});

export async function listCustomers(actorId: string, resellerId: string) {
  await requireResellerAdmin(actorId, resellerId);
  const relationships = await ServiceRelationship.findAll({
    where: { resellerOrganizationId: resellerId, status: { [Op.ne]: 'ENDED' } },
    order: [['startedAt', 'ASC']]
  });
  if (!relationships.length) return [];
  const customers = await Organization.findAll({ where: {
    id: { [Op.in]: relationships.map(item => item.customerOrganizationId) },
    type: 'CUSTOMER'
  } });
  const customersById = new Map(customers.map(customer => [customer.id, customer]));
  return relationships.flatMap(relationship => {
    const customer = customersById.get(relationship.customerOrganizationId);
    return customer ? [serializeCustomer(customer, relationship)] : [];
  });
}

export async function createCustomer(actorId: string, resellerId: string, input: CustomerInput) {
  await requireCustomerCreation(actorId, resellerId);
  const name = parseName(input.name);
  const defaultLocale = parseLocale(input.defaultLocale);
  const timezone = parseTimezone(input.timezone);
  const status = parseStatus(input.status);
  if (await Organization.findOne({ where: { type: 'CUSTOMER', name } })) {
    throw new HttpError(409, 'CUSTOMER_NAME_EXISTS', 'A customer with this name already exists.');
  }
  return sequelize.transaction(async transaction => {
    const customer = await Organization.create({
      id: `org-customer-${crypto.randomUUID()}`,
      name,
      type: 'CUSTOMER',
      defaultLocale,
      timezone,
      status
    }, { transaction });
    const relationship = await ServiceRelationship.create({
      id: `relationship-${crypto.randomUUID()}`,
      resellerOrganizationId: resellerId,
      customerOrganizationId: customer.id,
      status: 'ACTIVE',
      startedAt: new Date()
    }, { transaction });
    await recordAudit({
      actorId,
      action: 'CUSTOMER_CREATED',
      resourceType: 'ORGANIZATION',
      resourceId: customer.id,
      outcome: 'SUCCESS',
      details: { resellerOrganizationId: resellerId, name, defaultLocale, timezone, status }
    }, transaction);
    await recordAudit({
      actorId,
      action: 'SERVICE_RELATIONSHIP_CREATED',
      resourceType: 'SERVICE_RELATIONSHIP',
      resourceId: relationship.id,
      outcome: 'SUCCESS',
      details: { resellerOrganizationId: resellerId, customerOrganizationId: customer.id, status: relationship.status }
    }, transaction);
    return serializeCustomer(customer, relationship);
  });
}

export async function updateCustomer(actorId: string, resellerId: string, customerId: string, input: CustomerInput) {
  const relationship = await requireActiveRelationship(actorId, resellerId, customerId);
  const suppliedKeys = ['name', 'defaultLocale', 'timezone', 'status'].filter(key => Object.prototype.hasOwnProperty.call(input, key));
  if (!suppliedKeys.length) throw new HttpError(400, 'INVALID_CUSTOMER', 'At least one customer field must be supplied.');
  const customer = await Organization.findOne({ where: { id: customerId, type: 'CUSTOMER' } });
  if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'The customer does not exist.');
  const name = Object.prototype.hasOwnProperty.call(input, 'name') ? parseName(input.name) : customer.name;
  const defaultLocale = Object.prototype.hasOwnProperty.call(input, 'defaultLocale') ? parseLocale(input.defaultLocale) : customer.defaultLocale;
  const timezone = Object.prototype.hasOwnProperty.call(input, 'timezone') ? parseTimezone(input.timezone) : customer.timezone;
  const status = Object.prototype.hasOwnProperty.call(input, 'status') ? parseStatus(input.status) : customer.status;
  if (name !== customer.name && await Organization.findOne({ where: { type: 'CUSTOMER', name, id: { [Op.ne]: customer.id } } })) {
    throw new HttpError(409, 'CUSTOMER_NAME_EXISTS', 'A customer with this name already exists.');
  }
  const previous = { name: customer.name, defaultLocale: customer.defaultLocale, timezone: customer.timezone, status: customer.status };
  const current = { name, defaultLocale, timezone, status };
  return sequelize.transaction(async transaction => {
    customer.name = name;
    customer.defaultLocale = defaultLocale;
    customer.timezone = timezone;
    customer.status = status;
    await customer.save({ transaction });
    if (previous.name !== name || previous.defaultLocale !== defaultLocale || previous.timezone !== timezone || previous.status !== status) {
      await recordAudit({
        actorId,
        action: 'CUSTOMER_UPDATED',
        resourceType: 'ORGANIZATION',
        resourceId: customer.id,
        outcome: 'SUCCESS',
        details: { resellerOrganizationId: resellerId, previous, current }
      }, transaction);
    }
    return serializeCustomer(customer, relationship);
  });
}
