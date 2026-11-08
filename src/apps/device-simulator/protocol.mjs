export const DEFAULT_STATE = Object.freeze({
  imei: '358123049582103',
  password: '123456',
  latitude: 52.52,
  longitude: 13.405,
  speedKph: 35,
  heading: 90,
  fuelPercent: 85,
  batteryVolts: 3.95,
  validFix: true,
  ignitionOn: true,
  doorOpen: false,
  externalPower: true,
  armed: false,
  silentArmed: false,
  immobilized: false,
  workingMode: 'online',
  callMode: 'tracker',
  transport: 'tcp',
  apn: 'internet',
  serverHost: '127.0.0.1',
  serverPort: 8090,
  lowBatteryAlarm: true,
  externalPowerAlarm: true,
  accAlert: false,
  sensitivity: 2,
  moveRadius: 200,
  speedLimit: 80,
  reportInterval: '020s002h***n',
  alarmTimes: 1,
  authorizedNumbers: []
});

export function createDeviceState(overrides = {}) {
  return { ...DEFAULT_STATE, authorizedNumbers: [], ...overrides };
}

function utcParts(date = new Date()) {
  const value = date.toISOString().replace(/[-:TZ.]/g, '');
  return { date: value.slice(2, 8), time: `${value.slice(8, 14)}.000` };
}

function nmea(value, degreeWidth) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutes = ((absolute - degrees) * 60).toFixed(4).padStart(7, '0');
  return `${String(degrees).padStart(degreeWidth, '0')}${minutes}`;
}

export function createLocationPacket(state, tag = 'tracker', options = {}) {
  const { date, time } = utcParts(options.date);
  const latitude = nmea(state.latitude, 2);
  const longitude = nmea(state.longitude, 3);
  const latHemisphere = state.latitude >= 0 ? 'N' : 'S';
  const lonHemisphere = state.longitude >= 0 ? 'E' : 'W';
  const knots = (state.speedKph / 1.852).toFixed(1).padStart(5, '0');
  const heading = Number(state.heading).toFixed(1).padStart(5, '0');
  const fuelVoltage = ((state.fuelPercent / 100) * 5).toFixed(2);
  const status = `${state.ignitionOn ? 1 : 0}${state.armed ? 1 : 0}${state.immobilized ? 1 : 0}${state.externalPower ? 1 : 0}${state.doorOpen ? 1 : 0}000`;
  const fix = options.validFix === false || !state.validFix ? 'V' : 'A';
  return `imei:${state.imei},${tag},${date}${time.slice(0, 4)},,F,${time},${fix},${latitude},${latHemisphere},${longitude},${lonHemisphere},${knots},${heading},${fuelVoltage},${status},L,00000000,00000000,000;`;
}

export const alarmTags = Object.freeze({
  sos: 'help!',
  door: 'door alarm',
  acc: 'acc alarm',
  shock: 'sensor alarm',
  movement: 'move alarm',
  overspeed: 'speed alarm',
  fuel: 'oil alarm',
  lowBattery: 'low battery',
  powerCut: 'power off',
  geofence: 'move alarm'
});

function hasPassword(command, state) {
  return command.toLowerCase().includes(String(state.password).toLowerCase());
}

