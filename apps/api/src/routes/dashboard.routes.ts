import { Router } from 'express';
import { showDashboard } from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboardRouter = Router();
dashboardRouter.get('/', asyncHandler(showDashboard));
