import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class OrganizationRetentionPolicy extends Model {
  declare organizationId: string;
  declare retentionPolicyId: string;
  declare assignedAt: Date;
  declare assignedBy: string | null;
}

OrganizationRetentionPolicy.init({
  organizationId: { type: DataTypes.STRING, primaryKey: true },
  retentionPolicyId: { type: DataTypes.STRING, allowNull: false },
  assignedAt: { type: DataTypes.DATE, allowNull: false },
  assignedBy: { type: DataTypes.STRING, allowNull: true }
}, {
  sequelize,
  modelName: 'OrganizationRetentionPolicy',
  tableName: 'organization_retention_policies',
  indexes: [{ fields: ['retention_policy_id'] }]
});
