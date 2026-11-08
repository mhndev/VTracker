import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class Trip extends Model {
  declare id: string;
  declare vehicleId: string;
  declare startedAt: Date;
  declare endedAt: Date | null;
  declare startLatitude: number;
  declare startLongitude: number;
  declare endLatitude: number;
  declare endLongitude: number;
  declare lastMovementAt: Date;
  declare stoppedSince: Date | null;
  declare distanceKm: number;
}

Trip.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  startedAt: { type: DataTypes.DATE, allowNull: false },
  endedAt: { type: DataTypes.DATE, allowNull: true },
  startLatitude: { type: DataTypes.FLOAT, allowNull: false },
  startLongitude: { type: DataTypes.FLOAT, allowNull: false },
  endLatitude: { type: DataTypes.FLOAT, allowNull: false },
  endLongitude: { type: DataTypes.FLOAT, allowNull: false },
  lastMovementAt: { type: DataTypes.DATE, allowNull: false },
  stoppedSince: { type: DataTypes.DATE, allowNull: true },
  distanceKm: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 }
}, {
  sequelize,
  modelName: 'Trip',
  tableName: 'trips',
  indexes: [
    { fields: ['vehicle_id', 'started_at'] },
    { fields: ['vehicle_id', 'ended_at'] }
  ]
});
