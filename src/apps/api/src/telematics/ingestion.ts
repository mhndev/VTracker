import crypto from 'node:crypto';
import { sequelize } from '../database/connection.js';
import { Alert, Device, DeviceAssignment, LatestPosition, TelemetryEvent, Vehicle } from '../models/index.js';
import { telematicsSessions } from './session.js';
import type { CobanAlarmData, CobanAlarmType, CobanLocationData } from './types.js';

// Global Event Stream subscribers for SSE
type SseSubscriber = (event: { type: string; payload: unknown }) => void;
const sseSubscribers = new Set<SseSubscriber>();

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
  telematicsSessions.on('telemetry:location', (location: CobanLocationData) => {
    processLocationUpdate(location);
  });

  telematicsSessions.on('telemetry:alarm', (alarm: CobanAlarmData) => {
    processAlarmEvent(alarm);
  });
}
