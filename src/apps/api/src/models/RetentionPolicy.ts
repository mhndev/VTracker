import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class RetentionPolicy extends Model {
  declare id: string;
  declare name: string;
  declare logRetentionDays: number;
  declare estimatedMessagesPerVehiclePerDay: number;
  declare averageMessageBytes: number;
  declare estimatedTelemetryEventsPerVehiclePerDay: number;
  declare averageTelemetryEventBytes: number;
  declare estimatedTripsPerVehiclePerDay: number;
  declare maxPointsPerTrip: number;
  declare averageTripPointBytes: number;
}

RetentionPolicy.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  logRetentionDays: { type: DataTypes.INTEGER, allowNull: false },
  estimatedMessagesPerVehiclePerDay: { type: DataTypes.INTEGER, allowNull: false },
  averageMessageBytes: { type: DataTypes.INTEGER, allowNull: false },
  estimatedTelemetryEventsPerVehiclePerDay: { type: DataTypes.INTEGER, allowNull: false },
  averageTelemetryEventBytes: { type: DataTypes.INTEGER, allowNull: false },
  estimatedTripsPerVehiclePerDay: { type: DataTypes.FLOAT, allowNull: false },
  maxPointsPerTrip: { type: DataTypes.INTEGER, allowNull: false },
  averageTripPointBytes: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'RetentionPolicy', tableName: 'retention_policies' });
