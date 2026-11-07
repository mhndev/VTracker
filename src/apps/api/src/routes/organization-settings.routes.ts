import { Router } from 'express';
import { showOrganizationSettings, updateOrganizationSettings } from '../controllers/organization-settings.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const organizationSettingsRouter = Router();
organizationSettingsRouter.get('/:organizationId/settings', asyncHandler(showOrganizationSettings));
organizationSettingsRouter.patch('/:organizationId/settings', asyncHandler(updateOrganizationSettings));
