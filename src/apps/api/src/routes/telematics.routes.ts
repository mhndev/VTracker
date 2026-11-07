import { Router } from 'express';
import {
  listConnectedDevicesController,
  sendCommandController,
  telematicsStreamController
} from '../controllers/telematics.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const telematicsRouter = Router();

telematicsRouter.get('/sessions', asyncHandler(listConnectedDevicesController));
telematicsRouter.post('/commands', asyncHandler(sendCommandController));
telematicsRouter.get('/stream', telematicsStreamController);
