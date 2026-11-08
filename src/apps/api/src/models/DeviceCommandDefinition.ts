import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class DeviceCommandDefinition extends Model {
  declare id: string;
  declare protocolProfileId: string;
  declare commandKey: string;
  declare displayName: string;
  declare description: string;
  declare wireTemplate: string | null;
  declare responseMatcher: Record<string, unknown>;
  declare optionsSchema: Record<string, unknown>;
  declare riskLevel: 'READ_ONLY' | 'CONFIGURATION' | 'HIGH_RISK';
  declare implementationStatus: 'ACTIVE' | 'CATALOG_ONLY' | 'DISABLED';
}

DeviceCommandDefinition.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  protocolProfileId: { type: DataTypes.STRING, allowNull: false },
  commandKey: { type: DataTypes.STRING, allowNull: false },
  displayName: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  wireTemplate: { type: DataTypes.TEXT, allowNull: true },
  responseMatcher: { type: DataTypes.JSON, allowNull: false },
  optionsSchema: { type: DataTypes.JSON, allowNull: false },
  riskLevel: { type: DataTypes.STRING, allowNull: false },
  implementationStatus: { type: DataTypes.STRING, allowNull: false }
}, {
  sequelize,
  modelName: 'DeviceCommandDefinition',
  tableName: 'device_command_definitions',
  indexes: [{ unique: true, fields: ['protocol_profile_id', 'command_key'] }]
});
