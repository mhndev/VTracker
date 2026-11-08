import { Op } from 'sequelize';
import { Device, DeviceMessageLog, Organization, OrganizationRetentionPolicy, RetentionPolicy, TelemetryEvent, Vehicle } from '../models/index.js';
import { HttpError } from '../utils/errors.js';
import { hasPlatformRole } from './policy.service.js';

const DAY_MS = 24 * 60 * 60_000;

export async function getRetentionCapacity(actorId: string) {
  if (!await hasPlatformRole(actorId)) throw new HttpError(403, 'PLATFORM_ADMIN_REQUIRED', 'Retention configuration is restricted to platform administrators.');
  const [policies, assignments, customers, vehicles] = await Promise.all([
    RetentionPolicy.findAll({ order: [['logRetentionDays', 'ASC']] }),
    OrganizationRetentionPolicy.findAll(),
    Organization.findAll({ where: { type: 'CUSTOMER' } }),
    Vehicle.findAll()
  ]);
  const policyByOrganization = new Map(assignments.map(item => [item.organizationId, item.retentionPolicyId]));
  return policies.map(policy => {
    const subscribers = customers.filter(customer => policyByOrganization.get(customer.id) === policy.id);
    const subscriberIds = new Set(subscribers.map(customer => customer.id));
    const vehicleCount = vehicles.filter(vehicle => subscriberIds.has(vehicle.ownerOrganizationId)).length;
    const dailyLogBytesPerVehicle = policy.estimatedMessagesPerVehiclePerDay * policy.averageMessageBytes
      + policy.estimatedTelemetryEventsPerVehiclePerDay * policy.averageTelemetryEventBytes;
    const retainedLogBytesPerVehicle = dailyLogBytesPerVehicle * policy.logRetentionDays;
    const monthlyTripGrowthBytesPerVehicle = policy.estimatedTripsPerVehiclePerDay * 30 * policy.maxPointsPerTrip * policy.averageTripPointBytes;
    return {
      ...policy.get(),
      subscribers: subscribers.length,
      vehicles: vehicleCount,
      estimatedRetainedLogBytesPerVehicle: retainedLogBytesPerVehicle,
      estimatedRetainedLogBytes: retainedLogBytesPerVehicle * vehicleCount,
      estimatedMonthlyTripGrowthBytesPerVehicle: monthlyTripGrowthBytesPerVehicle,
      estimatedMonthlyTripGrowthBytes: monthlyTripGrowthBytesPerVehicle * vehicleCount
    };
  });
}

export async function assignRetentionPolicy(actorId: string, organizationId: string, retentionPolicyId: string) {
  if (!await hasPlatformRole(actorId)) throw new HttpError(403, 'PLATFORM_ADMIN_REQUIRED', 'Retention configuration is restricted to platform administrators.');
  const [organization, policy] = await Promise.all([
    Organization.findOne({ where: { id: organizationId, type: 'CUSTOMER' } }),
    RetentionPolicy.findByPk(retentionPolicyId)
  ]);
  if (!organization || !policy) throw new HttpError(400, 'INVALID_RETENTION_ASSIGNMENT', 'Select a customer organization and a configured retention policy.');
  const [assignment] = await OrganizationRetentionPolicy.upsert({ organizationId, retentionPolicyId, assignedAt: new Date(), assignedBy: actorId }, { returning: true });
  return { ...assignment.get(), policy: policy.get() };
}

export async function evictExpiredLogs(now = new Date()) {
  const [customers, assignments, policies, vehicles, devices] = await Promise.all([
    Organization.findAll({ where: { type: 'CUSTOMER' } }),
    OrganizationRetentionPolicy.findAll(),
    RetentionPolicy.findAll(),
    Vehicle.findAll(),
    Device.findAll()
  ]);
  const assignmentByOrganization = new Map(assignments.map(item => [item.organizationId, item.retentionPolicyId]));
  const policyById = new Map(policies.map(item => [item.id, item]));
  let deletedMessages = 0;
  let deletedTelemetryEvents = 0;

  for (const customer of customers) {
    const policy = policyById.get(assignmentByOrganization.get(customer.id) ?? 'retention-1-month');
    if (!policy) continue;
    const cutoff = new Date(now.getTime() - policy.logRetentionDays * DAY_MS);
    const vehicleIds = vehicles.filter(vehicle => vehicle.ownerOrganizationId === customer.id).map(vehicle => vehicle.id);
    const serials = devices.filter(device => device.custodyOrganizationId === customer.id).map(device => device.serial);
    if (vehicleIds.length || serials.length) {
      deletedMessages += await DeviceMessageLog.destroy({
        where: {
          recordedAt: { [Op.lt]: cutoff },
          [Op.or]: [
            ...(vehicleIds.length ? [{ vehicleId: { [Op.in]: vehicleIds } }] : []),
            ...(serials.length ? [{ vehicleId: null, imei: { [Op.in]: serials } }] : [])
          ]
        }
      });
    }
    if (vehicleIds.length) {
      deletedTelemetryEvents += await TelemetryEvent.destroy({ where: { vehicleId: { [Op.in]: vehicleIds }, occurredAt: { [Op.lt]: cutoff } } });
    }
  }
  return { deletedMessages, deletedTelemetryEvents, ranAt: now };
}

export function startRetentionScheduler(): () => void {
  const run = () => void evictExpiredLogs().then(result => {
    console.log(`[Retention] Removed ${result.deletedMessages} device messages and ${result.deletedTelemetryEvents} telemetry events.`);
  }).catch(error => console.error('[Retention] Daily eviction failed:', error));
  run();
  const interval = setInterval(run, DAY_MS);
  interval.unref();
  return () => clearInterval(interval);
}
