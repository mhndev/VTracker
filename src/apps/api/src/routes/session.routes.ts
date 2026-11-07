import { Router } from 'express';
import { showSession } from '../controllers/session.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const sessionRouter = Router();
sessionRouter.get('/', asyncHandler(showSession));
