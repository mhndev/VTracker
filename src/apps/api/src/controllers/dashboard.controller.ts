import type { Request, Response } from 'express';
import { getDashboard } from '../services/dashboard.service.js';
import { HttpError } from '../utils/errors.js';

export async function showDashboard(request: Request, response: Response): Promise<void> {
  const organizationId = String(request.query.organizationId ?? '');
  const dashboard = await getDashboard(request.actor!.id, organizationId);
  if (!dashboard) throw new HttpError(403, 'SCOPE_DENIED', 'This organization is outside the actor scope.');
  response.json(dashboard);
}
