import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class Device extends Model {
  declare id: string;
  declare serial: string;
  declare model: string;
  declare radio: string;
  declare custodyOrganizationId: string;
  declare status: string;
  declare batteryPercent: number;
  declare signalQuality: string;
  declare lastCommunicationAt: Date;
}
Device.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  serial: { type: DataTypes.STRING, allowNull: false, unique: true },
  model: { type: DataTypes.STRING, allowNull: false },
  radio: { type: DataTypes.STRING, allowNull: false },
  custodyOrganizationId: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  batteryPercent: { type: DataTypes.INTEGER, allowNull: false },
  signalQuality: { type: DataTypes.STRING, allowNull: false },
  lastCommunicationAt: { type: DataTypes.DATE, allowNull: false }
}, { sequelize, modelName: 'Device', tableName: 'devices', indexes: [{ fields: ['custody_organization_id'] }] });
