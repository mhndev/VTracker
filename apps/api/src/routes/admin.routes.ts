import { Router } from 'express';
import { showAdminOverview } from '../controllers/admin.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = Router();
adminRouter.get('/overview', asyncHandler(showAdminOverview));
