import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class TelemetryEvent extends Model {
  declare id: string;
  declare vehicleId: string;
  declare latitude: number;
  declare longitude: number;
  declare speedKph: number;
  declare heading: number;
  declare occurredAt: Date;
  declare ingestedAt: Date;
  declare quality: string;
  declare schemaVersion: number;
  declare source: string;
}
TelemetryEvent.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  latitude: { type: DataTypes.FLOAT, allowNull: false },
  longitude: { type: DataTypes.FLOAT, allowNull: false },
  speedKph: { type: DataTypes.FLOAT, allowNull: false },
  heading: { type: DataTypes.FLOAT, allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false },
  ingestedAt: { type: DataTypes.DATE, allowNull: false },
  quality: { type: DataTypes.STRING, allowNull: false },
  schemaVersion: { type: DataTypes.INTEGER, allowNull: false },
  source: { type: DataTypes.STRING, allowNull: false }
}, { sequelize, modelName: 'TelemetryEvent', tableName: 'telemetry_events', indexes: [{ fields: ['vehicle_id', 'occurred_at'] }] });
