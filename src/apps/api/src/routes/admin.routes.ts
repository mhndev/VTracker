import { Router } from 'express';
import { createReseller, showAdminOverview, showDeviceCatalog, showResellers, showRetentionCapacity, updateOrganizationRetention, updateReseller, updateResellerDeviceAvailability } from '../controllers/admin.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = Router();
adminRouter.get('/overview', asyncHandler(showAdminOverview));
adminRouter.get('/resellers', asyncHandler(showResellers));
adminRouter.post('/resellers', asyncHandler(createReseller));
adminRouter.patch('/resellers/:resellerId', asyncHandler(updateReseller));
adminRouter.get('/retention', asyncHandler(showRetentionCapacity));
adminRouter.put('/retention/organizations/:organizationId', asyncHandler(updateOrganizationRetention));
adminRouter.get('/device-catalog', asyncHandler(showDeviceCatalog));
adminRouter.put('/device-catalog/resellers/:resellerId/protocols/:protocolProfileId', asyncHandler(updateResellerDeviceAvailability));
