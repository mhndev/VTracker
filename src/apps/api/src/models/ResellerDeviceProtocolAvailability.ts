import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class ResellerDeviceProtocolAvailability extends Model {
  declare id: string;
  declare resellerOrganizationId: string;
  declare protocolProfileId: string;
  declare available: boolean;
  declare updatedAt: Date;
  declare updatedBy: string | null;
}

ResellerDeviceProtocolAvailability.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  resellerOrganizationId: { type: DataTypes.STRING, allowNull: false },
  protocolProfileId: { type: DataTypes.STRING, allowNull: false },
  available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
  updatedBy: { type: DataTypes.STRING, allowNull: true }
}, {
  sequelize,
  modelName: 'ResellerDeviceProtocolAvailability',
  tableName: 'reseller_device_protocol_availability',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['reseller_organization_id', 'protocol_profile_id'] },
    { fields: ['protocol_profile_id', 'available'] }
  ]
});
