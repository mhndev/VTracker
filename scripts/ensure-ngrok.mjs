#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentApi = process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels';
const dryRun = process.argv.includes('--dry-run');

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return [];
    const separator = line.indexOf('=');
    if (separator < 1) return [];
    return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]];
  }));
}

const fileEnvironment = readEnvFile(path.join(repositoryRoot, '.env'));
const localPort = Number(process.env.TELEMATICS_PORT || fileEnvironment.TELEMATICS_PORT || 8090);

if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535) {
  console.error(`Invalid TELEMATICS_PORT: ${localPort}`);
  process.exit(1);
}

async function fetchTunnels() {
  try {
    const response = await fetch(agentApi, { signal: AbortSignal.timeout(1_500) });
    if (!response.ok) return null;
    const payload = await response.json();
    return Array.isArray(payload.tunnels) ? payload.tunnels : [];
  } catch {
    return null;
  }
}

function isTcpTunnel(tunnel) {
  return tunnel?.proto === 'tcp' || String(tunnel?.public_url || '').startsWith('tcp://');
}

function forwardsToPort(tunnel, port) {
  const address = String(tunnel?.config?.addr || '');
  const match = address.match(/(?:^|:)(\d+)\/?$/);
  return match ? Number(match[1]) === port : false;
}

function matchingTunnel(tunnels) {
  const tcpTunnels = tunnels.filter(isTcpTunnel);
  return tcpTunnels.find(tunnel => forwardsToPort(tunnel, localPort)) || null;
}

function reportTunnel(tunnel, existing) {
  console.log(`${existing ? 'Reusing' : 'Started'} ngrok TCP tunnel: ${tunnel.public_url}`);
  console.log(`Forwarding to: ${tunnel.config?.addr || `localhost:${localPort}`}`);
  console.log('Run "npm run tunnel:status" in another terminal for tracker SMS setup commands.');
}

const currentTunnels = await fetchTunnels();
if (currentTunnels) {
  const current = matchingTunnel(currentTunnels);
  if (current) {
    reportTunnel(current, true);
    process.exit(0);
  }
  const active = currentTunnels.map(tunnel => tunnel.public_url).filter(Boolean);
  console.error('ngrok is running, but it has no TCP tunnel for the Sentinel telematics gateway.');
  if (active.length) console.error(`Active endpoints: ${active.join(', ')}`);
  console.error('Stop that ngrok agent or add a TCP endpoint forwarding to the configured TELEMATICS_PORT.');
  process.exit(1);
}

if (dryRun) {
  console.log(`ngrok is not running. Would start: ngrok tcp ${localPort}`);
  process.exit(0);
}

console.log(`ngrok is not running; starting a TCP tunnel to localhost:${localPort}...`);
const child = spawn('ngrok', ['tcp', String(localPort)], { cwd: repositoryRoot, stdio: 'inherit' });
let ready = false;
const poll = setInterval(async () => {
  if (ready) return;
  const tunnels = await fetchTunnels();
  const tunnel = tunnels ? matchingTunnel(tunnels) : null;
  if (tunnel) {
    ready = true;
    reportTunnel(tunnel, false);
  }
}, 500);

child.once('error', error => {
  clearInterval(poll);
  if (error.code === 'ENOENT') {
    console.error('ngrok is not installed or is not on PATH. Install it, then run "ngrok config add-authtoken <token>".');
  } else {
    console.error(`Could not start ngrok: ${error.message}`);
  }
  process.exitCode = 1;
});

child.once('exit', code => {
  clearInterval(poll);
  process.exitCode = code ?? 1;
});
