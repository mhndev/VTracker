import type { Request, Response } from 'express';
import * as grantService from '../services/grant.service.js';

export async function indexGrants(request: Request, response: Response): Promise<void> {
  response.json(await grantService.listGrants(request.actor!.id, String(request.query.organizationId ?? '')));
}

export async function storeGrant(request: Request, response: Response): Promise<void> {
  const body = (request.body ?? {}) as Record<string, unknown>;
  // Coerce every field to a string so a missing/mistyped body field fails validation
  // with a 400 instead of reaching Sequelize with an undefined WHERE value.
  const grant = await grantService.createGrant(request.actor!.id, {
    organizationId: String(body.organizationId ?? ''),
    vehicleId: String(body.vehicleId ?? ''),
    durationHours: Number(body.durationHours),
    purpose: String(body.purpose ?? '')
  });
  response.status(201).json(grant);
}

export async function destroyGrant(request: Request, response: Response): Promise<void> {
  await grantService.revokeGrant(request.actor!.id, String(request.params.grantId));
  response.status(204).end();
}
