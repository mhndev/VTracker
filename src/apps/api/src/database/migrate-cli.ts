import { closeDatabase, connectDatabase } from './connection.js';
import { migrateDatabase, migrator } from './migrator.js';

const command = process.argv[2] ?? 'up';

try {
  await connectDatabase();
  if (command === 'up') await migrateDatabase();
  else if (command === 'status') {
    const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
    console.log(`Executed migrations: ${executed.map(item => item.name).join(', ') || 'none'}`);
    console.log(`Pending migrations: ${pending.map(item => item.name).join(', ') || 'none'}`);
  } else if (command === 'down') {
    const reverted = await migrator.down();
    console.log(`Reverted migration: ${reverted.map(item => item.name).join(', ')}`);
  } else throw new Error('Use one of: up, status, down.');
} finally {
  await closeDatabase();
}
