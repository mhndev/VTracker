import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class Vehicle extends Model {
  declare id: string;
  declare ownerOrganizationId: string;
  declare name: string;
  declare plate: string;
  declare kind: string;
  declare markerStyle: string;
  declare markerColor: string;
  declare markerSize: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare archivedAt: Date | null;
}
Vehicle.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  ownerOrganizationId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  plate: { type: DataTypes.STRING, allowNull: false },
  kind: { type: DataTypes.STRING, allowNull: false },
  markerStyle: { type: DataTypes.STRING, allowNull: false, defaultValue: 'DOT' },
  markerColor: { type: DataTypes.STRING, allowNull: false, defaultValue: 'BLUE' },
  markerSize: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MEDIUM' },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  archivedAt: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, modelName: 'Vehicle', tableName: 'vehicles', indexes: [{ fields: ['owner_organization_id'] }, { fields: ['owner_organization_id', 'archived_at'] }, { unique: true, fields: ['owner_organization_id', 'plate'], name: 'vehicles_org_plate_unique' }] });
