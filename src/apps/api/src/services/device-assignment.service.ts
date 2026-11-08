import { Op, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../database/connection.js';
import { Device, DeviceAssignment, DeviceMessageLog, Vehicle } from '../models/index.js';
import { decodeCobanPacket } from '../telematics/decoder.js';
import { HttpError } from '../utils/errors.js';
import { recordAudit } from './audit.service.js';
import { canManageDeviceAssignments } from './policy.service.js';
import { isDeviceOnline } from './dashboard.service.js';
import { processLocationUpdate } from '../telematics/ingestion.js';

export async function projectLatestDeviceLocation(imei: string): Promise<void> {
  const latest = await DeviceMessageLog.findOne({
    where: { imei, direction: 'INBOUND', kind: 'LOCATION' },
    order: [['recordedAt', 'DESC']]
  });
  if (!latest) return;
  const packet = decodeCobanPacket(latest.raw);
  if (packet.type === 'LOCATION' && packet.data.validFix) await processLocationUpdate(packet.data);
}

async function requireAssignmentAuthority(actorId: string, customerOrganizationId: string): Promise<void> {
  if (!await canManageDeviceAssignments(actorId, customerOrganizationId)) {
    throw new HttpError(403, 'DEVICE_ASSIGNMENT_ADMIN_REQUIRED', 'Device assignments require customer fleet authority or explicit reseller device delegation.');
  }
}

function assignmentResponse(assignment: DeviceAssignment, device?: Device, vehicle?: Vehicle) {
  return {
    ...assignment.get(),
    ...(device ? { device: {
      id: device.id,
      serial: device.serial,
      model: device.model,
      radio: device.radio,
      custodyOrganizationId: device.custodyOrganizationId,
      status: device.status
    } } : {}),
    ...(vehicle ? { vehicle: {
      id: vehicle.id,
      ownerOrganizationId: vehicle.ownerOrganizationId,
      name: vehicle.name,
      plate: vehicle.plate,
      archivedAt: vehicle.archivedAt
    } } : {})
  };
}

export async function listDeviceAssignments(actorId: string, organizationIdInput: string) {
  const organizationId = String(organizationIdInput ?? '').trim();
  if (!organizationId) throw new HttpError(400, 'INVALID_DEVICE_ASSIGNMENT_FILTER', 'Select a customer organization.');
  await requireAssignmentAuthority(actorId, organizationId);
  const vehicles = await Vehicle.findAll({ where: { ownerOrganizationId: organizationId }, order: [['name', 'ASC']] });
  const vehicleIds = vehicles.map(vehicle => vehicle.id);
  const assignments = vehicleIds.length
    ? await DeviceAssignment.findAll({ where: { vehicleId: { [Op.in]: vehicleIds } }, order: [['assignedAt', 'DESC']] })
    : [];
  const deviceIds = [...new Set(assignments.map(assignment => assignment.deviceId))];
  const devices = deviceIds.length ? await Device.findAll({ where: { id: { [Op.in]: deviceIds } } }) : [];
  const deviceById = new Map(devices.map(device => [device.id, device]));
  const vehicleById = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  return assignments.map(assignment => assignmentResponse(assignment, deviceById.get(assignment.deviceId), vehicleById.get(assignment.vehicleId)));
}

export async function listDeviceInventory(actorId: string, organizationIdInput: string) {
  const organizationId = String(organizationIdInput ?? '').trim();
  if (!organizationId) throw new HttpError(400, 'INVALID_DEVICE_ASSIGNMENT_FILTER', 'Select a customer organization.');
  await requireAssignmentAuthority(actorId, organizationId);
  const [devices, vehicles] = await Promise.all([
    Device.findAll({ where: { custodyOrganizationId: organizationId }, order: [['serial', 'ASC']] }),
    Vehicle.findAll({ where: { ownerOrganizationId: organizationId } })
  ]);
  const deviceIds = devices.map(device => device.id);
  const assignments = deviceIds.length
    ? await DeviceAssignment.findAll({ where: { deviceId: { [Op.in]: deviceIds }, unassignedAt: null } })
    : [];
  const assignmentByDeviceId = new Map(assignments.map(assignment => [assignment.deviceId, assignment]));
  const vehicleById = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  return devices.map(device => {
    const assignment = assignmentByDeviceId.get(device.id);
    const vehicle = assignment ? vehicleById.get(assignment.vehicleId) : undefined;
    return {
      id: device.id,
      serial: device.serial,
      model: device.model,
      radio: device.radio,
      custodyOrganizationId: device.custodyOrganizationId,
      status: isDeviceOnline(device) ? 'ONLINE' : device.status === 'QUARANTINED' ? 'QUARANTINED' : 'OFFLINE',
      batteryPercent: device.batteryPercent,
      signalQuality: device.signalQuality,
      lastCommunicationAt: device.lastCommunicationAt,
      currentAssignment: assignment ? {
        id: assignment.id,
        assignedAt: assignment.assignedAt,
        vehicle: vehicle ? { id: vehicle.id, name: vehicle.name, plate: vehicle.plate, archivedAt: vehicle.archivedAt } : undefined
      } : null
    };
  });
}

export async function createDeviceAssignment(actorId: string, input: { deviceId: string; vehicleId: string }) {
  const deviceId = String(input.deviceId ?? '').trim();
  const vehicleId = String(input.vehicleId ?? '').trim();
  if (!deviceId || !vehicleId) throw new HttpError(400, 'INVALID_DEVICE_ASSIGNMENT', 'Select a device and vehicle.');
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  await requireAssignmentAuthority(actorId, vehicle.ownerOrganizationId);
  if (vehicle.archivedAt) throw new HttpError(409, 'VEHICLE_ARCHIVED', 'Restore this vehicle before assigning a device.');
  const device = await Device.findByPk(deviceId);
  if (!device) throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
  if (device.custodyOrganizationId !== vehicle.ownerOrganizationId) {
    throw new HttpError(403, 'DEVICE_ASSIGNMENT_SCOPE_DENIED', 'The device and vehicle must belong to the same customer scope.');
  }
  try {
    const result = await sequelize.transaction(async transaction => {
      const [deviceConflict, vehicleConflict] = await Promise.all([
        DeviceAssignment.findOne({ where: { deviceId, unassignedAt: null }, transaction }),
        DeviceAssignment.findOne({ where: { vehicleId, unassignedAt: null }, transaction })
      ]);
      if (deviceConflict) throw new HttpError(409, 'DEVICE_ALREADY_ASSIGNED', 'End the current device assignment before assigning it again.');
      if (vehicleConflict) throw new HttpError(409, 'VEHICLE_ALREADY_ASSIGNED', 'End the vehicle\'s current assignment before assigning another device.');
      const assignment = await DeviceAssignment.create({
        id: `assignment-${crypto.randomUUID()}`,
        deviceId,
        vehicleId,
        assignedAt: new Date(),
        unassignedAt: null
      }, { transaction });
      await recordAudit({
        actorId,
        action: 'DEVICE_ASSIGNED',
        resourceType: 'DEVICE_ASSIGNMENT',
        resourceId: assignment.id,
        outcome: 'SUCCESS',
        details: { customerOrganizationId: vehicle.ownerOrganizationId, deviceId, vehicleId }
      }, transaction);
      return assignmentResponse(assignment, device, vehicle);
    });
    await projectLatestDeviceLocation(device.serial);
    return result;
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new HttpError(409, 'DEVICE_ASSIGNMENT_CONFLICT', 'The device or vehicle already has an active assignment.');
    }
    throw error;
  }
}

