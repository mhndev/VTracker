import crypto from 'node:crypto';
import type { Transaction } from 'sequelize';
import { sequelize } from '../database/connection.js';
import { Alert, Device, DeviceAssignment, DeviceMessageLog, LatestPosition, TelemetryEvent, Trip, TripPoint, Vehicle, VehicleState } from '../models/index.js';
import { telematicsSessions, type TelematicsMessage } from './session.js';
import type { CobanAlarmData, CobanAlarmType, CobanLocationData } from './types.js';

// Global Event Stream subscribers for SSE
type SseSubscriber = (event: { type: string; payload: unknown }) => void;
const sseSubscribers = new Set<SseSubscriber>();
let ingestionQueue: Promise<void> = Promise.resolve();
const MOVING_SPEED_KPH = 2;
const STOP_CONFIRMATION_MS = 5 * 60_000;
const MAX_TRIP_POINTS = 100;

function distanceKm(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function addTripPoint(tripId: string, location: Pick<CobanLocationData, 'occurredAt' | 'latitude' | 'longitude'>, transaction: Transaction): Promise<void> {
  const pointCount = await TripPoint.count({ where: { tripId }, transaction });
  const values = { latitude: location.latitude, longitude: location.longitude, occurredAt: location.occurredAt };
  if (pointCount < MAX_TRIP_POINTS) {
    await TripPoint.create({ tripId, slot: pointCount, ...values }, { transaction });
    return;
  }

  // Keep the first and latest points. As new points arrive, move the previous
  // endpoint into a deterministic interior slot before replacing the endpoint.
  // This bounds every path at 100 rows while retaining shape across long trips.
  const latest = await TripPoint.findOne({ where: { tripId, slot: MAX_TRIP_POINTS - 1 }, transaction });
  if (latest) {
    const hash = Math.abs(Math.round(location.occurredAt.getTime() / 1000));
    const interiorSlot = 1 + hash % (MAX_TRIP_POINTS - 2);
    await TripPoint.update({ latitude: latest.latitude, longitude: latest.longitude, occurredAt: latest.occurredAt }, { where: { tripId, slot: interiorSlot }, transaction });
    await latest.update(values, { transaction });
  }
}

export async function updateTrip(vehicleId: string, location: Pick<CobanLocationData, 'occurredAt' | 'speedKph' | 'latitude' | 'longitude'>, transaction: Transaction): Promise<void> {
  const activeTrip = await Trip.findOne({
    where: { vehicleId, endedAt: null },
    order: [['startedAt', 'DESC']],
    transaction
  });
  const moving = location.speedKph > MOVING_SPEED_KPH;

  if (!activeTrip) {
    if (!moving) return;
    const trip = await Trip.create({
      id: `trip-${crypto.randomUUID()}`,
      vehicleId,
      startedAt: location.occurredAt,
      endedAt: null,
      startLatitude: location.latitude,
      startLongitude: location.longitude,
      endLatitude: location.latitude,
      endLongitude: location.longitude,
      lastMovementAt: location.occurredAt,
      stoppedSince: null,
      distanceKm: 0
    }, { transaction });
    await addTripPoint(trip.id, location, transaction);
    return;
  }

  const additionalDistance = distanceKm(activeTrip.endLatitude, activeTrip.endLongitude, location.latitude, location.longitude);
  if (moving) {
    if (activeTrip.stoppedSince && location.occurredAt.getTime() - activeTrip.stoppedSince.getTime() >= STOP_CONFIRMATION_MS) {
      await activeTrip.update({ endedAt: activeTrip.stoppedSince }, { transaction });
      const trip = await Trip.create({
        id: `trip-${crypto.randomUUID()}`,
        vehicleId,
        startedAt: location.occurredAt,
        endedAt: null,
        startLatitude: location.latitude,
        startLongitude: location.longitude,
        endLatitude: location.latitude,
        endLongitude: location.longitude,
        lastMovementAt: location.occurredAt,
        stoppedSince: null,
        distanceKm: 0
      }, { transaction });
      await addTripPoint(trip.id, location, transaction);
      return;
    }
    await activeTrip.update({
      endLatitude: location.latitude,
      endLongitude: location.longitude,
      lastMovementAt: location.occurredAt,
      stoppedSince: null,
      distanceKm: activeTrip.distanceKm + additionalDistance
    }, { transaction });
    await addTripPoint(activeTrip.id, location, transaction);
    return;
  }

  const stoppedSince = activeTrip.stoppedSince ?? location.occurredAt;
  await activeTrip.update({
    endLatitude: location.latitude,
    endLongitude: location.longitude,
    stoppedSince,
    distanceKm: activeTrip.distanceKm + additionalDistance,
    endedAt: location.occurredAt.getTime() - stoppedSince.getTime() >= STOP_CONFIRMATION_MS ? stoppedSince : null
  }, { transaction });
  await addTripPoint(activeTrip.id, location, transaction);
}

function enqueueIngestion(task: () => Promise<void>): void {
  ingestionQueue = ingestionQueue.then(task, task).catch(error => {
    console.error('[Telematics] Queued ingestion failed:', error);
  });
}

export function sanitizeOutgoingTelematicsMessage(raw: string): string {
  return raw.replace(/(\D)(\d{6})(?=[ ;\r\n]|$)/, '$1••••••').trim();
}

export function sanitizeInboundTelematicsMessage(raw: string): string {
  return raw.replace(/(?<!\d)123456(?!\d)/g, '••••••').trim();
}

export async function persistTelematicsMessage(message: TelematicsMessage): Promise<void> {
  let vehicleId = message.vehicleId ?? null;
  let matchedDevice: Device | null = null;
  if (!vehicleId) {
    matchedDevice = await Device.findOne({ where: { serial: message.imei } });
    if (matchedDevice) {
      const assignment = await DeviceAssignment.findOne({ where: { deviceId: matchedDevice.id, unassignedAt: null } });
      vehicleId = assignment?.vehicleId ?? null;
    }
  }
  if (message.direction === 'INBOUND') {
    matchedDevice ??= await Device.findOne({ where: { serial: message.imei } });
    if (matchedDevice) await matchedDevice.update({ lastCommunicationAt: message.recordedAt });
  }
  await DeviceMessageLog.create({
    id: `device-message-${crypto.randomUUID()}`,
    vehicleId,
    imei: message.imei,
    actorId: message.actorId ?? null,
    direction: message.direction,
    kind: message.kind,
    raw: message.direction === 'OUTBOUND'
      ? sanitizeOutgoingTelematicsMessage(message.raw)
      : sanitizeInboundTelematicsMessage(message.raw),
    recordedAt: message.recordedAt
  });
}

export function subscribeToTelematicsStream(callback: SseSubscriber): () => void {
  sseSubscribers.add(callback);
  return () => {
    sseSubscribers.delete(callback);
  };
}

export function broadcastTelematicsEvent(type: string, payload: unknown): void {
  for (const subscriber of sseSubscribers) {
    try {
      subscriber({ type, payload });
    } catch {
      // Ignore subscriber errors
    }
  }
}

function getSeverityForAlarm(type: CobanAlarmType): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (type) {
    case 'SOS':
      return 'CRITICAL';
    case 'ACC_ALARM':
    case 'DOOR_ALARM':
    case 'SENSOR_ALARM':
      return 'HIGH';
    case 'POWER_OFF':
    case 'LOW_BATTERY':
    case 'FUEL_THEFT':
      return 'MEDIUM';
    case 'OVERSPEED':
    case 'MOVEMENT':
    default:
      return 'LOW';
  }
}

