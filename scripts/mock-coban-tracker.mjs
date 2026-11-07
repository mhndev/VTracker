#!/usr/bin/env node

/**
 * Sentinel Fleet - Mock Coban GPS 303FG Tracker Simulator
 *
 * Emulates the exact physical behavior and TCP stream of the Coban 303FG-2-V3.4:
 * - TCP connection initiation
 * - Handshake login frame: ##,imei:<IMEI>,A;
 * - Heartbeat keep-alives: ##,imei:<IMEI>,B;
 * - Telemetry & GPS track reports (position, speed, heading, ACC ignition, fuel)
 * - Server downlink command reception (stop, resume, arm, disarm, check)
 * - Interactive alarm simulation (SOS, ACC tamper, door breach, power disconnect)
 */

import net from 'node:net';

const IMEI = process.env.TRACKER_IMEI || '358123049582103';
const HOST = process.env.TRACKER_HOST || '127.0.0.1';
const PORT = parseInt(process.env.TRACKER_PORT || '8090', 10);
const PASSWORD = process.env.TRACKER_PASSWORD || '123456';

let lat = 52.5200; // Berlin default
let lon = 13.4050;
let speedKph = 35.0;
let heading = 90.0;
let accOn = true;
let armed = false;
let immobilized = false;
let externalPower = true;
let fuelPercent = 85.0;
let batteryVolts = 3.95;

function toNmeaLat(decimalLat) {
  const abs = Math.abs(decimalLat);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const hem = decimalLat >= 0 ? 'N' : 'S';
  const degStr = String(deg).padStart(2, '0');
  const minStr = min.toFixed(4).padStart(7, '0');
  return `${degStr}${minStr},${hem}`;
}

function toNmeaLon(decimalLon) {
  const abs = Math.abs(decimalLon);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const hem = decimalLon >= 0 ? 'E' : 'W';
  const degStr = String(deg).padStart(3, '0');
  const minStr = min.toFixed(4).padStart(7, '0');
  return `${degStr}${minStr},${hem}`;
}

function getUtcStrings() {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return {
    date: `${yy}${MM}${dd}`,
    time: `${hh}${mm}${ss}.000`
  };
}

console.log('\n===============================================================');
console.log(`   Mock Coban GPS 303FG Simulator (IMEI: ${IMEI})             `);
console.log(`   Target: ${HOST}:${PORT}                                     `);
console.log('===============================================================\n');

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log(`🟢 Connected to Telematics Gateway at ${HOST}:${PORT}`);

  // Send Login Handshake
  const loginPacket = `##,imei:${IMEI},A;\r\n`;
  console.log(`📤 Sending Login Handshake: ${loginPacket.trim()}`);
  client.write(loginPacket);
});

client.on('data', data => {
  const msg = data.toString().trim();
  console.log(`📥 Received from Server: "${msg}"`);

  // Handle server handshake acknowledgment
  if (msg.toUpperCase().includes('LOAD') || msg.toUpperCase().includes('ON')) {
    console.log(`✅ Server accepted login. Starting telemetry stream...`);
    startTelemetryLoop();
  }

  // Handle downlink commands
  if (msg.startsWith(`stop${PASSWORD}`)) {
    immobilized = true;
    speedKph = 0;
    console.log(`🛑 Engine Immobilized (Relay tripped)!`);
    client.write(`stop ok;\r\n`);
  } else if (msg.startsWith(`quickstop${PASSWORD}`)) {
    immobilized = true;
    speedKph = 0;
    console.log(`🛑 Immediate Engine Cut-Off executed!`);
    client.write(`quickstop ok;\r\n`);
  } else if (msg.startsWith(`resume${PASSWORD}`)) {
    immobilized = false;
    console.log(`✅ Engine / Fuel Supply Resumed.`);
    client.write(`resume ok;\r\n`);
  } else if (msg.startsWith(`arm${PASSWORD}`)) {
    if (accOn) {
      console.log(`⚠️ Arm failed because ACC is ON.`);
      client.write(`set up fail! pls turn off ACC;\r\n`);
    } else {
      armed = true;
      console.log(`🔒 Armed mode activated.`);
      client.write(`Tracker is activated;\r\n`);
    }
  } else if (msg.startsWith(`silent${PASSWORD}`)) {
    armed = true;
    console.log(`🔕 Silent Armed mode activated.`);
    client.write(`silent ok!;\r\n`);
  } else if (msg.startsWith(`disarm${PASSWORD}`)) {
    armed = false;
    console.log(`🔓 Disarmed.`);
    client.write(`Tracker is deactivated;\r\n`);
  } else if (msg.startsWith(`check${PASSWORD}`)) {
    const report = `Battery: ${batteryVolts}V; GPS: strong; GSM: strong; GPRS: OK; APN: internet; IP: ${HOST}; Port: ${PORT};\r\n`;
    client.write(report);
  } else if (msg.startsWith(`oilzero${PASSWORD}`)) {
    fuelPercent = 0.0;
    console.log(`⛽ Calibrated fuel zero (0%).`);
    client.write(`oilzero ok!;\r\n`);
  } else if (msg.startsWith(`oilfull${PASSWORD}`)) {
    fuelPercent = 100.0;
    console.log(`⛽ Calibrated fuel full (100%).`);
    client.write(`Oil full ok!;\r\n`);
  }
});

