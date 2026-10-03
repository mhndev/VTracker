import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class LatestPosition extends Model {
  declare vehicleId: string;
  declare eventId: string;
  declare latitude: number;
  declare longitude: number;
  declare speedKph: number;
  declare heading: number;
  declare occurredAt: Date;
  declare ingestedAt: Date;
  declare quality: string;
}
LatestPosition.init({
  vehicleId: { type: DataTypes.STRING, primaryKey: true },
  eventId: { type: DataTypes.STRING, allowNull: false, unique: true },
  latitude: { type: DataTypes.FLOAT, allowNull: false },
  longitude: { type: DataTypes.FLOAT, allowNull: false },
  speedKph: { type: DataTypes.FLOAT, allowNull: false },
  heading: { type: DataTypes.FLOAT, allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false },
  ingestedAt: { type: DataTypes.DATE, allowNull: false },
  quality: { type: DataTypes.STRING, allowNull: false }
}, { sequelize, modelName: 'LatestPosition', tableName: 'latest_positions' });
