import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class AccessGrant extends Model {
  declare id: string;
  declare vehicleId: string;
  declare granteeOrganizationId: string;
  declare permission: string;
  declare purpose: string;
  declare createdBy: string;
  declare createdAt: Date;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
}
AccessGrant.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  granteeOrganizationId: { type: DataTypes.STRING, allowNull: false },
  permission: { type: DataTypes.STRING, allowNull: false },
  purpose: { type: DataTypes.STRING, allowNull: false },
  createdBy: { type: DataTypes.STRING, allowNull: false },
  createdAt: { type: DataTypes.DATE, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, modelName: 'AccessGrant', tableName: 'access_grants', indexes: [{ fields: ['vehicle_id', 'grantee_organization_id', 'permission'] }] });
