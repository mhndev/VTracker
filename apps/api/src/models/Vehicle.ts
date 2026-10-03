import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class Vehicle extends Model {
  declare id: string;
  declare ownerOrganizationId: string;
  declare name: string;
  declare plate: string;
  declare kind: string;
}
Vehicle.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  ownerOrganizationId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  plate: { type: DataTypes.STRING, allowNull: false },
  kind: { type: DataTypes.STRING, allowNull: false }
}, { sequelize, modelName: 'Vehicle', tableName: 'vehicles', indexes: [{ fields: ['owner_organization_id'] }] });
