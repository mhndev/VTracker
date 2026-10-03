import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, '../..');

// Read the workspace .env for ports and the API target. A local parser is used
// instead of Vite's loadEnv() on purpose: loadEnv() has the side effect of
// copying NODE_ENV from the file into process.env.VITE_USER_NODE_ENV, which makes
// `vite build` bundle the development React runtime.
const readEnvFile = (file: string): Record<string, string> => {
  if (!fs.existsSync(file)) return {};
  const entries: Array<[string, string]> = [];
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().replace(/^export\s+/, '');
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    entries.push([key, value]);
  }
  return Object.fromEntries(entries);
};

const fileEnv = {
  ...readEnvFile(path.join(workspaceRoot, '.env')),
  ...readEnvFile(path.join(workspaceRoot, '.env.local'))
};

const read = (key: string, fallback: string): string => process.env[key] || fileEnv[key] || fallback;

export default defineConfig({
  plugins: [react()],
  server: {
    host: read('WEB_HOST', '127.0.0.1'),
    port: Number(read('PORTAL_PORT', '5173')),
    strictPort: true,
    proxy: { '/api': read('VITE_API_BASE', 'http://127.0.0.1:8787') }
  },
  build: { outDir: '../../dist/portal', emptyOutDir: true }
});
