import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, '../../..');
const readEnvFile = (file: string): Record<string, string> => {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(raw => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return [];
    const separator = line.indexOf('=');
    if (separator < 1) return [];
    return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]];
  }));
};
const fileEnv = { ...readEnvFile(path.join(workspaceRoot, '.env')), ...readEnvFile(path.join(workspaceRoot, '.env.local')) };
const read = (key: string, fallback: string) => process.env[key] || fileEnv[key] || fallback;

export default defineConfig({
  plugins: [react()],
  server: {
    host: read('WEB_HOST', '127.0.0.1'),
    port: Number(read('SIMULATOR_PORT', '5175')),
    strictPort: true,
    proxy: { '/simulator-api': `http://127.0.0.1:${read('SIMULATOR_CONTROL_PORT', '5176')}` }
  },
  build: { outDir: '../../../dist/device-simulator', emptyOutDir: true }
});
