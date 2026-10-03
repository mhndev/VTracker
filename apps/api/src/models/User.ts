import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection.js';

export class User extends Model {
  declare id: string;
  declare name: string;
  declare email: string;
}
User.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true }
}, { sequelize, modelName: 'User', tableName: 'users' });
