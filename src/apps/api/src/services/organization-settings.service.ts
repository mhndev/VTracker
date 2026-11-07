import { Organization, type SupportedLocale } from '../models/Organization.js';
import { HttpError } from '../utils/errors.js';
import { recordAudit } from './audit.service.js';
import { canReadOrganizationSettings, canUpdateOrganizationSettings } from './policy.service.js';

const SUPPORTED_LOCALES = new Set<SupportedLocale>(['en', 'fa']);

const serializeSettings = (organization: Organization) => ({
  organizationId: organization.id,
  defaultLocale: organization.defaultLocale,
  effectiveLocale: organization.defaultLocale
});

export async function getOrganizationSettings(actorId: string, organizationId: string) {
  if (!organizationId || !await canReadOrganizationSettings(actorId, organizationId)) {
    throw new HttpError(403, 'ORGANIZATION_SETTINGS_READ_DENIED', 'Organization settings are not available in this scope.');
  }
  const organization = await Organization.findByPk(organizationId);
  if (!organization) throw new HttpError(404, 'ORGANIZATION_NOT_FOUND', 'The organization does not exist.');
  return serializeSettings(organization);
}

export async function updateOrganizationSettings(actorId: string, organizationId: string, input: { defaultLocale: string }) {
  if (!organizationId || !await canUpdateOrganizationSettings(actorId, organizationId)) {
    throw new HttpError(403, 'ORGANIZATION_SETTINGS_UPDATE_DENIED', 'Organization settings cannot be changed in this scope.');
  }
  if (!SUPPORTED_LOCALES.has(input.defaultLocale as SupportedLocale)) {
    throw new HttpError(400, 'INVALID_ORGANIZATION_SETTINGS', 'defaultLocale must be en or fa.');
  }
  const organization = await Organization.findByPk(organizationId);
  if (!organization) throw new HttpError(404, 'ORGANIZATION_NOT_FOUND', 'The organization does not exist.');
  const previousLocale = organization.defaultLocale;
  if (previousLocale !== input.defaultLocale) {
    organization.defaultLocale = input.defaultLocale as SupportedLocale;
    await organization.save();
    await recordAudit({
      actorId,
      action: 'ORGANIZATION_LOCALE_CHANGED',
      resourceType: 'ORGANIZATION',
      resourceId: organization.id,
      outcome: 'SUCCESS',
      details: { previousLocale, defaultLocale: organization.defaultLocale }
    });
  }
  return serializeSettings(organization);
}
