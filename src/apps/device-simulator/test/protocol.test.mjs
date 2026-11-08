import assert from 'node:assert/strict';
import test from 'node:test';
import { alarmTags, createDeviceState, createLocationPacket, handleDeviceCommand } from '../protocol.mjs';

test('creates GPS103 position and every alarm packet', () => {
  const state = createDeviceState();
  const position = createLocationPacket(state);
  assert.match(position, /^imei:358123049582103,tracker,/);
  assert.match(position, /,A,5231\.2000,N,01324\.3000,E,/);
  for (const tag of Object.values(alarmTags)) assert.match(createLocationPacket(state, tag), new RegExp(`,${tag.replace(/[!]/g, '\\$&')},`));
});

test('supports the documented SMS command families', () => {
  const state = createDeviceState({ ignitionOn: false });
  const commands = [
    'admin123456 +491701234567', 'noadmin123456 +491701234567', 'position123456', 'online123456', 'sleep123456',
    'fix020s002h***n123456', 'nofix123456', 'stop123456', 'quickstop123456', 'resume123456', 'arm123456',
    'silent123456', 'disarm123456', 'sensitivity123456 3', 'lowbattery123456 off', 'lowbattery123456 on',
    'extpower123456 off', 'extpower123456 on', 'move123456 200', 'nomove123456', 'speed123456 80', 'nospeed123456',
    'oilzero123456', 'oilfull123456', 'xtime1234563', 'listen123456', 'tracker123456', 'ACC123456', 'noACC123456',
    'balance123456 100 *100#', 'forward123456 100', 'check123456', 'imei123456', 'time zone123456 +1', 'reset123456',
    'apn123456 internet', 'up123456 user pass', 'adminip123456 1.tcp.ngrok.io 12345', 'tcp123456', 'udp123456',
    'SMS123456', 'gprs123456', 'begin123456'
  ];
  for (const command of commands) assert.ok(handleDeviceCommand(command, state).response, command);
});

test('applies safety and state changes while remaining a simulation', () => {
  const state = createDeviceState({ ignitionOn: true });
  assert.match(handleDeviceCommand('arm123456', state).response, /fail/i);
  state.ignitionOn = false;
  assert.equal(handleDeviceCommand('arm123456', state).response, 'Tracker is activated');
  handleDeviceCommand('stop123456', state);
  assert.equal(state.immobilized, true);
  assert.equal(state.speedKph, 0);
  handleDeviceCommand('resume123456', state);
  assert.equal(state.immobilized, false);
});
