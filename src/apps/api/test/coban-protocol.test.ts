import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeCobanPacket,
  knotsToKph,
  nmeaToDecimalLat,
  nmeaToDecimalLon,
  parseStatusMask
} from '../src/telematics/decoder.js';
import { encodeCobanCommand } from '../src/telematics/encoder.js';

test('Coban Coordinate & Speed Conversions', () => {
  // Latitude: 52 deg 30.1234 min N
  const lat = nmeaToDecimalLat('5230.1234', 'N');
  assert.equal(lat, 52.502057);

  // Latitude South
  const latSouth = nmeaToDecimalLat('3351.5678', 'S');
  assert.equal(latSouth, -33.859463);

  // Longitude: 13 deg 23.5678 min E
  const lon = nmeaToDecimalLon('01323.5678', 'E');
  assert.equal(lon, 13.392797);

  // Longitude West
  const lonWest = nmeaToDecimalLon('07400.1234', 'W');
  assert.equal(lonWest, -74.002057);

  // Speed: 24.5 knots = 45.4 km/h
  const kph = knotsToKph('24.5');
  assert.equal(kph, 45.4);
});

test('Coban Status Bitmask Parsing', () => {
  // "10010000": ACC=ON, Armed=OFF, Immobilized=OFF, ExtPower=ON, Door=CLOSED
  const flags1 = parseStatusMask('10010000');
  assert.equal(flags1.ignitionOn, true);
  assert.equal(flags1.armed, false);
  assert.equal(flags1.immobilized, false);
  assert.equal(flags1.externalPower, true);
  assert.equal(flags1.doorOpen, false);

  // "01101000": ACC=OFF, Armed=ON, Immobilized=ON, ExtPower=OFF (battery), Door=OPEN
  const flags2 = parseStatusMask('01101000');
  assert.equal(flags2.ignitionOn, false);
  assert.equal(flags2.armed, true);
  assert.equal(flags2.immobilized, true);
  assert.equal(flags2.externalPower, false);
  assert.equal(flags2.doorOpen, true);
});

test('Decode Coban Login Handshake & Heartbeat Frames', () => {
  const login = decodeCobanPacket('##,imei:358123049582103,A;');
  assert.equal(login.type, 'LOGIN');
  if (login.type === 'LOGIN') {
    assert.equal(login.imei, '358123049582103');
  }

  const heartbeat = decodeCobanPacket('##,imei:358123049582103,B;');
  assert.equal(heartbeat.type, 'HEARTBEAT');
  if (heartbeat.type === 'HEARTBEAT') {
    assert.equal(heartbeat.imei, '358123049582103');
  }
});

test('Decode Coban Periodic Telemetry Frame', () => {
  const raw = 'imei:358123049582103,tracker,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,024.5,180.0,4.25,10010000,L,00000000,00000000,000;';
  const packet = decodeCobanPacket(raw);

  assert.equal(packet.type, 'LOCATION');
  if (packet.type === 'LOCATION') {
    assert.equal(packet.data.imei, '358123049582103');
    assert.equal(packet.data.validFix, true);
    assert.equal(packet.data.latitude, 52.502057);
    assert.equal(packet.data.longitude, 13.392797);
    assert.equal(packet.data.speedKph, 45.4);
    assert.equal(packet.data.heading, 180.0);
    assert.equal(packet.data.ignitionOn, true);
    assert.equal(packet.data.externalPower, true);
    assert.equal(packet.data.fuelPercent, 85.0); // 4.25V / 5.0V = 85%
  }
});

test('Rejects diagnostic frames that only resemble telemetry', () => {
  const packet = decodeCobanPacket('imei:869706067315228,tracker,invalid,,F,missing,A,0013.0000,N,00409.0000,E,0,0,0,1;');
  assert.equal(packet.type, 'UNKNOWN');
});

test('Decode Coban model and firmware identification response', () => {
  const packet = decodeCobanPacket('imei:869706067315228,vvt,303FG-251027-V5.3,303FG,V5.3,GSM;');
  assert.equal(packet.type, 'DEVICE_INFO');
  if (packet.type === 'DEVICE_INFO') {
    assert.equal(packet.imei, '869706067315228');
    assert.equal(packet.firmwareVersion, '303FG-251027-V5.3');
    assert.equal(packet.detectedModel, '303FG');
    assert.equal(packet.protocolVersion, 'V5.3');
    assert.equal(packet.variantVersion, 'GSM');
  }
});

test('Decode Coban Security & Hardware Alarms', () => {
  // SOS panic button
  const sos = decodeCobanPacket('imei:358123049582103,help!,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,024.5,180.0,0.00,10010000;');
  assert.equal(sos.type, 'ALARM');
  if (sos.type === 'ALARM') {
    assert.equal(sos.data.alarmType, 'SOS');
  }

  // ACC ignition tamper alarm
  const acc = decodeCobanPacket('imei:358123049582103,acc alarm,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,000.0,180.0,0.00,11010000;');
  assert.equal(acc.type, 'ALARM');
  if (acc.type === 'ALARM') {
    assert.equal(acc.data.alarmType, 'ACC_ALARM');
  }

  // Door breach alarm
  const door = decodeCobanPacket('imei:358123049582103,door alarm,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,000.0,180.0,0.00,01011000;');
  assert.equal(door.type, 'ALARM');
  if (door.type === 'ALARM') {
    assert.equal(door.data.alarmType, 'DOOR_ALARM');
  }

  // External main battery cut
  const powerOff = decodeCobanPacket('imei:358123049582103,power off,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,000.0,180.0,0.00,00000000;');
  assert.equal(powerOff.type, 'ALARM');
  if (powerOff.type === 'ALARM') {
    assert.equal(powerOff.data.alarmType, 'POWER_OFF');
  }

  // Low battery (< 3.55V)
  const lowBat = decodeCobanPacket('imei:358123049582103,low battery,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,000.0,180.0,0.00,00000000;');
  assert.equal(lowBat.type, 'ALARM');
  if (lowBat.type === 'ALARM') {
    assert.equal(lowBat.data.alarmType, 'LOW_BATTERY');
  }
});

test('Encode Downlink Vehicle Commands', () => {
  const pwd = '123456';

  // Remote engine immobilize (delayed and quick)
  assert.equal(encodeCobanCommand('STOP', { password: pwd }), `stop${pwd};\r\n`);
  assert.equal(encodeCobanCommand('QUICKSTOP', { password: pwd }), `quickstop${pwd};\r\n`);
  assert.equal(encodeCobanCommand('RESUME', { password: pwd }), `resume${pwd};\r\n`);

  // Arming & Disarming
  assert.equal(encodeCobanCommand('ARM', { password: pwd }), `arm${pwd};\r\n`);
  assert.equal(encodeCobanCommand('SILENT', { password: pwd }), `silent${pwd};\r\n`);
  assert.equal(encodeCobanCommand('DISARM', { password: pwd }), `disarm${pwd};\r\n`);

  // Diagnostic status & calibration
  assert.equal(encodeCobanCommand('CHECK', { password: pwd }), `check${pwd};\r\n`);
  assert.equal(encodeCobanCommand('OIL_ZERO', { password: pwd }), `oilzero${pwd};\r\n`);
  assert.equal(encodeCobanCommand('OIL_FULL', { password: pwd }), `oilfull${pwd};\r\n`);

  // Tracking interval
  assert.equal(
    encodeCobanCommand('FIX', { password: pwd, movingSeconds: '010s', stoppedHours: '001h', times: '***n' }),
    `fix010s001h***n${pwd};\r\n`
  );
});
