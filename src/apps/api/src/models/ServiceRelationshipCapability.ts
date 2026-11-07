import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';
import { DELEGATED_CAPABILITIES, type DelegatedCapability } from '../contracts/provisioning.contracts.js';

export class ServiceRelationshipCapability extends Model {
  declare id: string;
  declare serviceRelationshipId: string;
  declare capability: DelegatedCapability;
  declare grantedAt: Date;
  declare grantedBy: string;
  declare revokedAt: Date | null;
  declare revokedBy: string | null;
}

ServiceRelationshipCapability.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  serviceRelationshipId: { type: DataTypes.STRING, allowNull: false },
  capability: { type: DataTypes.ENUM(...DELEGATED_CAPABILITIES), allowNull: false },
  grantedAt: { type: DataTypes.DATE, allowNull: false },
  grantedBy: { type: DataTypes.STRING, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
  revokedBy: { type: DataTypes.STRING, allowNull: true }
}, {
  sequelize,
  modelName: 'ServiceRelationshipCapability',
  tableName: 'service_relationship_capabilities',
  indexes: [
    { unique: true, fields: ['service_relationship_id', 'capability'] },
    { fields: ['capability', 'revoked_at'] }
  ]
});
