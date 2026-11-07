import { Router } from 'express';
import { destroyDeviceAssignment, indexDeviceAssignments, indexDeviceInventory, storeDeviceAssignment } from '../controllers/device-assignment.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const deviceAssignmentRouter = Router();
deviceAssignmentRouter.get('/', asyncHandler(indexDeviceAssignments));
deviceAssignmentRouter.get('/inventory', asyncHandler(indexDeviceInventory));
deviceAssignmentRouter.post('/', asyncHandler(storeDeviceAssignment));
deviceAssignmentRouter.delete('/:assignmentId', asyncHandler(destroyDeviceAssignment));
