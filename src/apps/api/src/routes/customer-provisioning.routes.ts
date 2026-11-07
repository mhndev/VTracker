import { Router } from 'express';
import { createCustomer, showCustomers, updateCustomer } from '../controllers/customer-provisioning.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const customerProvisioningRouter = Router({ mergeParams: true });
customerProvisioningRouter.get('/', asyncHandler(showCustomers));
customerProvisioningRouter.post('/', asyncHandler(createCustomer));
customerProvisioningRouter.patch('/:customerId', asyncHandler(updateCustomer));
