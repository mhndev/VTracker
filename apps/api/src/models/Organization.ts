import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export type OrganizationType = 'PLATFORM' | 'RESELLER' | 'CUSTOMER';
export class Organization extends Model {
  declare id: string;
  declare name: string;
  declare type: OrganizationType;
}
Organization.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('PLATFORM', 'RESELLER', 'CUSTOMER'), allowNull: false }
}, { sequelize, modelName: 'Organization', tableName: 'organizations' });