export function handleDeviceCommand(rawCommand, state) {
  const command = String(rawCommand).trim().replace(/[;\r\n]+$/g, '');
  const lower = command.toLowerCase();
  if (!command) return { response: '' };
  if (lower === 'load' || lower === 'on') return { response: '', accepted: true };

  const passwordChange = command.match(/^password([^\s]{6})\s+([^\s]{6})$/i);
  if (passwordChange) {
    if (passwordChange[1] !== state.password) return { response: 'password fail!' };
    state.password = passwordChange[2];
    return { response: 'password ok' };
  }
  if (!hasPassword(command, state)) return { response: 'password fail!' };

  const pwd = state.password.toLowerCase();
  const suffix = lower.indexOf(pwd);
  const name = suffix >= 0 ? lower.slice(0, suffix) : lower;
  const args = suffix >= 0 ? command.slice(suffix + state.password.length).trim().split(/\s+/).filter(Boolean) : [];

  if (name === 'begin') {
    Object.assign(state, createDeviceState({ imei: state.imei, serverHost: state.serverHost, serverPort: state.serverPort }));
    return { response: 'begin ok' };
  }
  if (name === 'admin') { if (args[0] && !state.authorizedNumbers.includes(args[0])) state.authorizedNumbers.push(args[0]); return { response: 'admin ok' }; }
  if (name === 'noadmin') { state.authorizedNumbers = state.authorizedNumbers.filter(number => number !== args[0]); return { response: 'no admin ok' }; }
  if (name === 'position') return { response: 'position ok', sendLocation: true };
  if (name === 'online') { state.workingMode = 'online'; return { response: 'online ok' }; }
  if (name === 'sleep') { state.workingMode = 'sleep'; return { response: 'sleep ok' }; }
  if (name === 'fix') { state.reportInterval = command.slice(3, suffix); return { response: 'fix ok' }; }
  if (name === 'nofix') { state.reportInterval = 'off'; return { response: 'nofix ok' }; }
  if (name === 'stop' || name === 'quickstop') { state.immobilized = true; state.speedKph = 0; return { response: `${name} ok` }; }
  if (name === 'resume') { state.immobilized = false; return { response: 'resume ok' }; }
  if (name === 'arm') {
    if (state.ignitionOn) return { response: 'set up fail! pls turn off ACC' };
    state.armed = true; state.silentArmed = false; return { response: 'Tracker is activated' };
  }
  if (name === 'silent') { state.armed = true; state.silentArmed = true; return { response: 'silent ok!' }; }
  if (name === 'disarm') { state.armed = false; state.silentArmed = false; return { response: 'Tracker is deactivated' }; }
  if (name === 'sensitivity') { state.sensitivity = Number(args[0]) || 2; return { response: 'sensitivity ok' }; }
  if (name === 'lowbattery') { state.lowBatteryAlarm = args[0]?.toLowerCase() !== 'off'; return { response: state.lowBatteryAlarm ? 'low battery on ok' : 'low-battery off ok' }; }
  if (name === 'extpower') { state.externalPowerAlarm = args[0]?.toLowerCase() !== 'off'; return { response: `ext power ${state.externalPowerAlarm ? 'on' : 'off'} ok` }; }
  if (name === 'move') { state.moveRadius = Number(args[0]) || 200; return { response: 'move ok' }; }
  if (name === 'nomove') { state.moveRadius = 0; return { response: 'nomove ok' }; }
  if (name === 'speed') { state.speedLimit = Number(args[0]) || 80; return { response: 'speed ok' }; }
  if (name === 'nospeed') { state.speedLimit = 0; return { response: 'no speed ok' }; }
  if (name === 'oilzero') { state.fuelPercent = 0; return { response: 'oilzero ok!' }; }
  if (name === 'oilfull') { state.fuelPercent = 100; return { response: 'Oil full ok!' }; }
  if (name === 'xtime') { state.alarmTimes = Number(command.slice(5, suffix)) || 1; return { response: 'xtime ok!' }; }
  if (name === 'listen') { state.callMode = 'listen'; return { response: 'listen ok' }; }
  if (name === 'tracker') { state.callMode = 'tracker'; return { response: 'tracker ok' }; }
  if (name === 'acc') { state.accAlert = true; return { response: 'ACC ok' }; }
  if (name === 'noacc') { state.accAlert = false; return { response: 'noACC ok' }; }
  if (name === 'balance') return { response: `Balance request forwarded to ${args[0] || 'operator'}` };
  if (name === 'forward') return { response: 'forward ok' };
  if (name === 'check') return { response: `Battery: ${state.batteryVolts.toFixed(2)}V, GPS: ${state.validFix ? 'strong' : 'no fix'}, GSM: strong, GPRS: ${state.transport === 'sms' ? 'OFF' : 'OK'}, APN: ${state.apn}, IP: ${state.serverHost}, Port: ${state.serverPort}` };
  if (name === 'imei') return { response: `imei:${state.imei}` };
  if (name === 'time') return { response: 'time ok' };
  if (name === 'reset') return { response: 'reset ok' };
  if (name === 'apn') { state.apn = args[0] || state.apn; return { response: 'apn ok' }; }
  if (name === 'up') return { response: 'up ok' };
  if (name === 'adminip' || name === 'dns') { state.serverHost = args[0] || state.serverHost; state.serverPort = Number(args[1]) || state.serverPort; return { response: 'adminip ok' }; }
  if (name === 'tcp' || name === 'udp') { state.transport = name; return { response: `${name} ok` }; }
  if (name === 'sms') { state.transport = 'sms'; return { response: 'sms ok' }; }
  if (name === 'gprs') { state.transport = 'tcp'; return { response: 'GPRS ok' }; }
  return { response: `${command} ok` };
}
