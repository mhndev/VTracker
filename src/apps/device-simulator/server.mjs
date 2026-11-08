import express from 'express';
import net from 'node:net';
import dgram from 'node:dgram';
import { alarmTags, createDeviceState, createLocationPacket, handleDeviceCommand } from './protocol.mjs';
import { parseCoordinateQuery, pointAlongGeometry, prepareGeometry } from './route.mjs';

const app = express();
const controlPort = Number(process.env.SIMULATOR_CONTROL_PORT || 5176);
const sessions = new Map();
const profileOwners = new Map();
const geocodeCache = new Map();
let lastGeocodeAt = 0;

const vehicleProfiles = [
  { key: 'vehicle-1', label: 'Delivery Van 12', imei: '358123049582103', latitude: 52.5208, longitude: 13.4095 },
  { key: 'vehicle-2', label: 'Service Car 07', imei: '358123049582104', latitude: 52.5073, longitude: 13.3762 },
  { key: 'vehicle-3', label: 'Cargo Van 19', imei: '358123049582105', latitude: 52.5355, longitude: 13.3481 },
  { key: 'vehicle-4', label: 'Pool Car 03', imei: '358123049582106', latitude: 52.4917, longitude: 13.4513 }
];

app.use(express.json({ limit: '32kb' }));

function sessionIdFrom(request) {
  const value = String(request.get('x-simulator-session') || request.query.session || 'default');
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value) ? value : 'default';
}

function allocateProfile(sessionId) {
  const available = vehicleProfiles.find(profile => !profileOwners.has(profile.key));
  const profile = available || vehicleProfiles[Math.abs([...sessionId].reduce((total, char) => total + char.charCodeAt(0), 0)) % vehicleProfiles.length];
  if (available) profileOwners.set(profile.key, sessionId);
  return profile;
}

function createSession(sessionId) {
  const profile = allocateProfile(sessionId);
  return {
    id: sessionId,
    profile,
    state: createDeviceState({ imei: profile.imei, latitude: profile.latitude, longitude: profile.longitude }),
    socket: null,
    datagramSocket: null,
    connected: false,
    incoming: '',
    eventSequence: 0,
    events: [],
    subscribers: new Set(),
    routeTimer: null,
    route: { status: 'idle', start: null, end: null, geometry: [], distanceMeters: 0, durationSeconds: 0, progress: 0, playbackRate: 1, elapsedSeconds: 0 }
  };
}

function getSession(request) {
  const id = sessionIdFrom(request);
  if (!sessions.has(id)) sessions.set(id, createSession(id));
  return sessions.get(id);
}

function publicState(session) {
  return {
    ...session.state,
    connected: session.connected,
    authorizedNumbers: [...session.state.authorizedNumbers],
    sessionId: session.id,
    vehicleKey: session.profile.key,
    vehicleLabel: session.profile.label,
    route: { ...session.route, prepared: undefined }
  };
}

function record(session, direction, kind, raw, extra = {}) {
  const event = { id: ++session.eventSequence, at: new Date().toISOString(), direction, kind, raw, ...extra };
  session.events.unshift(event);
  session.events.splice(200);
  for (const response of session.subscribers) response.write(`data: ${JSON.stringify({ event, state: publicState(session) })}\n\n`);
  return event;
}

function write(session, raw, kind = 'packet') {
  if (!session.connected || (!session.datagramSocket && (!session.socket || session.socket.destroyed))) throw new Error('Device is not connected.');
  const payload = raw.endsWith('\r\n') ? raw : `${raw}\r\n`;
  if (session.datagramSocket) session.datagramSocket.send(Buffer.from(payload, 'ascii'));
  else session.socket.write(payload);
  record(session, 'out', kind, raw.trim());
}

function processDownlink(session, command) {
  const clean = command.trim();
  if (!clean) return;
  record(session, 'in', clean.toUpperCase() === 'LOAD' || clean.toUpperCase() === 'ON' ? 'gateway-ack' : 'device-command', clean);
  const result = handleDeviceCommand(clean, session.state);
  if (result.sendLocation) write(session, createLocationPacket(session.state), 'position');
  if (result.response) write(session, `${result.response};`, 'command-response');
}

