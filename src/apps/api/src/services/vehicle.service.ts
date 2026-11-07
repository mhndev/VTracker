import { Op, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../database/connection.js';
import { Organization, Vehicle } from '../models/index.js';
import { canManageVehicles } from './policy.service.js';
import { recordAudit } from './audit.service.js';
import { HttpError } from '../utils/errors.js';

const VEHICLE_KINDS = ['CAR', 'VAN', 'TRUCK', 'MOTORCYCLE', 'SCOOTER', 'BICYCLE', 'BUS', 'UTILITY'];
const MARKER_STYLES = ['DOT', 'SILHOUETTE', 'DIRECTIONAL', 'BADGE', 'PIN', 'OUTLINE', 'STATUS', 'HIGH_VISIBILITY'];
const MARKER_COLORS = ['BLUE', 'VIOLET', 'GREEN', 'AMBER'];
const MARKER_SIZES = ['SMALL', 'MEDIUM', 'LARGE'];

function normalizeVehicleInput(input: {
  name: string;
  plate: string;
  kind: string;
  markerStyle: string;
  markerColor: string;
  markerSize: string;
}) {
  const name = String(input.name ?? '').trim();
  const plate = String(input.plate ?? '').trim().toUpperCase();
  const kind = String(input.kind ?? '').trim().toUpperCase();
  const markerStyle = String(input.markerStyle ?? '').trim().toUpperCase();
  const markerColor = String(input.markerColor ?? '').trim().toUpperCase();
  const markerSize = String(input.markerSize ?? '').trim().toUpperCase();
  if (name.length < 2 || name.length > 80 || plate.length < 2 || plate.length > 24 ||
    !VEHICLE_KINDS.includes(kind) || !MARKER_STYLES.includes(markerStyle) ||
    !MARKER_COLORS.includes(markerColor) || !MARKER_SIZES.includes(markerSize)) {
    throw new HttpError(400, 'INVALID_VEHICLE', 'Enter a name and plate, then choose a supported vehicle type and map marker.');
  }
  return { name, plate, kind, markerStyle, markerColor, markerSize };
}

async function requireManageableVehicle(actorId: string, vehicleId: string): Promise<Vehicle> {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  if (!await canManageVehicles(actorId, vehicle.ownerOrganizationId)) {
    throw new HttpError(403, 'VEHICLE_ADMIN_REQUIRED', 'Vehicle management requires customer fleet authority or explicit reseller fleet delegation.');
  }
  return vehicle;
}

export async function listVehicles(actorId: string, organizationIdInput: string, statusInput: string) {
  const organizationId = String(organizationIdInput ?? '').trim();
  const status = String(statusInput || 'ACTIVE').trim().toUpperCase();
  if (!organizationId || !['ACTIVE', 'ARCHIVED', 'ALL'].includes(status)) {
    throw new HttpError(400, 'INVALID_VEHICLE_FILTER', 'Choose an active or archived vehicle filter.');
  }
  if (!await canManageVehicles(actorId, organizationId)) {
    throw new HttpError(403, 'VEHICLE_ADMIN_REQUIRED', 'Vehicle management requires customer fleet authority or explicit reseller fleet delegation.');
  }
  const where = status === 'ACTIVE'
    ? { ownerOrganizationId: organizationId, archivedAt: null }
    : status === 'ARCHIVED'
      ? { ownerOrganizationId: organizationId, archivedAt: { [Op.not]: null } }
      : { ownerOrganizationId: organizationId };
  const vehicles = await Vehicle.findAll({ where, order: [['name', 'ASC']] });
  return vehicles.map(vehicle => vehicle.get());
}

export async function createVehicle(actorId: string, input: {
  organizationId: string;
  name: string;
  plate: string;
  kind: string;
  markerStyle: string;
  markerColor: string;
  markerSize: string;
}) {
  const organizationId = String(input.organizationId ?? '').trim();
  if (!organizationId) throw new HttpError(400, 'INVALID_VEHICLE', 'Select a customer organization.');
  const { name, plate, kind, markerStyle, markerColor, markerSize } = normalizeVehicleInput(input);
  if (!await canManageVehicles(actorId, organizationId)) {
    throw new HttpError(403, 'VEHICLE_ADMIN_REQUIRED', 'Vehicle creation requires customer fleet authority or explicit reseller fleet delegation.');
  }
  const organization = await Organization.findOne({ where: { id: organizationId, type: 'CUSTOMER' } });
  const duplicate = await Vehicle.findOne({ where: { ownerOrganizationId: organizationId, plate } });
  if (!organization) throw new HttpError(400, 'INVALID_VEHICLE', 'Select a customer organization.');
  if (duplicate) throw new HttpError(409, 'VEHICLE_PLATE_EXISTS', 'A vehicle with this plate already exists.');
  // Defense-in-depth: the findOne check above handles the common case, but a
  // database-level unique index on (owner_organization_id, plate) prevents the
  // race where two concurrent requests both pass the findOne check. The client
  // lock (in-flight ref + disabled button) makes this extremely unlikely, but
  // the constraint ensures correctness under any concurrency scenario.
  let vehicle;
  try {
    vehicle = await Vehicle.create({
      id: `vehicle-${crypto.randomUUID()}`,
      ownerOrganizationId: organizationId,
      name,
      plate,
      kind,
      markerStyle,
      markerColor,
      markerSize
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new HttpError(409, 'VEHICLE_PLATE_EXISTS', 'A vehicle with this plate already exists.');
    }
    throw error;
  }
  await recordAudit({
    actorId,
    action: 'VEHICLE_CREATED',
    resourceType: 'VEHICLE',
    resourceId: vehicle.id,
    outcome: 'SUCCESS',
    details: { ownerOrganizationId: organizationId, kind, markerStyle, markerColor, markerSize }
  });
  return vehicle.get();
}

export async function updateVehicle(actorId: string, vehicleId: string, input: {
  name: string;
  plate: string;
  kind: string;
  markerStyle: string;
  markerColor: string;
  markerSize: string;
}) {
  const vehicle = await requireManageableVehicle(actorId, vehicleId);
  if (vehicle.archivedAt) throw new HttpError(409, 'VEHICLE_ARCHIVED', 'Restore this vehicle before editing it.');
  const values = normalizeVehicleInput(input);
  const duplicate = await Vehicle.findOne({ where: { ownerOrganizationId: vehicle.ownerOrganizationId, plate: values.plate, id: { [Op.ne]: vehicle.id } } });
  if (duplicate) throw new HttpError(409, 'VEHICLE_PLATE_EXISTS', 'A vehicle with this plate already exists.');
  try {
    return await sequelize.transaction(async transaction => {
      const previous = { name: vehicle.name, plate: vehicle.plate, kind: vehicle.kind, markerStyle: vehicle.markerStyle, markerColor: vehicle.markerColor, markerSize: vehicle.markerSize };
      vehicle.set({ ...values, updatedAt: new Date() });
      await vehicle.save({ transaction });
      await recordAudit({
        actorId,
        action: 'VEHICLE_UPDATED',
        resourceType: 'VEHICLE',
        resourceId: vehicle.id,
        outcome: 'SUCCESS',
        details: { ownerOrganizationId: vehicle.ownerOrganizationId, previous, current: values }
      }, transaction);
      return vehicle.get();
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new HttpError(409, 'VEHICLE_PLATE_EXISTS', 'A vehicle with this plate already exists.');
    throw error;
  }
}

async function setVehicleArchived(actorId: string, vehicleId: string, archived: boolean) {
  const vehicle = await requireManageableVehicle(actorId, vehicleId);
  if (archived === Boolean(vehicle.archivedAt)) return vehicle.get();
  return sequelize.transaction(async transaction => {
    const changedAt = new Date();
    vehicle.archivedAt = archived ? changedAt : null;
    vehicle.updatedAt = changedAt;
    await vehicle.save({ transaction });
    await recordAudit({
      actorId,
      action: archived ? 'VEHICLE_ARCHIVED' : 'VEHICLE_RESTORED',
      resourceType: 'VEHICLE',
      resourceId: vehicle.id,
      outcome: 'SUCCESS',
      details: { ownerOrganizationId: vehicle.ownerOrganizationId, archivedAt: vehicle.archivedAt?.toISOString() ?? null }
    }, transaction);
    return vehicle.get();
  });
}

export const archiveVehicle = (actorId: string, vehicleId: string) => setVehicleArchived(actorId, vehicleId, true);
export const restoreVehicle = (actorId: string, vehicleId: string) => setVehicleArchived(actorId, vehicleId, false);
