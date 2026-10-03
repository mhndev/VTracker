import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class AuditEvent extends Model {
  declare id: string;
  declare actorId: string;
  declare action: string;
  declare resourceType: string;
  declare resourceId: string;
  declare outcome: string;
  declare occurredAt: Date;
  declare details: Record<string, unknown>;
}
AuditEvent.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  actorId: { type: DataTypes.STRING, allowNull: false },
  action: { type: DataTypes.STRING, allowNull: false },
  resourceType: { type: DataTypes.STRING, allowNull: false },
  resourceId: { type: DataTypes.STRING, allowNull: false },
  outcome: { type: DataTypes.STRING, allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false },
  details: { type: DataTypes.JSON, allowNull: false, defaultValue: {} }
}, { sequelize, modelName: 'AuditEvent', tableName: 'audit_events', indexes: [{ fields: ['resource_id', 'occurred_at'] }] });
