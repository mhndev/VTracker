import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class DeviceMessageDefinition extends Model {
  declare id: string;
  declare protocolProfileId: string;
  declare messageType: string;
  declare displayName: string;
  declare direction: 'UPLINK' | 'DOWNLINK' | 'BIDIRECTIONAL';
  declare description: string;
  declare matcher: Record<string, unknown>;
  declare fieldSchema: Array<Record<string, unknown>>;
  declare example: string | null;
}

DeviceMessageDefinition.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  protocolProfileId: { type: DataTypes.STRING, allowNull: false },
  messageType: { type: DataTypes.STRING, allowNull: false },
  displayName: { type: DataTypes.STRING, allowNull: false },
  direction: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  matcher: { type: DataTypes.JSON, allowNull: false },
  fieldSchema: { type: DataTypes.JSON, allowNull: false },
  example: { type: DataTypes.TEXT, allowNull: true }
}, {
  sequelize,
  modelName: 'DeviceMessageDefinition',
  tableName: 'device_message_definitions',
  indexes: [{ unique: true, fields: ['protocol_profile_id', 'message_type'] }]
});
