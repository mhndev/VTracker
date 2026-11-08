import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class DeviceProtocolBinding extends Model {
  declare imei: string;
  declare deviceId: string | null;
  declare protocolProfileId: string;
  declare detectedModel: string | null;
  declare firmwareVersion: string | null;
  declare protocolVersion: string | null;
  declare variantVersion: string | null;
  declare confidence: number;
  declare evidence: Record<string, unknown>;
  declare identifiedAt: Date;
  declare lastSeenAt: Date;
  declare lastQueriedAt: Date | null;
}

DeviceProtocolBinding.init({
  imei: { type: DataTypes.STRING, primaryKey: true },
  deviceId: { type: DataTypes.STRING, allowNull: true },
  protocolProfileId: { type: DataTypes.STRING, allowNull: false },
  detectedModel: { type: DataTypes.STRING, allowNull: true },
  firmwareVersion: { type: DataTypes.STRING, allowNull: true },
  protocolVersion: { type: DataTypes.STRING, allowNull: true },
  variantVersion: { type: DataTypes.STRING, allowNull: true },
  confidence: { type: DataTypes.FLOAT, allowNull: false },
  evidence: { type: DataTypes.JSON, allowNull: false },
  identifiedAt: { type: DataTypes.DATE, allowNull: false },
  lastSeenAt: { type: DataTypes.DATE, allowNull: false },
  lastQueriedAt: { type: DataTypes.DATE, allowNull: true }
}, {
  sequelize,
  modelName: 'DeviceProtocolBinding',
  tableName: 'device_protocol_bindings',
  indexes: [
    { fields: ['device_id'] },
    { fields: ['protocol_profile_id'] }
  ]
});
