import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class Membership extends Model {
  declare id: string;
  declare userId: string;
  declare organizationId: string;
  declare role: string;
}
Membership.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  userId: { type: DataTypes.STRING, allowNull: false },
  organizationId: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false }
}, { sequelize, modelName: 'Membership', tableName: 'memberships', indexes: [{ unique: true, fields: ['user_id', 'organization_id'] }] });
