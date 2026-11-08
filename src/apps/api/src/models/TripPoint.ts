import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class TripPoint extends Model {
  declare tripId: string;
  declare slot: number;
  declare latitude: number;
  declare longitude: number;
  declare occurredAt: Date;
}

TripPoint.init({
  tripId: { type: DataTypes.STRING, primaryKey: true },
  slot: { type: DataTypes.INTEGER, primaryKey: true },
  latitude: { type: DataTypes.FLOAT, allowNull: false },
  longitude: { type: DataTypes.FLOAT, allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false }
}, {
  sequelize,
  modelName: 'TripPoint',
  tableName: 'trip_points',
  indexes: [{ fields: ['trip_id', 'occurred_at'] }]
});
