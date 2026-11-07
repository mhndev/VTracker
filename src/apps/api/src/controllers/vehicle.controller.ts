import type { Request, Response } from 'express';
import * as vehicleService from '../services/vehicle.service.js';

const vehicleInput = (body: Record<string, unknown>) => ({
  name: String(body.name ?? ''),
  plate: String(body.plate ?? ''),
  kind: String(body.kind ?? ''),
  markerStyle: String(body.markerStyle ?? 'DOT'),
  markerColor: String(body.markerColor ?? 'BLUE'),
  markerSize: String(body.markerSize ?? 'MEDIUM')
});

export async function indexVehicles(request: Request, response: Response): Promise<void> {
  response.json(await vehicleService.listVehicles(request.actor!.id, String(request.query.organizationId ?? ''), String(request.query.status ?? 'ACTIVE')));
}

export async function storeVehicle(request: Request, response: Response): Promise<void> {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const vehicle = await vehicleService.createVehicle(request.actor!.id, {
    organizationId: String(body.organizationId ?? ''),
    ...vehicleInput(body)
  });
  response.status(201).json(vehicle);
}

export async function updateVehicle(request: Request, response: Response): Promise<void> {
  const body = (request.body ?? {}) as Record<string, unknown>;
  response.json(await vehicleService.updateVehicle(request.actor!.id, String(request.params.vehicleId), vehicleInput(body)));
}

export async function archiveVehicle(request: Request, response: Response): Promise<void> {
  response.json(await vehicleService.archiveVehicle(request.actor!.id, String(request.params.vehicleId)));
}

export async function restoreVehicle(request: Request, response: Response): Promise<void> {
  response.json(await vehicleService.restoreVehicle(request.actor!.id, String(request.params.vehicleId)));
}
