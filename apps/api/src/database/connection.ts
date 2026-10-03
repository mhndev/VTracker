import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Sequelize, type Options } from 'sequelize';
import { env } from '../config/env.js';

function buildSequelizeOptions(): Options {
  const common: Options = {
    logging: env.databaseLogging ? console.log : false,
    define: { underscored: true, freezeTableName: true, timestamps: false }
  };
  // In test with :memory:, force sqlite regardless of dialect
  const forceSqlite = env.databaseStorage === ':memory:' || env.nodeEnv === 'test';
  const dialect = forceSqlite ? 'sqlite' : env.databaseDialect;
  if (dialect === 'postgres') {
    if (env.databaseUrl) {
      return { ...common, dialect: 'postgres', dialectOptions: {} } as Options & { dialect: 'postgres' };
    }
    return {
      ...common,
      dialect: 'postgres',
      host: env.databaseHost,
      port: env.databasePort,
      database: env.databaseName,
      username: env.databaseUser,
      password: env.databasePassword,
      dialectOptions: {}
    } as Options;
  }
  // sqlite fallback
  return {
    ...common,
    dialect: 'sqlite',
    storage: env.databaseStorage
  } as Options;
}

function buildSequelize(): Sequelize {
  const opts = buildSequelizeOptions();
  if ((opts as { dialect: string }).dialect === 'postgres' && env.databaseUrl) {
    return new Sequelize(env.databaseUrl, opts);
  }
  return new Sequelize(opts as Options);
}

export const sequelize = buildSequelize();

export async function connectDatabase(): Promise<void> {
  const dialect = (sequelize.getDialect() as string);
  if (dialect === 'sqlite' && env.databaseStorage !== ':memory:') {
    await mkdir(path.dirname(env.databaseStorage), { recursive: true });
  }
  await sequelize.authenticate();
}

export async function closeDatabase(): Promise<void> {
  await sequelize.close();
}
