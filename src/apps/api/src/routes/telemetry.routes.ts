import { Router } from 'express';
import { simulate } from '../controllers/telemetry.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const telemetryRouter = Router();
telemetryRouter.post('/simulate', asyncHandler(simulate));
