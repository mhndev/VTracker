import { DataTypes, Sequelize, type QueryInterface } from 'sequelize';

const id = () => ({ type: DataTypes.STRING, allowNull: false, primaryKey: true });
const string = (allowNull = false) => ({ type: DataTypes.STRING, allowNull });
const date = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });
const integer = (allowNull = false) => ({ type: DataTypes.INTEGER, allowNull });
const float = (allowNull = false) => ({ type: DataTypes.FLOAT, allowNull });
const boolean = (allowNull = false) => ({ type: DataTypes.BOOLEAN, allowNull });
const json = (allowNull = false) => ({ type: DataTypes.JSON, allowNull });
const fk = (model: string, allowNull = false) => ({ ...string(allowNull), references: { model, key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' });

async function indexes(query: QueryInterface, table: string, definitions: Array<{ fields: string[]; name?: string; unique?: boolean; where?: Record<string, unknown> }>) {
  const existingIndexes = await query.showIndex(table) as unknown as Array<{ name: string }>;
  const existing = new Set(existingIndexes.map(index => index.name));
  const columns = await query.describeTable(table);
  for (const definition of definitions) {
    const name = definition.name ?? `${table}_${definition.fields.join('_')}`;
    if (!existing.has(name) && definition.fields.every(field => columns[field])) await query.addIndex(table, { ...definition, name });
  }
}

export async function up({ context: query }: { context: QueryInterface }): Promise<void> {
  const existingTables = new Set((await query.showAllTables()).map(table => String(table).toLowerCase()));
  const createTable = query.createTable.bind(query);
  query.createTable = (async (tableName, attributes, options) => {
    const normalized = String(tableName).toLowerCase();
    if (existingTables.has(normalized)) return;
    await createTable(tableName, attributes, options);
    existingTables.add(normalized);
  }) as typeof query.createTable;
  await query.createTable('organizations', {
    id: id(), name: string(), type: string(), default_locale: { ...string(), defaultValue: 'en' },
    timezone: { ...string(), defaultValue: 'Europe/Berlin' }, status: { ...string(), defaultValue: 'ACTIVE' }
  });
  await query.createTable('users', { id: id(), name: string(), email: { ...string(), unique: true } });
  await query.createTable('retention_policies', {
    id: id(), name: { ...string(), unique: true }, log_retention_days: integer(), estimated_messages_per_vehicle_per_day: integer(),
    average_message_bytes: integer(), estimated_telemetry_events_per_vehicle_per_day: integer(), average_telemetry_event_bytes: integer(),
    estimated_trips_per_vehicle_per_day: float(), max_points_per_trip: integer(), average_trip_point_bytes: integer()
  });
  await query.createTable('device_protocol_profiles', {
    id: id(), vendor: string(), family: string(), display_name: string(), transport: string(), frame_format: string(),
    implementation_status: string(), identification_strategy: json(), documentation_url: string(), notes: { type: DataTypes.TEXT, allowNull: true }
  });
  await query.createTable('vehicles', {
    id: id(), owner_organization_id: fk('organizations'), name: string(), plate: string(), kind: string(),
    marker_style: { ...string(), defaultValue: 'DOT' }, marker_color: { ...string(), defaultValue: 'BLUE' }, marker_size: { ...string(), defaultValue: 'MEDIUM' },
    created_at: { ...date(), defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }, updated_at: { ...date(), defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }, archived_at: date(true)
  });
  await query.createTable('devices', {
    id: id(), serial: { ...string(), unique: true }, model: string(), radio: string(), custody_organization_id: fk('organizations'),
    status: string(), battery_percent: integer(), signal_quality: string(), last_communication_at: date()
  });
  await query.createTable('memberships', { id: id(), user_id: fk('users'), organization_id: fk('organizations'), role: string() });
  await query.createTable('service_relationships', {
    id: id(), reseller_organization_id: fk('organizations'), customer_organization_id: fk('organizations'), status: string(), started_at: date()
  });
  await query.createTable('reseller_capabilities', {
    id: id(), reseller_organization_id: fk('organizations'), capability: string(), granted_at: date(), granted_by: string()
  });
  await query.createTable('organization_retention_policies', {
    organization_id: { ...fk('organizations'), primaryKey: true }, retention_policy_id: fk('retention_policies'), assigned_at: date(), assigned_by: string(true)
  });
  await query.createTable('device_assignments', {
    id: id(), device_id: fk('devices'), vehicle_id: fk('vehicles'), assigned_at: date(), unassigned_at: date(true)
  });
  await query.createTable('device_message_logs', {
    id: id(), vehicle_id: fk('vehicles', true), imei: string(), actor_id: string(true), direction: string(), kind: string(),
    raw: { type: DataTypes.TEXT, allowNull: false }, recorded_at: date()
  });
  await query.createTable('device_protocol_bindings', {
    imei: id(), device_id: fk('devices', true), protocol_profile_id: fk('device_protocol_profiles'), detected_model: string(true),
    firmware_version: string(true), protocol_version: string(true), variant_version: string(true), confidence: float(), evidence: json(),
    identified_at: date(), last_seen_at: date(), last_queried_at: date(true)
  });
  await query.createTable('device_message_definitions', {
    id: id(), protocol_profile_id: fk('device_protocol_profiles'), message_type: string(), display_name: string(), direction: string(),
    description: { type: DataTypes.TEXT, allowNull: false }, matcher: json(), field_schema: json(), example: { type: DataTypes.TEXT, allowNull: true }
  });
  await query.createTable('device_command_definitions', {
    id: id(), protocol_profile_id: fk('device_protocol_profiles'), command_key: string(), display_name: string(),
    description: { type: DataTypes.TEXT, allowNull: false }, wire_template: { type: DataTypes.TEXT, allowNull: true }, response_matcher: json(),
    options_schema: json(), risk_level: string(), implementation_status: string()
  });
  await query.createTable('reseller_device_protocol_availability', {
    id: id(), reseller_organization_id: fk('organizations'), protocol_profile_id: fk('device_protocol_profiles'),
    available: { ...boolean(), defaultValue: false }, updated_at: date(), updated_by: string(true)
  });
  await query.createTable('telemetry_events', {
    id: id(), vehicle_id: fk('vehicles'), latitude: float(), longitude: float(), speed_kph: float(), heading: float(), occurred_at: date(),
    ingested_at: date(), quality: string(), schema_version: integer(), source: string()
  });
  await query.createTable('latest_positions', {
    vehicle_id: { ...fk('vehicles'), primaryKey: true }, event_id: { ...string(), unique: true }, latitude: float(), longitude: float(),
    speed_kph: float(), heading: float(), occurred_at: date(), ingested_at: date(), quality: string()
  });
  await query.createTable('vehicle_states', {
    vehicle_id: { ...fk('vehicles'), primaryKey: true }, ignition_on: boolean(), door_open: boolean(), external_power: boolean(), armed: boolean(),
    immobilized: boolean(), fuel_percent: float(true), raw_status_mask: string(true), updated_at: date()
  });
  await query.createTable('trips', {
    id: id(), vehicle_id: fk('vehicles'), started_at: date(), ended_at: date(true), start_latitude: float(), start_longitude: float(),
    end_latitude: float(), end_longitude: float(), last_movement_at: date(), stopped_since: date(true), distance_km: { ...float(), defaultValue: 0 }
  });
  await query.createTable('trip_points', {
    trip_id: { ...fk('trips'), primaryKey: true }, slot: { ...integer(), primaryKey: true }, latitude: float(), longitude: float(), occurred_at: date()
  });
  await query.createTable('alerts', {
    id: id(), organization_id: fk('organizations'), vehicle_id: fk('vehicles'), type: string(), severity: string(), status: string(), occurred_at: date(), summary: string()
  });
  await query.createTable('access_grants', {
    id: id(), vehicle_id: fk('vehicles'), grantee_organization_id: fk('organizations'), permission: string(), purpose: string(),
    created_by: string(), created_at: date(), expires_at: date(), revoked_at: date(true)
  });
  await query.createTable('audit_events', {
    id: id(), actor_id: fk('users'), action: string(), resource_type: string(), resource_id: string(), outcome: string(), occurred_at: date(),
    details: { ...json(), defaultValue: {} }
  });
  await query.createTable('service_relationship_capabilities', {
    id: id(), service_relationship_id: fk('service_relationships'), capability: string(), granted_at: date(), granted_by: string(),
    revoked_at: date(true), revoked_by: string(true)
  });

  await indexes(query, 'vehicles', [{ fields: ['owner_organization_id'] }, { fields: ['owner_organization_id', 'archived_at'] }, { fields: ['owner_organization_id', 'plate'], unique: true, name: 'vehicles_org_plate_unique' }]);
  await indexes(query, 'devices', [{ fields: ['custody_organization_id'] }]);
  await indexes(query, 'memberships', [{ fields: ['user_id', 'organization_id'], unique: true }]);
  await indexes(query, 'reseller_capabilities', [{ fields: ['reseller_organization_id', 'capability'], unique: true }, { fields: ['capability'] }]);
  await indexes(query, 'organization_retention_policies', [{ fields: ['retention_policy_id'] }]);
  await indexes(query, 'device_assignments', [
    { fields: ['vehicle_id', 'unassigned_at'] }, { fields: ['device_id', 'unassigned_at'] },
    { fields: ['vehicle_id'], unique: true, where: { unassigned_at: null }, name: 'device_assignments_active_vehicle_unique' },
    { fields: ['device_id'], unique: true, where: { unassigned_at: null }, name: 'device_assignments_active_device_unique' }
  ]);
  await indexes(query, 'device_message_logs', [{ fields: ['imei', 'recorded_at'] }, { fields: ['vehicle_id', 'recorded_at'] }]);
  await indexes(query, 'device_protocol_profiles', [{ fields: ['vendor', 'family'], unique: true }]);
  await indexes(query, 'device_protocol_bindings', [{ fields: ['device_id'] }, { fields: ['protocol_profile_id'] }]);
  await indexes(query, 'device_message_definitions', [{ fields: ['protocol_profile_id', 'message_type'], unique: true }]);
  await indexes(query, 'device_command_definitions', [{ fields: ['protocol_profile_id', 'command_key'], unique: true }]);
  await indexes(query, 'reseller_device_protocol_availability', [{ fields: ['reseller_organization_id', 'protocol_profile_id'], unique: true }, { fields: ['protocol_profile_id', 'available'] }]);
  await indexes(query, 'telemetry_events', [{ fields: ['vehicle_id', 'occurred_at'] }]);
  await indexes(query, 'trips', [{ fields: ['vehicle_id', 'started_at'] }, { fields: ['vehicle_id', 'ended_at'] }]);
  await indexes(query, 'trip_points', [{ fields: ['trip_id', 'occurred_at'] }]);
  await indexes(query, 'alerts', [{ fields: ['organization_id', 'status'] }]);
  await indexes(query, 'access_grants', [{ fields: ['vehicle_id', 'grantee_organization_id', 'permission'] }]);
  await indexes(query, 'audit_events', [{ fields: ['resource_id', 'occurred_at'] }]);
  await indexes(query, 'service_relationship_capabilities', [{ fields: ['service_relationship_id', 'capability'], unique: true }, { fields: ['capability', 'revoked_at'] }]);
  query.createTable = createTable;
}

export async function down({ context: query }: { context: QueryInterface }): Promise<void> {
  for (const table of [
    'service_relationship_capabilities', 'audit_events', 'access_grants', 'alerts', 'trip_points', 'trips', 'vehicle_states',
    'latest_positions', 'telemetry_events', 'reseller_device_protocol_availability', 'device_command_definitions',
    'device_message_definitions', 'device_protocol_bindings', 'device_message_logs', 'device_assignments',
    'organization_retention_policies', 'reseller_capabilities', 'service_relationships', 'memberships', 'devices', 'vehicles',
    'device_protocol_profiles', 'retention_policies', 'users', 'organizations'
  ]) await query.dropTable(table);
}
