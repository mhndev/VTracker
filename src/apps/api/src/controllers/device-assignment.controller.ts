import type { Request, Response } from 'express';
import * as deviceAssignmentService from '../services/device-assignment.service.js';

export async function indexDeviceAssignments(request: Request, response: Response): Promise<void> {
  response.json(await deviceAssignmentService.listDeviceAssignments(request.actor!.id, String(request.query.organizationId ?? '')));
}

export async function indexDeviceInventory(request: Request, response: Response): Promise<void> {
  response.json(await deviceAssignmentService.listDeviceInventory(request.actor!.id, String(request.query.organizationId ?? '')));
}

export async function storeDeviceAssignment(request: Request, response: Response): Promise<void> {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const assignment = await deviceAssignmentService.createDeviceAssignment(request.actor!.id, {
    deviceId: String(body.deviceId ?? ''),
    vehicleId: String(body.vehicleId ?? '')
  });
  response.status(201).json(assignment);
}

export async function destroyDeviceAssignment(request: Request, response: Response): Promise<void> {
  response.json(await deviceAssignmentService.endDeviceAssignment(request.actor!.id, String(request.params.assignmentId)));
}
