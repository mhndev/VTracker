import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class DeviceAssignment extends Model {
  declare id: string;
  declare deviceId: string;
  declare vehicleId: string;
  declare assignedAt: Date;
  declare unassignedAt: Date | null;
}
DeviceAssignment.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  deviceId: { type: DataTypes.STRING, allowNull: false },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  assignedAt: { type: DataTypes.DATE, allowNull: false },
  unassignedAt: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, modelName: 'DeviceAssignment', tableName: 'device_assignments', indexes: [{ fields: ['vehicle_id', 'unassigned_at'] }] });
