import type { NextFunction, Request, Response } from 'express';
import { User } from '../models/index.js';
import { HttpError } from '../utils/errors.js';

export async function attachActor(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const actorId = request.header('x-demo-actor') ?? 'user-customer-admin';
    const actor = await User.findByPk(actorId);
    if (!actor) throw new HttpError(401, 'UNKNOWN_ACTOR', 'The demo actor is unknown.');
    request.actor = actor;
    next();
  } catch (error) {
    next(error);
  }
}
