#!/usr/bin/env node

/**
 * Sentinel Fleet - GPS Tracker 303FG ngrok Tunnel Helper
 *
 * Checks for a running ngrok TCP tunnel forwarding to the telematics port (default 8090),
 * extracts the public hostname and port, and outputs the exact SMS commands needed to
 * provision the Coban 303FG hardware.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NGROK_API = process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels';
const envText = fs.existsSync(path.join(repositoryRoot, '.env')) ? fs.readFileSync(path.join(repositoryRoot, '.env'), 'utf8') : '';
const configuredPort = envText.match(/^TELEMATICS_PORT=(\d+)\s*$/m)?.[1];
const DEFAULT_LOCAL_PORT = parseInt(process.env.TELEMATICS_PORT || configuredPort || '8090', 10);
const DEFAULT_PASSWORD = process.env.TRACKER_PASSWORD || '123456';
const DEFAULT_APN = process.env.TRACKER_APN || 'internet';

async function fetchNgrokTunnels() {
  try {
    const res = await fetch(NGROK_API);
    if (!res.ok) return null;
    const data = await res.json();
    return data.tunnels || [];
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log('   Sentinel Fleet — GPS Tracker 303FG ngrok Setup Helper       ');
  console.log('===============================================================\n');

  const tunnels = await fetchNgrokTunnels();

  if (!tunnels) {
    console.log('⚠️  ngrok is not currently running or its local API (port 4040) is unreachable.\n');
    console.log('To start an ngrok TCP tunnel for the telematics gateway, run:');
    console.log('\n    npm run tunnel:tcp\n');
    console.log('Once ngrok is running, run this script again:\n');
    console.log('    node scripts/telematics-tunnel.mjs\n');
    process.exit(0);
  }

  // Match the TCP tunnel that forwards to this repository's configured gateway port.
  const tcpTunnel = tunnels.find(tunnel => {
    if (tunnel.proto !== 'tcp' && !String(tunnel.public_url || '').startsWith('tcp://')) return false;
    const address = String(tunnel.config?.addr || '');
    const port = address.match(/(?:^|:)(\d+)\/?$/)?.[1];
    return Number(port) === DEFAULT_LOCAL_PORT;
  });

  if (!tcpTunnel) {
    console.log('⚠️  ngrok is running, but no TCP tunnel was found.');
    console.log(`Active tunnels: ${tunnels.map(t => t.public_url).join(', ')}\n`);
    console.log(`No tunnel forwards to TELEMATICS_PORT ${DEFAULT_LOCAL_PORT}.`);
    console.log('Run "npm run tunnel:tcp" after stopping a conflicting ngrok agent.\n');
    process.exit(0);
  }

  // Parse public URL e.g. tcp://0.tcp.ngrok.io:14822
  const match = tcpTunnel.public_url.match(/^tcp:\/\/(.+):(\d+)$/);
  if (!match) {
    console.error(`❌ Unexpected tunnel URL format: ${tcpTunnel.public_url}`);
    process.exit(1);
  }

  const [, host, port] = match;

  console.log(`✅ Active ngrok TCP tunnel detected:`);
  console.log(`   Public Endpoint : ${host}:${port}`);
  console.log(`   Forwarding to   : ${tcpTunnel.config.addr || `localhost:${DEFAULT_LOCAL_PORT}`}\n`);

  console.log('---------------------------------------------------------------');
  console.log('📱 SEND THESE SMS COMMANDS TO YOUR 303FG SIM CARD IN ORDER:');
  console.log('---------------------------------------------------------------\n');

  console.log(`1. Initialize tracker (resets settings to default):`);
  console.log(`   SMS: begin${DEFAULT_PASSWORD}`);
  console.log(`   Expected Reply: begin ok\n`);

  console.log(`2. Configure Cellular APN (replace "${DEFAULT_APN}" if your carrier uses another APN):`);
  console.log(`   SMS: apn${DEFAULT_PASSWORD} ${DEFAULT_APN}`);
  console.log(`   Expected Reply: apn ok\n`);

  console.log(`3. Enable GPRS mode (Coban TCP networking):`);
  console.log(`   SMS: gprs${DEFAULT_PASSWORD}`);
  console.log(`   Expected Reply: GPRS ok\n`);

  console.log(`4. Select TCP protocol:`);
  console.log(`   SMS: tcp${DEFAULT_PASSWORD}`);
  console.log(`   Expected Reply: tcp ok\n`);

  console.log(`5. Set ngrok Server DNS and Port:`);
  console.log(`   SMS: adminip${DEFAULT_PASSWORD} ${host} ${port}`);
  console.log(`   (Or if older firmware rejects adminip): dns${DEFAULT_PASSWORD} ${host} ${port}`);
  console.log(`   Expected Reply: adminip ok\n`);

  console.log(`6. Configure tracking reporting interval:`);
  console.log(`   (Reports every 20s while moving, every 2h when stopped, unlimited):`);
  console.log(`   SMS: fix020s002h***n${DEFAULT_PASSWORD}`);
  console.log(`   Expected Reply: fix ok\n`);

  console.log(`7. Verify tracker connectivity status:`);
  console.log(`   SMS: check${DEFAULT_PASSWORD}`);
  console.log(`   Expected Reply: Battery, GPS, GSM, GPRS, APN, IP, Port status report\n`);

  console.log('---------------------------------------------------------------');
  console.log('💡 Note: The Green LED on the device will flash once every 3s');
  console.log('   when GPRS mode is successfully connected to your laptop.');
  console.log('===============================================================\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
