import type { Request, Response } from 'express';
import { getSession } from '../services/session.service.js';
import { HttpError } from '../utils/errors.js';

export async function showSession(request: Request, response: Response): Promise<void> {
  const session = await getSession(request.actor!.id);
  if (!session) throw new HttpError(401, 'UNKNOWN_ACTOR', 'The demo actor is unknown.');
  response.json(session);
}
