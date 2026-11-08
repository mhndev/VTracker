import type { QueryInterface } from 'sequelize';

const mappings = [
  ['seed-message-1', 'device-1', 'vehicle-1'], ['seed-message-2', 'device-2', 'vehicle-2'],
  ['seed-message-3', 'device-3', 'vehicle-3'], ['seed-message-4', 'device-4', 'vehicle-4'],
  ['seed-message-5', 'device-5', 'vehicle-private'], ['seed-message-6', 'device-6', null]
] as const;

export async function up({ context: query }: { context: QueryInterface }): Promise<void> {
  const [deviceResult, messageResult] = await Promise.all([
    query.sequelize.query('SELECT id, serial, last_communication_at FROM devices'),
    query.sequelize.query("SELECT id FROM device_message_logs WHERE id LIKE 'seed-message-%'")
  ]);
  const devices = deviceResult[0] as Array<{ id: string; serial: string; last_communication_at: Date }>;
  const existingMessages = messageResult[0] as Array<{ id: string }>;
  const existingIds = new Set(existingMessages.map(message => message.id));
  const byId = new Map((devices as Array<{ id: string; serial: string; last_communication_at: Date }>).map(device => [device.id, device]));
  const rows = mappings.flatMap(([id, deviceId, vehicleId]) => {
    const device = byId.get(deviceId);
    if (!device || existingIds.has(id)) return [];
    return [{ id, vehicle_id: vehicleId, imei: device.serial, actor_id: null, direction: 'INBOUND', kind: vehicleId ? 'LOCATION' : 'HEARTBEAT', raw: `seeded check-in from ${device.serial}`, recorded_at: device.last_communication_at }];
  });
  if (rows.length) await query.bulkInsert('device_message_logs', rows);
}

export async function down({ context: query }: { context: QueryInterface }): Promise<void> {
  await query.bulkDelete('device_message_logs', { id: mappings.map(([id]) => id) });
}
