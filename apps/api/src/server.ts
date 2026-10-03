import { createApp } from './app.js';
import { env } from './config/env.js';
import { initializeDatabase } from './database/index.js';

async function start(): Promise<void> {
  await initializeDatabase();
  const host = env.host || '0.0.0.0';
  createApp().listen(env.port, host, () => {
    console.log(`Sentinel API listening on http://${host}:${env.port} (env: ${env.nodeEnv}, dialect: ${env.databaseDialect})`);
    console.log(`Interfaces: portal http://localhost:${env.portalPort}, admin console http://localhost:${env.adminPort}`);
    if (env.corsOrigin) console.log(`CORS allowed origins: ${env.corsOrigin.join(', ')}`);
  });
}

start().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start Sentinel API: ${message}`);
  if (/ECONNREFUSED|ConnectionRefusedError|ETIMEDOUT/i.test(message)) {
    console.error([
      `The API could not reach the configured ${env.databaseDialect} database.`,
      'PostgreSQL: start it with "docker compose up -d db", or point DATABASE_HOST/DATABASE_PORT at a running server.',
      'SQLite offline fallback: set DATABASE_DIALECT=sqlite, clear DATABASE_URL and set DATABASE_STORAGE.'
    ].join('\n'));
  }
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exitCode = 1;
});