function closeTransport(session) {
  session.socket?.destroy();
  session.datagramSocket?.close();
  session.socket = null;
  session.datagramSocket = null;
  session.connected = false;
}

function connectDevice(session, host, port, imei, transport = 'tcp') {
  return new Promise((resolve, reject) => {
    closeTransport(session);
    session.state.serverHost = host;
    session.state.serverPort = port;
    session.state.imei = imei;
    session.state.transport = transport;
    if (transport === 'udp') {
      const candidate = dgram.createSocket('udp4');
      session.datagramSocket = candidate;
      candidate.once('error', error => { candidate.close(); if (session.datagramSocket === candidate) session.datagramSocket = null; reject(error); });
      candidate.on('message', message => processDownlink(session, message.toString('ascii')));
      candidate.connect(port, host, () => {
        session.connected = true;
        record(session, 'system', 'connected', `udp://${host}:${port}`);
        write(session, `##,imei:${session.state.imei},A;`, 'login');
        resolve(publicState(session));
      });
      return;
    }
    const candidate = net.createConnection({ host, port });
    session.socket = candidate;
    const fail = error => { candidate.destroy(); if (session.socket === candidate) session.socket = null; reject(error); };
    candidate.setTimeout(10000, () => fail(new Error('Connection timed out after 10 seconds.')));
    candidate.once('error', fail);
    candidate.once('connect', () => {
      candidate.setTimeout(0);
      candidate.removeListener('error', fail);
      candidate.on('error', error => record(session, 'system', 'socket-error', error.message));
      session.connected = true;
      record(session, 'system', 'connected', `${host}:${port}`);
      write(session, `##,imei:${session.state.imei},A;`, 'login');
      resolve(publicState(session));
    });
    candidate.on('data', chunk => {
      session.incoming += chunk.toString('ascii');
      const frames = session.incoming.split(/[;\r\n]+/);
      session.incoming = frames.pop() || '';
      for (const frame of frames) processDownlink(session, frame);
    });
    candidate.on('close', () => {
      if (session.socket === candidate) { session.connected = false; session.socket = null; record(session, 'system', 'disconnected', `${host}:${port}`); }
    });
  });
}

async function geocode(query) {
  const coordinates = parseCoordinateQuery(query);
  if (coordinates) return coordinates;
  const key = String(query || '').trim().toLowerCase();
  if (!key) throw new Error('Enter an address or latitude, longitude pair.');
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const wait = Math.max(0, 1000 - (Date.now() - lastGeocodeAt));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastGeocodeAt = Date.now();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { 'User-Agent': 'SentinelFleet-GPS-Simulator/0.2 (local development tool)', Referer: 'http://localhost:5175/' } });
  if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
  const [result] = await response.json();
  if (!result) throw new Error(`No location found for “${query}”.`);
  const location = { latitude: Number(result.lat), longitude: Number(result.lon), label: result.display_name };
  geocodeCache.set(key, location);
  return location;
}

