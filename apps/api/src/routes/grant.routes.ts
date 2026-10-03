import { Router } from 'express';
import { destroyGrant, indexGrants, storeGrant } from '../controllers/grant.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const grantRouter = Router();
grantRouter.get('/', asyncHandler(indexGrants));
grantRouter.post('/', asyncHandler(storeGrant));
grantRouter.delete('/:grantId', asyncHandler(destroyGrant));
