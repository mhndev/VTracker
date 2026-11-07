import type { Request, Response } from 'express';
import * as customerProvisioningService from '../services/customer-provisioning.service.js';

export async function showCustomers(request: Request, response: Response): Promise<void> {
  response.json(await customerProvisioningService.listCustomers(
    request.actor!.id,
    String(request.params.resellerId ?? '')
  ));
}

export async function createCustomer(request: Request, response: Response): Promise<void> {
  response.status(201).json(await customerProvisioningService.createCustomer(
    request.actor!.id,
    String(request.params.resellerId ?? ''),
    (request.body ?? {}) as Record<string, unknown>
  ));
}

export async function updateCustomer(request: Request, response: Response): Promise<void> {
  response.json(await customerProvisioningService.updateCustomer(
    request.actor!.id,
    String(request.params.resellerId ?? ''),
    String(request.params.customerId ?? ''),
    (request.body ?? {}) as Record<string, unknown>
  ));
}