export async function endDeviceAssignment(actorId: string, assignmentIdInput: string) {
  const assignmentId = String(assignmentIdInput ?? '').trim();
  if (!assignmentId) throw new HttpError(400, 'INVALID_DEVICE_ASSIGNMENT', 'Select an assignment to end.');
  const existing = await DeviceAssignment.findByPk(assignmentId);
  if (!existing) throw new HttpError(404, 'DEVICE_ASSIGNMENT_NOT_FOUND', 'Device assignment not found.');
  const vehicle = await Vehicle.findByPk(existing.vehicleId);
  if (!vehicle) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  await requireAssignmentAuthority(actorId, vehicle.ownerOrganizationId);
  const device = await Device.findByPk(existing.deviceId) ?? undefined;
  if (existing.unassignedAt) return assignmentResponse(existing, device, vehicle);
  return sequelize.transaction(async transaction => {
    const assignment = await DeviceAssignment.findByPk(assignmentId, { transaction });
    if (!assignment) throw new HttpError(404, 'DEVICE_ASSIGNMENT_NOT_FOUND', 'Device assignment not found.');
    if (assignment.unassignedAt) return assignmentResponse(assignment, device, vehicle);
    assignment.unassignedAt = new Date();
    await assignment.save({ transaction });
    await recordAudit({
      actorId,
      action: 'DEVICE_UNASSIGNED',
      resourceType: 'DEVICE_ASSIGNMENT',
      resourceId: assignment.id,
      outcome: 'SUCCESS',
      details: { customerOrganizationId: vehicle.ownerOrganizationId, deviceId: assignment.deviceId, vehicleId: assignment.vehicleId }
    }, transaction);
    return assignmentResponse(assignment, device, vehicle);
  });
}
