import { connectDatabase, sequelize } from './connection.js';
import { migrateDatabase } from './migrator.js';
import { seedDatabase } from './seed.js';
import { initializeAssociations } from '../models/index.js';

let initialized = false;

export async function initializeDatabase(force = false): Promise<void> {
  if (!initialized) {
    initializeAssociations();
    initialized = true;
  }
  await connectDatabase();
  if (force) await sequelize.drop();
  await migrateDatabase();
  await seedDatabase(force);
}
