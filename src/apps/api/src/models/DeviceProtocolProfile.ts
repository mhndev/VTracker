import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class DeviceProtocolProfile extends Model {
  declare id: string;
  declare vendor: string;
  declare family: string;
  declare displayName: string;
  declare transport: string;
  declare frameFormat: string;
  declare implementationStatus: 'ACTIVE' | 'CATALOG_ONLY' | 'DISABLED';
  declare identificationStrategy: Record<string, unknown>;
  declare documentationUrl: string;
  declare notes: string | null;
}

DeviceProtocolProfile.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  vendor: { type: DataTypes.STRING, allowNull: false },
  family: { type: DataTypes.STRING, allowNull: false },
  displayName: { type: DataTypes.STRING, allowNull: false },
  transport: { type: DataTypes.STRING, allowNull: false },
  frameFormat: { type: DataTypes.STRING, allowNull: false },
  implementationStatus: { type: DataTypes.STRING, allowNull: false },
  identificationStrategy: { type: DataTypes.JSON, allowNull: false },
  documentationUrl: { type: DataTypes.STRING, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true }
}, {
  sequelize,
  modelName: 'DeviceProtocolProfile',
  tableName: 'device_protocol_profiles',
  indexes: [{ unique: true, fields: ['vendor', 'family'] }]
});
