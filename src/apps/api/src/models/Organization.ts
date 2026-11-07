import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';
import type { OrganizationLifecycle } from '../contracts/provisioning.contracts.js';

export type OrganizationType = 'PLATFORM' | 'RESELLER' | 'CUSTOMER';
export type SupportedLocale = 'en' | 'fa';
export class Organization extends Model {
  declare id: string;
  declare name: string;
  declare type: OrganizationType;
  declare defaultLocale: SupportedLocale;
  declare timezone: string;
  declare status: OrganizationLifecycle;
}
Organization.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('PLATFORM', 'RESELLER', 'CUSTOMER'), allowNull: false },
  defaultLocale: { type: DataTypes.ENUM('en', 'fa'), allowNull: false, defaultValue: 'en' },
  timezone: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Europe/Berlin' },
  status: { type: DataTypes.ENUM('ACTIVE', 'SUSPENDED'), allowNull: false, defaultValue: 'ACTIVE' }
}, { sequelize, modelName: 'Organization', tableName: 'organizations' });
