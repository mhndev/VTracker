import { Router } from 'express';
import { indexAudit } from '../controllers/audit.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const auditRouter = Router();
auditRouter.get('/', asyncHandler(indexAudit));