function getSummaryForAlarm(type: CobanAlarmType, vehicleName: string): string {
  switch (type) {
    case 'SOS':
      return `Emergency SOS panic button pressed on ${vehicleName}`;
    case 'ACC_ALARM':
      return `Unauthorized ignition detected while armed on ${vehicleName}`;
    case 'DOOR_ALARM':
      return `Door breach detected while armed on ${vehicleName}`;
    case 'SENSOR_ALARM':
      return `Vibration / impact sensor triggered on ${vehicleName}`;
    case 'POWER_OFF':
      return `External main battery disconnected from ${vehicleName} (running on backup battery)`;
    case 'LOW_BATTERY':
      return `Backup battery low (< 3.55V) on ${vehicleName}`;
    case 'FUEL_THEFT':
      return `Abnormal fuel drop or fuel theft detected on ${vehicleName}`;
    case 'OVERSPEED':
      return `Speed limit exceeded on ${vehicleName}`;
    case 'MOVEMENT':
      return `Unauthorized movement detected outside perimeter for ${vehicleName}`;
    default:
      return `Security alarm triggered on ${vehicleName}`;
  }
}

export async function processLocationUpdate(location: CobanLocationData): Promise<void> {
  const { imei } = location;

  try {
    // 1. Find or auto-provision Device
    let device = await Device.findOne({ where: { serial: imei } });
    if (!device) {
      // Find first customer org to assign custody to
      const vehicle = await Vehicle.findOne();
      const defaultOrgId = vehicle?.ownerOrganizationId || 'org-customer-logistics';

      device = await Device.create({
        id: `device-${crypto.randomUUID()}`,
        serial: imei,
        model: 'Coban GPS-303FG',
        radio: 'GSM/GPRS',
        custodyOrganizationId: defaultOrgId,
        status: 'ACTIVE',
        batteryPercent: 100,
        signalQuality: location.validFix ? 'GOOD' : 'FAIR',
        lastCommunicationAt: new Date()
      });
    }

    // 2. Find active Vehicle assignment
    const assignment = await DeviceAssignment.findOne({
      where: { deviceId: device.id, unassignedAt: null }
    });

    const now = new Date();

    if (!assignment) {
      // No vehicle assigned: just update the device status
      await device.update({
        lastCommunicationAt: now,
        signalQuality: location.validFix ? 'GOOD' : 'FAIR'
      });
      return;
    }

    const vehicle = await Vehicle.findByPk(assignment.vehicleId);
    if (!vehicle || vehicle.archivedAt) {
      return;
    }

    // A no-fix packet proves the device is online but must not replace the last
    // trustworthy point with zero or placeholder coordinates.
    if (!location.validFix) {
      await sequelize.transaction(async transaction => {
        await device!.update({ lastCommunicationAt: now, signalQuality: 'FAIR' }, { transaction });
        const state = {
          ignitionOn: location.ignitionOn,
          doorOpen: location.doorOpen,
          externalPower: location.externalPower,
          armed: location.armed,
          immobilized: location.immobilized,
          fuelPercent: location.fuelPercent ?? null,
          rawStatusMask: location.rawStatusMask ?? null,
          updatedAt: now
        };
        const existingState = await VehicleState.findByPk(vehicle.id, { transaction });
        if (existingState) await existingState.update(state, { transaction });
        else await VehicleState.create({ vehicleId: vehicle.id, ...state }, { transaction });
      });
      return;
    }

    // 3. Persist Telemetry Event & Update Latest Position inside a transaction
    await sequelize.transaction(async transaction => {
      const eventId = `telemetry-${crypto.randomUUID()}`;

      await TelemetryEvent.create({
        id: eventId,
        vehicleId: vehicle.id,
        latitude: location.latitude,
        longitude: location.longitude,
        speedKph: location.speedKph,
        heading: location.heading,
        occurredAt: location.occurredAt,
        ingestedAt: now,
        quality: location.validFix ? 'VALID' : 'COARSE',
        schemaVersion: 1,
        source: 'COBAN_303FG'
      }, { transaction });

      const existingPosition = await LatestPosition.findByPk(vehicle.id, { transaction });
      if (existingPosition) {
        await existingPosition.update({
          eventId,
          latitude: location.latitude,
          longitude: location.longitude,
          speedKph: location.speedKph,
          heading: location.heading,
          occurredAt: location.occurredAt,
          ingestedAt: now,
          quality: location.validFix ? 'VALID' : 'COARSE'
        }, { transaction });
      } else {
        await LatestPosition.create({
          vehicleId: vehicle.id,
          eventId,
          latitude: location.latitude,
          longitude: location.longitude,
          speedKph: location.speedKph,
          heading: location.heading,
          occurredAt: location.occurredAt,
          ingestedAt: now,
          quality: location.validFix ? 'VALID' : 'COARSE'
        }, { transaction });
      }

      const existingState = await VehicleState.findByPk(vehicle.id, { transaction });
      const state = {
        ignitionOn: location.ignitionOn,
        doorOpen: location.doorOpen,
        externalPower: location.externalPower,
        armed: location.armed,
        immobilized: location.immobilized,
        fuelPercent: location.fuelPercent ?? null,
        rawStatusMask: location.rawStatusMask ?? null,
        updatedAt: now
      };
      if (existingState) await existingState.update(state, { transaction });
      else await VehicleState.create({ vehicleId: vehicle.id, ...state }, { transaction });

      await updateTrip(vehicle.id, location, transaction);

      await device!.update({
        lastCommunicationAt: now,
        signalQuality: location.validFix ? 'GOOD' : 'FAIR'
      }, { transaction });
    });

    // 4. Broadcast live update to Web UI
    broadcastTelematicsEvent('location:update', {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      imei,
      latitude: location.latitude,
      longitude: location.longitude,
      speedKph: location.speedKph,
      heading: location.heading,
      occurredAt: location.occurredAt,
      lastCommunicationAt: now,
      ignitionOn: location.ignitionOn,
      doorOpen: location.doorOpen,
      externalPower: location.externalPower,
      armed: location.armed,
      immobilized: location.immobilized,
      fuelPercent: location.fuelPercent
    });

  } catch (error) {
    console.error(`[Telematics] Failed to ingest position for IMEI ${imei}:`, error);
  }
}

