import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDirectory, '../..');
const workspaceRoot = path.resolve(apiRoot, '../..');

// Load env files in order: workspace root -> api root.
// api-level .env overrides workspace-level values when present.
for (const envPath of [path.resolve(workspaceRoot, '.env'), path.resolve(apiRoot, '.env')]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}
// Also load default .env.example locations silently for fallbacks (no override)
dotenv.config();

function parseCors(value: string | undefined): string[] | null {
  if (!value) return null;
  const items = value.split(',').map(s => s.trim()).filter(Boolean);
  return items.length ? items : null;
}

// Explicit DATABASE_DIALECT wins; PostgreSQL is the project default.
const dialect = (process.env.DATABASE_DIALECT ?? 'postgres').toLowerCase();
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // API_PORT is the documented name; PORT is still honoured for compatibility.
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 8787),
  portalPort: Number(process.env.PORTAL_PORT ?? 5173),
  adminPort: Number(process.env.ADMIN_PORT ?? 5174),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigin: parseCors(process.env.CORS_ORIGIN),
  databaseDialect: dialect as 'postgres' | 'sqlite',
  databaseUrl: process.env.DATABASE_URL || '',
  databaseHost: process.env.DATABASE_HOST ?? 'localhost',
  databasePort: Number(process.env.DATABASE_PORT ?? 5432),
  databaseName: process.env.DATABASE_NAME ?? 'sentinel',
  databaseUser: process.env.DATABASE_USER ?? 'sentinel',
  databasePassword: process.env.DATABASE_PASSWORD ?? 'sentinel',
  databaseStorage: process.env.DATABASE_STORAGE === ':memory:'
    ? ':memory:'
    : path.resolve(apiRoot, process.env.DATABASE_STORAGE ?? '../../.data/sentinel.sqlite'),
  databaseLogging: process.env.DATABASE_LOGGING === 'true',
  workspaceRoot,
  apiRoot
};