async function planRoute(startQuery, endQuery) {
  const [start, end] = await Promise.all([geocode(startQuery), geocode(endQuery)]);
  const coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=simplified&geometries=geojson&steps=false`;
  const response = await fetch(url, { headers: { 'User-Agent': 'SentinelFleet-GPS-Simulator/0.2' } });
  if (!response.ok) throw new Error(`Route service failed (${response.status}).`);
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) throw new Error('No drivable route was found between these locations.');
  return { start, end, geometry: route.geometry.coordinates, distanceMeters: route.distance, durationSeconds: route.duration };
}

function clearRouteTimer(session) {
  if (session.routeTimer) clearInterval(session.routeTimer);
  session.routeTimer = null;
}

function emitRoutePosition(session) {
  const point = pointAlongGeometry(session.route.prepared, session.route.progress);
  Object.assign(session.state, point, {
    speedKph: session.route.progress >= 1 ? 0 : Math.max(5, Math.min(130, session.route.distanceMeters / session.route.durationSeconds * 3.6)),
    validFix: true,
    ignitionOn: session.route.progress < 1
  });
  write(session, createLocationPacket(session.state), 'route-position');
  record(session, 'local', 'route-progress', `${Math.round(session.route.progress * 100)}% · ${session.state.speedKph.toFixed(0)} km/h`);
}

function startRouteTimer(session) {
  clearRouteTimer(session);
  let lastTick = Date.now();
  session.routeTimer = setInterval(() => {
    if (session.route.status !== 'running') return;
    const now = Date.now();
    session.route.elapsedSeconds += (now - lastTick) / 1000 * session.route.playbackRate;
    lastTick = now;
    session.route.progress = Math.min(1, session.route.elapsedSeconds / session.route.durationSeconds);
    try { emitRoutePosition(session); } catch (error) {
      session.route.status = 'paused';
      record(session, 'system', 'route-error', error instanceof Error ? error.message : String(error));
    }
    if (session.route.progress >= 1) {
      session.route.status = 'completed';
      clearRouteTimer(session);
    }
  }, 1000);
}

app.get('/simulator-api/status', (request, response) => {
  const session = getSession(request);
  response.json({ state: publicState(session), events: session.events });
});
app.get('/simulator-api/events', (request, response) => {
  const session = getSession(request);
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();
  session.subscribers.add(response);
  const ping = setInterval(() => response.write(': ping\n\n'), 15000);
  request.on('close', () => { clearInterval(ping); session.subscribers.delete(response); });
});
app.post('/simulator-api/connect', async (request, response) => {
  const session = getSession(request);
  try {
    const host = String(request.body.host || '127.0.0.1').replace(/^tcp:\/\//, '').split(':')[0];
    const embeddedPort = String(request.body.host || '').replace(/^tcp:\/\//, '').split(':')[1];
    const port = Number(request.body.port || embeddedPort || 8090);
    const imei = String(request.body.imei || session.state.imei);
    const transport = String(request.body.transport || 'tcp').toLowerCase();
    if (!/^\d{11,17}$/.test(imei)) return response.status(400).json({ error: 'IMEI must contain 11-17 digits.' });
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return response.status(400).json({ error: 'A valid host and port are required.' });
    if (!['tcp', 'udp'].includes(transport)) return response.status(400).json({ error: 'Transport must be tcp or udp.' });
    response.json({ state: await connectDevice(session, host, port, imei, transport) });
  } catch (error) { response.status(502).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.post('/simulator-api/disconnect', (request, response) => {
  const session = getSession(request);
  closeTransport(session);
  if (session.route.status === 'running') session.route.status = 'paused';
  response.json({ state: publicState(session) });
});
app.post('/simulator-api/settings', (request, response) => {
  const session = getSession(request);
  const numeric = ['latitude', 'longitude', 'speedKph', 'heading', 'fuelPercent', 'batteryVolts'];
  for (const key of numeric) if (request.body[key] !== undefined && Number.isFinite(Number(request.body[key]))) session.state[key] = Number(request.body[key]);
  response.json({ state: publicState(session) });
});
app.post('/simulator-api/sms', (request, response) => {
  const session = getSession(request);
  const command = String(request.body.command || '');
  const result = handleDeviceCommand(command, session.state);
  record(session, 'sms-in', 'sms-command', command);
  if (result.sendLocation) record(session, 'sms-out', 'sms-location', createLocationPacket(session.state));
  record(session, 'sms-out', 'sms-response', result.response);
  response.json({ ...result, state: publicState(session) });
});
app.post('/simulator-api/route/plan', async (request, response) => {
  const session = getSession(request);
  try {
    clearRouteTimer(session);
    const planned = await planRoute(String(request.body.start || ''), String(request.body.end || ''));
    session.route = { ...session.route, ...planned, prepared: prepareGeometry(planned.geometry), status: 'planned', progress: 0, elapsedSeconds: 0 };
    Object.assign(session.state, { latitude: planned.start.latitude, longitude: planned.start.longitude, speedKph: 0, heading: 0 });
    record(session, 'local', 'route-planned', `${planned.start.label} → ${planned.end.label}`);
    response.json({ state: publicState(session) });
  } catch (error) { response.status(502).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.post('/simulator-api/route/:operation', (request, response) => {
  const session = getSession(request);
  try {
    const operation = request.params.operation;
    if (operation === 'start') {
      if (!session.connected) throw new Error('Connect this simulator session before starting movement.');
      if (!session.route.prepared) throw new Error('Plan a route first.');
      session.route.playbackRate = [1, 10, 60].includes(Number(request.body.playbackRate)) ? Number(request.body.playbackRate) : 1;
      session.route.status = 'running';
      session.route.elapsedSeconds = 0;
      session.route.progress = 0;
      session.state.ignitionOn = true;
      emitRoutePosition(session);
      startRouteTimer(session);
    } else if (operation === 'pause' && session.route.status === 'running') {
      session.route.status = 'paused';
      clearRouteTimer(session);
      session.state.speedKph = 0;
    } else if (operation === 'resume' && session.route.status === 'paused') {
      session.route.status = 'running';
      startRouteTimer(session);
    } else if (operation === 'stop') {
      clearRouteTimer(session);
      session.route.status = 'stopped';
      session.state.speedKph = 0;
      session.state.ignitionOn = false;
    } else throw new Error(`Route operation “${operation}” is not available from the current state.`);
    record(session, 'local', `route-${operation}`, `${operation} · ${Math.round(session.route.progress * 100)}%`);
    response.json({ state: publicState(session) });
  } catch (error) { response.status(409).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.post('/simulator-api/action', (request, response) => {
  const session = getSession(request);
  const state = session.state;
  try {
    const action = String(request.body.action || '');
    if (action === 'login') write(session, `##,imei:${state.imei},A;`, 'login');
    else if (action === 'heartbeat') write(session, `##,imei:${state.imei},B;`, 'heartbeat');
    else if (action === 'position') write(session, createLocationPacket(state), 'position');
    else if (action === 'gpsLost') { state.validFix = false; write(session, createLocationPacket(state, 'tracker', { validFix: false }), 'gps-lost'); }
    else if (action === 'gpsFix') { state.validFix = true; write(session, createLocationPacket(state), 'gps-fix'); }
    else if (action in alarmTags) {
      if (action === 'lowBattery') state.batteryVolts = 3.52;
      if (action === 'powerCut') state.externalPower = false;
      if (action === 'door') state.doorOpen = true;
      write(session, createLocationPacket(state, alarmTags[action]), `alarm-${action}`);
    } else if (action === 'accOn' || action === 'accOff') { state.ignitionOn = action === 'accOn'; write(session, createLocationPacket(state, action === 'accOn' ? 'ACC on' : 'ACC off'), action); }
    else if (action === 'doorClose') { state.doorOpen = false; write(session, createLocationPacket(state), action); }
    else if (action === 'powerRestore') { state.externalPower = true; write(session, createLocationPacket(state), action); }
    else if (action === 'arm' || action === 'silent' || action === 'disarm' || action === 'stop' || action === 'quickstop' || action === 'resume') {
      const result = handleDeviceCommand(`${action}${state.password}`, state);
      record(session, 'local', 'state-change', `${action}: ${result.response}`);
    } else if (action === 'fuelEmpty') { state.fuelPercent = 0; write(session, createLocationPacket(state), action); }
    else if (action === 'fuelFull') { state.fuelPercent = 100; write(session, createLocationPacket(state), action); }
    else if (action === 'callPosition') { record(session, 'call-in', 'incoming-call', 'Authorized caller'); record(session, 'call-out', 'position-reply', createLocationPacket(state)); }
    else if (action === 'callListen') { state.callMode = 'listen'; record(session, 'call-in', 'listen-call', '15 second simulated listen session'); }
    else if (action === 'custom') write(session, String(request.body.raw || ''), 'custom');
    else return response.status(400).json({ error: `Unknown action: ${action}` });
    response.json({ state: publicState(session) });
  } catch (error) { response.status(409).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.listen(controlPort, '127.0.0.1', () => console.log(`303FG multi-session simulator listening on http://127.0.0.1:${controlPort}`));
