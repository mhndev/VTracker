import { Router } from 'express';
import { createReseller, showAdminOverview, showResellers, updateReseller } from '../controllers/admin.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = Router();
adminRouter.get('/overview', asyncHandler(showAdminOverview));
adminRouter.get('/resellers', asyncHandler(showResellers));
adminRouter.post('/resellers', asyncHandler(createReseller));
adminRouter.patch('/resellers/:resellerId', asyncHandler(updateReseller));
