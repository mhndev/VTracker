import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class ServiceRelationship extends Model {
  declare id: string;
  declare resellerOrganizationId: string;
  declare customerOrganizationId: string;
  declare status: string;
  declare startedAt: Date;
}
ServiceRelationship.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  resellerOrganizationId: { type: DataTypes.STRING, allowNull: false },
  customerOrganizationId: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  startedAt: { type: DataTypes.DATE, allowNull: false }
}, { sequelize, modelName: 'ServiceRelationship', tableName: 'service_relationships' });
