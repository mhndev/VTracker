import { createApp } from './app.js';
import { env } from './config/env.js';
import { initializeDatabase } from './database/index.js';

function describeError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const details: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const item = current as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown; original?: unknown; parent?: unknown };
    const description = [item.name, item.code, item.message].filter(value => typeof value === 'string' && value).join(': ');
    if (description && !details.includes(description)) details.push(description);
    current = item.cause ?? item.original ?? item.parent;
  }
  return details.join(' -> ') || 'Unknown startup error';
}

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
  const message = describeError(error);
  console.error(`Failed to start Sentinel API: ${message}`);
  if (/ECONNREFUSED|ConnectionRefusedError|ETIMEDOUT/i.test(message)) {
    console.error([
      `The API could not reach the configured ${env.databaseDialect} database.`,
      'PostgreSQL: start it with "docker compose up -d --wait db", or point DATABASE_HOST/DATABASE_PORT at a running server.',
      'SQLite fallback: run "npm run dev:sqlite".'
    ].join('\n'));
  }
  if (error instanceof Error && error.stack) console.error(error.stack);
  // `tsx watch` stays alive when only exitCode is set, which leaves the two web
  // servers running after an API startup failure. Exit so concurrently can stop
  // the whole stack and return control to the terminal.
  process.exit(1);
});
