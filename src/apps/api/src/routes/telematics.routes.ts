import { Router } from 'express';
import {
  listConnectedDevicesController,
  getVehicleTelematicsDetailsController,
  listProtocolCatalogController,
  listVehicleMessagesController,
  sendCommandController,
  telematicsStreamController
} from '../controllers/telematics.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const telematicsRouter = Router();

telematicsRouter.get('/sessions', asyncHandler(listConnectedDevicesController));
telematicsRouter.get('/protocols', asyncHandler(listProtocolCatalogController));
telematicsRouter.get('/vehicles/:vehicleId/messages', asyncHandler(listVehicleMessagesController));
telematicsRouter.get('/vehicles/:vehicleId/details', asyncHandler(getVehicleTelematicsDetailsController));
telematicsRouter.post('/commands', asyncHandler(sendCommandController));
telematicsRouter.get('/stream', telematicsStreamController);
