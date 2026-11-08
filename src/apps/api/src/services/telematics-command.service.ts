import { Op } from 'sequelize';
import { Device, DeviceAssignment, DeviceMessageLog, LatestPosition, Trip, TripPoint, Vehicle, VehicleState } from '../models/index.js';
import { encodeCobanCommand, type CommandOptions } from '../telematics/encoder.js';
import { telematicsSessions } from '../telematics/session.js';
import type { DownlinkCommandType } from '../telematics/types.js';
import { HttpError } from '../utils/errors.js';
import { recordAudit } from './audit.service.js';
import { canControlVehicle, canViewLocation } from './policy.service.js';

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
    response = await telematicsSessions.sendCommand(imei, encodedCommand, 8000, { actorId, vehicleId });
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

export async function listVehicleTelematicsMessages(actorId: string, vehicleId: string, limit = 100) {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle || vehicle.archivedAt) {
    throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${vehicleId} was not found.`);
  }
  if (!await canViewLocation(actorId, vehicleId, new Date(), undefined, vehicle)) {
    throw new HttpError(403, 'SCOPE_DENIED', 'Current location access is required to view device messages.');
  }

  const assignments = await DeviceAssignment.findAll({ where: { vehicleId }, order: [['assignedAt', 'DESC']] });
  const devices = assignments.length ? await Device.findAll({ where: { id: { [Op.in]: assignments.map(assignment => assignment.deviceId) } } }) : [];
  const serials = devices.map(device => device.serial);
  const currentAssignment = assignments.find(assignment => assignment.unassignedAt === null);
  const currentDevice = currentAssignment ? devices.find(device => device.id === currentAssignment.deviceId) : undefined;

  return {
    vehicleId,
    imei: currentDevice?.serial ?? null,
    messages: await DeviceMessageLog.findAll({
      where: serials.length
        ? { [Op.or]: [{ vehicleId }, { vehicleId: null, imei: { [Op.in]: serials } }] }
        : { vehicleId },
      order: [['recordedAt', 'DESC']],
      limit: Math.max(1, Math.min(200, Math.floor(limit)))
    })
  };
}

export async function getVehicleTelematicsDetails(actorId: string, vehicleId: string) {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle || vehicle.archivedAt) throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${vehicleId} was not found.`);
  if (!await canViewLocation(actorId, vehicleId, new Date(), undefined, vehicle)) {
    throw new HttpError(403, 'SCOPE_DENIED', 'Current location access is required to view vehicle state and trips.');
  }
  const [state, position, trips, assignment] = await Promise.all([
    VehicleState.findByPk(vehicleId),
    LatestPosition.findByPk(vehicleId),
    Trip.findAll({ where: { vehicleId }, order: [['startedAt', 'DESC']], limit: 100 }),
    DeviceAssignment.findOne({ where: { vehicleId, unassignedAt: null } })
  ]);
  const device = assignment ? await Device.findByPk(assignment.deviceId) : null;
  const tripIds = trips.map(trip => trip.id);
  const points = tripIds.length ? await TripPoint.findAll({ where: { tripId: { [Op.in]: tripIds } }, order: [['occurredAt', 'ASC']] }) : [];
  const pointsByTrip = new Map<string, Array<{ latitude: number; longitude: number; occurredAt: Date }>>();
  for (const point of points) {
    const values = pointsByTrip.get(point.tripId) ?? [];
    values.push({ latitude: point.latitude, longitude: point.longitude, occurredAt: point.occurredAt });
    pointsByTrip.set(point.tripId, values);
  }
  const online = Boolean(device && device.status === 'ACTIVE' && Date.now() - device.lastCommunicationAt.getTime() < 10 * 60_000);
  return {
    vehicleId,
    connection: {
      online,
      lastCommunicationAt: device?.lastCommunicationAt ?? null
    },
    motion: position
      ? { moving: position.speedKph > 2, speedKph: position.speedKph, updatedAt: position.occurredAt }
      : null,
    state: state?.get() ?? null,
    trips: trips.map(trip => ({
      ...trip.get(),
      status: trip.endedAt ? 'COMPLETED' : 'IN_PROGRESS',
      durationSeconds: Math.max(0, Math.round(((trip.endedAt ?? new Date()).getTime() - trip.startedAt.getTime()) / 1000)),
      pathPoints: pointsByTrip.get(trip.id) ?? []
    }))
  };
}
