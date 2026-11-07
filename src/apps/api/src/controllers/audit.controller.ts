import type { Request, Response } from 'express';
import { listOrganizationAudit } from '../services/audit-query.service.js';

export async function indexAudit(request: Request, response: Response): Promise<void> {
  response.json(await listOrganizationAudit(request.actor!.id, String(request.query.organizationId ?? '')));
}
