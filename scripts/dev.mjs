import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return [];
    const separator = line.indexOf('=');
    if (separator < 1) return [];
    const key = line.slice(0, separator).trim().replace(/^export\s+/, '');
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    return [[key, value]];
  }));
}

function canConnect(host, port, timeout = 800) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = result => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function postgresAddress(environment) {
  if (environment.DATABASE_URL) {
    try {
      const url = new URL(environment.DATABASE_URL);
      return { host: url.hostname, port: Number(url.port || 5432) };
    } catch {
      return null;
    }
  }
  return {
    host: environment.DATABASE_HOST || '127.0.0.1',
    port: Number(environment.DATABASE_PORT || 5432)
  };
}

const fileEnvironment = readEnvFile(path.join(repositoryRoot, '.env'));
const environment = { ...fileEnvironment, ...process.env };
const requestedArgument = process.argv.find(argument => argument.startsWith('--database='));
const requestedDatabase = requestedArgument?.split('=')[1];

if (requestedDatabase && !['postgres', 'sqlite'].includes(requestedDatabase)) {
  console.error('Invalid --database value. Use postgres or sqlite.');
  process.exit(1);
}

let database = requestedDatabase || environment.DATABASE_DIALECT || 'postgres';
const explicitShellDatabase = !requestedDatabase && process.env.DATABASE_DIALECT;
let automaticSqliteFallback = false;

if (!['postgres', 'sqlite'].includes(database)) {
  console.error(`Invalid DATABASE_DIALECT "${database}". Use postgres or sqlite.`);
  process.exit(1);
}

if (database === 'postgres' && !requestedDatabase && !explicitShellDatabase) {
  const address = postgresAddress(environment);
  const reachable = address && Number.isInteger(address.port) && address.port > 0
    ? await canConnect(address.host, address.port)
    : false;
  if (!reachable) {
    database = 'sqlite';
    automaticSqliteFallback = true;
    console.warn('PostgreSQL is not reachable; using an in-memory SQLite database for this development session.');
    console.warn('Use "npm run dev:postgres" for a strict PostgreSQL startup.');
    console.warn('Use "npm run dev:sqlite" when the demo data should persist between restarts.');
  }
}

const childEnvironment = {
  ...process.env,
  DATABASE_DIALECT: database
};
if (database === 'sqlite') {
  childEnvironment.DATABASE_URL = '';
  if (automaticSqliteFallback && !process.env.DATABASE_STORAGE) childEnvironment.DATABASE_STORAGE = ':memory:';
}

console.log(`Starting Sentinel Fleet with ${database === 'sqlite' ? (automaticSqliteFallback ? 'in-memory SQLite' : 'SQLite') : 'PostgreSQL'}...`);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCommand, ['run', 'dev:services'], {
  cwd: repositoryRoot,
  env: childEnvironment,
  detached: process.platform !== 'win32',
  stdio: 'inherit'
});

function stopChild(signal) {
  if (!child.pid || child.killed) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

process.once('SIGINT', () => stopChild('SIGINT'));
process.once('SIGTERM', () => stopChild('SIGTERM'));

child.once('error', error => {
  console.error(`Could not start the development services: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
