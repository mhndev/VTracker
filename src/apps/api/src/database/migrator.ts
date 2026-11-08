import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SequelizeStorage, Umzug } from 'umzug';
import { sequelize } from './connection.js';

const migrationDirectory = path.resolve(import.meta.dirname, 'migrations');
const migrationStorage = new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' });
export const migrator = new Umzug({
  migrations: {
    glob: [path.join(migrationDirectory, '*.{js,ts}'), { ignore: ['**/*.d.ts'] }],
    resolve: ({ name, path: migrationPath, context }) => {
      if (!migrationPath) throw new Error(`Migration ${name} has no file path.`);
      const stableName = name.replace(/\.(?:js|ts)$/, '');
      const load = async () => import(pathToFileURL(migrationPath).href) as Promise<{
        up: (input: { context: typeof context }) => Promise<unknown>;
        down: (input: { context: typeof context }) => Promise<unknown>;
      }>;
      return {
        name: stableName,
        up: async () => (await load()).up({ context }),
        down: async () => (await load()).down({ context })
      };
    }
  },
  context: sequelize.getQueryInterface(),
  storage: migrationStorage,
  logger: envMigrationLogger()
});

function envMigrationLogger() {
  if (process.env.NODE_ENV === 'test') return undefined;
  return {
    info: (message: object) => console.log('[Migration]', message),
    warn: (message: object) => console.warn('[Migration]', message),
    error: (message: object) => console.error('[Migration]', message),
    debug: (message: object) => console.debug('[Migration]', message)
  };
}

export async function migrateDatabase(): Promise<void> {
  await migrator.up();
}
