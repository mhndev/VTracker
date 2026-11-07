import { Router } from 'express';
import { archiveVehicle, indexVehicles, restoreVehicle, storeVehicle, updateVehicle } from '../controllers/vehicle.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const vehicleRouter = Router();
vehicleRouter.get('/', asyncHandler(indexVehicles));
vehicleRouter.post('/', asyncHandler(storeVehicle));
vehicleRouter.patch('/:vehicleId', asyncHandler(updateVehicle));
vehicleRouter.post('/:vehicleId/archive', asyncHandler(archiveVehicle));
vehicleRouter.post('/:vehicleId/restore', asyncHandler(restoreVehicle));