export async function processAlarmEvent(alarm: CobanAlarmData): Promise<void> {
  const { imei, alarmType } = alarm;

  try {
    // If the alarm packet contains location data, process position first
    if (alarm.location) {
      await processLocationUpdate(alarm.location);
    }

    const device = await Device.findOne({ where: { serial: imei } });
    if (!device) return;

    const assignment = await DeviceAssignment.findOne({
      where: { deviceId: device.id, unassignedAt: null }
    });
    if (!assignment) return;

    const vehicle = await Vehicle.findByPk(assignment.vehicleId);
    if (!vehicle) return;

    const alert = await Alert.create({
      id: `alert-${crypto.randomUUID()}`,
      organizationId: vehicle.ownerOrganizationId,
      vehicleId: vehicle.id,
      type: alarmType,
      severity: getSeverityForAlarm(alarmType),
      status: 'TRIGGERED',
      occurredAt: alarm.occurredAt,
      summary: getSummaryForAlarm(alarmType, vehicle.name)
    });

    broadcastTelematicsEvent('alarm:triggered', {
      alertId: alert.id,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      alarmType,
      severity: alert.severity,
      summary: alert.summary,
      occurredAt: alert.occurredAt
    });

  } catch (error) {
    console.error(`[Telematics] Failed to process alarm for IMEI ${imei}:`, error);
  }
}

export function initializeTelematicsIngestion(): void {
  telematicsSessions.on('message:logged', (message: TelematicsMessage) => {
    enqueueIngestion(() => persistTelematicsMessage(message));
  });

  telematicsSessions.on('telemetry:location', (location: CobanLocationData) => {
    enqueueIngestion(() => processLocationUpdate(location));
  });

  telematicsSessions.on('telemetry:alarm', (alarm: CobanAlarmData) => {
    enqueueIngestion(() => processAlarmEvent(alarm));
  });
}
