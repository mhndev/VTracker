import { Device, DeviceAssignment, Vehicle } from '../models/index.js';
import { encodeCobanCommand, type CommandOptions } from '../telematics/encoder.js';
import { telematicsSessions } from '../telematics/session.js';
import type { DownlinkCommandType } from '../telematics/types.js';
import { HttpError } from '../utils/errors.js';
import { recordAudit } from './audit.service.js';
import { canControlVehicle } from './policy.service.js';

export async function sendVehicleCommand(
  actorId: string,
  vehicleId: string,
  commandType: DownlinkCommandType,
  options: CommandOptions = {}
): Promise<{ success: boolean; command: DownlinkCommandType; response: string }> {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle || vehicle.archivedAt) {
    throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${vehicleId} was not found.`);
  }

  const isAuthorized = await canControlVehicle(actorId, vehicle.ownerOrganizationId);
  if (!isAuthorized) {
    throw new HttpError(403, 'SCOPE_DENIED', 'Only an organization admin or fleet manager can execute vehicle commands.');
  }

  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId, unassignedAt: null }
  });
  if (!assignment) {
    throw new HttpError(400, 'NO_DEVICE_ASSIGNED', `Vehicle ${vehicle.name} does not have an active GPS tracker assigned.`);
  }

  const device = await Device.findByPk(assignment.deviceId);
  if (!device) {
    throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Assigned hardware device was not found.');
  }

  const imei = device.serial;
  const encodedCommand = encodeCobanCommand(commandType, options);

  let response: string;
  try {
    response = await telematicsSessions.sendCommand(imei, encodedCommand, 8000);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await recordAudit({
      actorId,
      action: 'VEHICLE_COMMAND_FAILED',
      resourceType: 'VEHICLE',
      resourceId: vehicle.id,
      outcome: 'FAILURE',
      details: { commandType, imei, error: errorMsg }
    });
    throw new HttpError(504, 'DEVICE_UNREACHABLE', errorMsg);
  }

  await recordAudit({
    actorId,
    action: 'VEHICLE_COMMAND_EXECUTED',
    resourceType: 'VEHICLE',
    resourceId: vehicle.id,
    outcome: 'SUCCESS',
    details: { commandType, imei, response }
  });

  return {
    success: true,
    command: commandType,
    response
  };
}

export function listConnectedTelematicsDevices() {
  return telematicsSessions.listActiveSessions();
}
