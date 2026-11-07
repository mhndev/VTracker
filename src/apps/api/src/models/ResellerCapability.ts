import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';
import { DELEGATED_CAPABILITIES, type DelegatedCapability } from '../contracts/provisioning.contracts.js';

export class ResellerCapability extends Model {
  declare id: string;
  declare resellerOrganizationId: string;
  declare capability: DelegatedCapability;
  declare grantedAt: Date;
  declare grantedBy: string;
}

ResellerCapability.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  resellerOrganizationId: { type: DataTypes.STRING, allowNull: false },
  capability: { type: DataTypes.ENUM(...DELEGATED_CAPABILITIES), allowNull: false },
  grantedAt: { type: DataTypes.DATE, allowNull: false },
  grantedBy: { type: DataTypes.STRING, allowNull: false }
}, {
  sequelize,
  modelName: 'ResellerCapability',
  tableName: 'reseller_capabilities',
  indexes: [
    { unique: true, fields: ['reseller_organization_id', 'capability'] },
    { fields: ['capability'] }
  ]
});
