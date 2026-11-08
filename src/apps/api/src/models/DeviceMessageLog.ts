import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class DeviceMessageLog extends Model {
  declare id: string;
  declare vehicleId: string | null;
  declare imei: string;
  declare actorId: string | null;
  declare direction: 'INBOUND' | 'OUTBOUND';
  declare kind: string;
  declare raw: string;
  declare recordedAt: Date;
}

DeviceMessageLog.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  vehicleId: { type: DataTypes.STRING, allowNull: true },
  imei: { type: DataTypes.STRING, allowNull: false },
  actorId: { type: DataTypes.STRING, allowNull: true },
  direction: { type: DataTypes.STRING, allowNull: false },
  kind: { type: DataTypes.STRING, allowNull: false },
  raw: { type: DataTypes.TEXT, allowNull: false },
  recordedAt: { type: DataTypes.DATE, allowNull: false }
}, {
  sequelize,
  modelName: 'DeviceMessageLog',
  tableName: 'device_message_logs',
  indexes: [
    { fields: ['imei', 'recorded_at'] },
    { fields: ['vehicle_id', 'recorded_at'] }
  ]
});
