import type { Request, Response } from 'express';
import { getAdminOverview } from '../services/admin.service.js';
import * as resellerProvisioningService from '../services/reseller-provisioning.service.js';

export async function showAdminOverview(request: Request, response: Response): Promise<void> {
  response.json(await getAdminOverview(request.actor!.id));
}

export async function showResellers(request: Request, response: Response): Promise<void> {
  response.json(await resellerProvisioningService.listResellers(request.actor!.id));
}

export async function createReseller(request: Request, response: Response): Promise<void> {
  response.status(201).json(await resellerProvisioningService.createReseller(request.actor!.id, (request.body ?? {}) as Record<string, unknown>));
}

export async function updateReseller(request: Request, response: Response): Promise<void> {
  response.json(await resellerProvisioningService.updateReseller(
    request.actor!.id,
    String(request.params.resellerId ?? ''),
    (request.body ?? {}) as Record<string, unknown>
  ));
}
