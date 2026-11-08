import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class VehicleState extends Model {
  declare vehicleId: string;
  declare ignitionOn: boolean;
  declare doorOpen: boolean;
  declare externalPower: boolean;
  declare armed: boolean;
  declare immobilized: boolean;
  declare fuelPercent: number | null;
  declare rawStatusMask: string | null;
  declare updatedAt: Date;
}

VehicleState.init({
  vehicleId: { type: DataTypes.STRING, primaryKey: true },
  ignitionOn: { type: DataTypes.BOOLEAN, allowNull: false },
  doorOpen: { type: DataTypes.BOOLEAN, allowNull: false },
  externalPower: { type: DataTypes.BOOLEAN, allowNull: false },
  armed: { type: DataTypes.BOOLEAN, allowNull: false },
  immobilized: { type: DataTypes.BOOLEAN, allowNull: false },
  fuelPercent: { type: DataTypes.FLOAT, allowNull: true },
  rawStatusMask: { type: DataTypes.STRING, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: false }
}, { sequelize, modelName: 'VehicleState', tableName: 'vehicle_states' });
