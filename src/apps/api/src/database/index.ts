import { connectDatabase } from './connection.js';
import { seedDatabase } from './seed.js';
import { initializeAssociations } from '../models/index.js';

let initialized = false;

export async function initializeDatabase(force = false): Promise<void> {
  if (!initialized) {
    initializeAssociations();
    initialized = true;
  }
  await connectDatabase();
  await seedDatabase(force);
}
