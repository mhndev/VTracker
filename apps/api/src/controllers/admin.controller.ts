import type { Request, Response } from 'express';
import { getAdminOverview } from '../services/admin.service.js';

export async function showAdminOverview(request: Request, response: Response): Promise<void> {
  response.json(await getAdminOverview(request.actor!.id));
}
