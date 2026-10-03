import { sequelize } from '../database/connection.js';
import { Device, DeviceAssignment, LatestPosition, TelemetryEvent, Vehicle } from '../models/index.js';
import { HttpError } from '../utils/errors.js';
import { canSimulateTelemetry } from './policy.service.js';
import { recordAudit } from './audit.service.js';

export async function simulateTelemetry(actorId: string, organizationId: string) {
  if (!await canSimulateTelemetry(actorId, organizationId)) {
    throw new HttpError(403, 'TELEMETRY_WRITE_DENIED', 'Only a customer fleet manager may run the local simulator.');
  }
  const accepted = await sequelize.transaction(async transaction => {
    const vehicles = await Vehicle.findAll({ where: { ownerOrganizationId: organizationId }, transaction });
    let count = 0;
    for (const vehicle of vehicles) {
      const assignment = await DeviceAssignment.findOne({ where: { vehicleId: vehicle.id, unassignedAt: null }, transaction });
      const device = assignment ? await Device.findByPk(assignment.deviceId, { transaction }) : null;
      const previous = await LatestPosition.findByPk(vehicle.id, { transaction });
      if (!device || device.status !== 'ACTIVE' || !previous) continue;
      const now = new Date();
      const event = {
        id: `telemetry-${crypto.randomUUID()}`,
        vehicleId: vehicle.id,
        latitude: Number((previous.latitude + (Math.random() - 0.5) * 0.008).toFixed(6)),
        longitude: Number((previous.longitude + (Math.random() - 0.5) * 0.012).toFixed(6)),
        speedKph: Math.max(0, Math.round(previous.speedKph + (Math.random() - 0.4) * 22)),
        heading: Math.round((previous.heading + Math.random() * 40) % 360),
        occurredAt: now,
        ingestedAt: now,
        quality: 'VALID',
        schemaVersion: 1,
        source: 'LOCAL_SIMULATOR'
      };
      await TelemetryEvent.create(event, { transaction });
      await previous.update({ ...event, eventId: event.id }, { transaction });
      await device.update({ lastCommunicationAt: now, signalQuality: 'GOOD' }, { transaction });
      count += 1;
    }
    return count;
  });
  await recordAudit({ actorId, action: 'TELEMETRY_SIMULATION_RUN', resourceType: 'ORGANIZATION', resourceId: organizationId, outcome: 'SUCCESS', details: { eventCount: accepted } });
  return { accepted, semantics: 'Each event has a unique id; latest position is a separate projection.' };
}
