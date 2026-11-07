import type { Request, Response } from 'express';
import * as organizationSettingsService from '../services/organization-settings.service.js';

export async function showOrganizationSettings(request: Request, response: Response): Promise<void> {
  response.json(await organizationSettingsService.getOrganizationSettings(request.actor!.id, String(request.params.organizationId ?? '')));
}

export async function updateOrganizationSettings(request: Request, response: Response): Promise<void> {
  const body = (request.body ?? {}) as Record<string, unknown>;
  response.json(await organizationSettingsService.updateOrganizationSettings(request.actor!.id, String(request.params.organizationId ?? ''), {
    defaultLocale: String(body.defaultLocale ?? '')
  }));
}
