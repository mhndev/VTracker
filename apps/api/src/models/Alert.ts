import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class Alert extends Model {
  declare id: string;
  declare organizationId: string;
  declare vehicleId: string;
  declare type: string;
  declare severity: string;
  declare status: string;
  declare occurredAt: Date;
  declare summary: string;
}
Alert.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  organizationId: { type: DataTypes.STRING, allowNull: false },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  severity: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false },
  summary: { type: DataTypes.STRING, allowNull: false }
}, { sequelize, modelName: 'Alert', tableName: 'alerts', indexes: [{ fields: ['organization_id', 'status'] }] });
