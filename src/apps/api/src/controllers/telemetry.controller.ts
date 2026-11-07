import type { Request, Response } from 'express';
import { simulateTelemetry } from '../services/telemetry.service.js';

export async function simulate(request: Request, response: Response): Promise<void> {
  response.json(await simulateTelemetry(request.actor!.id, String(request.body?.organizationId ?? '')));
}
