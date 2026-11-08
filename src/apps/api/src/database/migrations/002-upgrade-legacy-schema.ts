import { DataTypes, type ModelAttributeColumnOptions, type QueryInterface } from 'sequelize';

async function addMissingColumn(query: QueryInterface, table: string, column: string, definition: ModelAttributeColumnOptions): Promise<void> {
  const columns = await query.describeTable(table);
  if (!columns[column]) await query.addColumn(table, column, definition);
}

export async function up({ context: query }: { context: QueryInterface }): Promise<void> {
  await addMissingColumn(query, 'organizations', 'default_locale', { type: DataTypes.STRING, allowNull: false, defaultValue: 'en' });
  await addMissingColumn(query, 'organizations', 'timezone', { type: DataTypes.STRING, allowNull: false, defaultValue: 'Europe/Berlin' });
  await addMissingColumn(query, 'organizations', 'status', { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' });
  await addMissingColumn(query, 'vehicles', 'marker_style', { type: DataTypes.STRING, allowNull: false, defaultValue: 'DOT' });
  await addMissingColumn(query, 'vehicles', 'marker_color', { type: DataTypes.STRING, allowNull: false, defaultValue: 'BLUE' });
  await addMissingColumn(query, 'vehicles', 'marker_size', { type: DataTypes.STRING, allowNull: false, defaultValue: 'MEDIUM' });
  const migratedAt = new Date();
  await addMissingColumn(query, 'vehicles', 'created_at', { type: DataTypes.DATE, allowNull: false, defaultValue: migratedAt });
  await addMissingColumn(query, 'vehicles', 'updated_at', { type: DataTypes.DATE, allowNull: false, defaultValue: migratedAt });
  await addMissingColumn(query, 'vehicles', 'archived_at', { type: DataTypes.DATE, allowNull: true });

  const vehicleIndexes = await query.showIndex('vehicles') as unknown as Array<{ name: string }>;
  if (!vehicleIndexes.some(index => index.name === 'vehicles_owner_organization_id_archived_at')) {
    await query.addIndex('vehicles', ['owner_organization_id', 'archived_at'], { name: 'vehicles_owner_organization_id_archived_at' });
  }
}

export async function down(): Promise<void> {
  // Compatibility upgrades are intentionally irreversible: on a fresh database
  // these columns belong to 001, while on a legacy database they may contain data.
}