client.on('close', () => {
  console.log('🔴 Connection closed by telematics server.');
  process.exit(0);
});

client.on('error', err => {
  console.error(`❌ Socket error: ${err.message}`);
});

let telemetryTimer = null;
let heartbeatTimer = null;

function sendPositionReport(alarmType = 'tracker') {
  if (client.destroyed) return;

  const { date, time } = getUtcStrings();
  const nmeaLat = toNmeaLat(lat);
  const nmeaLon = toNmeaLon(lon);

  // Speed in knots (1 knot = 1.852 km/h)
  const knots = (speedKph / 1.852).toFixed(1);
  const speedStr = String(knots).padStart(5, '0');
  const courseStr = heading.toFixed(1).padStart(5, '0');

  // Simulated fuel voltage (0 - 5V)
  const fuelVoltage = ((fuelPercent / 100) * 5.0).toFixed(2);

  // Status mask: [ACC: 1/0, Armed: 1/0, Immobilized: 1/0, Power: 1/0, Door: 0]
  const statusBits = `${accOn ? '1' : '0'}${armed ? '1' : '0'}${immobilized ? '1' : '0'}${externalPower ? '1' : '0'}0000`;

  // Coban standard format:
  // imei:<IMEI>,<alarmType>,<yymmddHHmm>,,F,<hhmmss.sss>,A,<lat>,<N/S>,<lon>,<E/W>,<speed>,<heading>,<fuel>,<status>...;
  const packet = `imei:${IMEI},${alarmType},${date}${time.slice(0, 4)},,F,${time},A,${nmeaLat},${nmeaLon},${speedStr},${courseStr},${fuelVoltage},${statusBits},L,00000000,00000000,000;\r\n`;

  console.log(`📍 Sending Telemetry [${alarmType.toUpperCase()}]: Lat=${lat.toFixed(6)}, Lon=${lon.toFixed(6)}, Speed=${speedKph}km/h, ACC=${accOn ? 'ON' : 'OFF'}, Fuel=${fuelPercent}%`);
  client.write(packet);

  // Simulate gradual vehicle movement
  if (!immobilized && accOn) {
    lat += 0.0003;
    lon += 0.0004;
    speedKph = Math.min(80, Math.max(20, speedKph + (Math.random() - 0.5) * 5));
  } else {
    speedKph = 0;
  }
}

function startTelemetryLoop() {
  if (telemetryTimer) return;

  // Send periodic position report every 10 seconds
  telemetryTimer = setInterval(() => {
    sendPositionReport('tracker');
  }, 10000);

  // Send initial report immediately
  sendPositionReport('tracker');

  // Periodic heartbeat every 60 seconds
  heartbeatTimer = setInterval(() => {
    if (!client.destroyed) {
      console.log(`💓 Sending Heartbeat: ##,imei:${IMEI},B;`);
      client.write(`##,imei:${IMEI},B;\r\n`);
    }
  }, 60000);

  // Enable stdin commands for manual alarm triggering
  printInteractiveMenu();
  setupStdin();
}

function printInteractiveMenu() {
  console.log('\n--- Interactive Simulation Controls (type key & press Enter) ---');
  console.log(' [1] Trigger SOS Alarm');
  console.log(' [2] Trigger ACC Ignition Tamper Alarm');
  console.log(' [3] Trigger Door Breach Alarm');
  console.log(' [4] Toggle External Main Power (Disconnect/Reconnect 12V)');
  console.log(' [5] Trigger Low Battery Alarm (3.55V)');
  console.log(' [6] Toggle ACC (Engine ON / OFF)');
  console.log(' [q] Quit Simulator');
  console.log('-----------------------------------------------------------------\n');
}

function setupStdin() {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    const key = chunk.trim();
    switch (key) {
      case '1':
        console.log('🚨 Triggering SOS button press...');
        sendPositionReport('help!');
        break;
      case '2':
        console.log('🚨 Triggering ACC alarm...');
        sendPositionReport('acc alarm');
        break;
      case '3':
        console.log('🚨 Triggering Door breach alarm...');
        sendPositionReport('door alarm');
        break;
      case '4':
        externalPower = !externalPower;
        console.log(`⚡ External 12V Power: ${externalPower ? 'CONNECTED' : 'DISCONNECTED (Running on 3.7V Battery)'}`);
        if (!externalPower) {
          sendPositionReport('power off');
        } else {
          sendPositionReport('tracker');
        }
        break;
      case '5':
        batteryVolts = 3.52;
        console.log('🔋 Triggering Low Battery warning (3.52V)...');
        sendPositionReport('low battery');
        break;
      case '6':
        accOn = !accOn;
        console.log(`🔑 Ignition ACC turned ${accOn ? 'ON' : 'OFF'}`);
        sendPositionReport(accOn ? 'ACC on' : 'ACC off');
        break;
      case 'q':
        console.log('Exiting...');
        client.end();
        process.exit(0);
        break;
    }
  });
}
