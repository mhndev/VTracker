import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCoordinateQuery, pointAlongGeometry, prepareGeometry } from '../route.mjs';

test('coordinate input accepts valid latitude and longitude pairs', () => {
  assert.deepEqual(parseCoordinateQuery('52.5200, 13.4050'), { latitude: 52.52, longitude: 13.405, label: '52.520000, 13.405000' });
  assert.equal(parseCoordinateQuery('Berlin'), null);
  assert.equal(parseCoordinateQuery('92, 13'), null);
});

test('route interpolation moves from start through the route to destination', () => {
  const route = prepareGeometry([[13.4, 52.5], [13.41, 52.51], [13.42, 52.52]]);
  const start = pointAlongGeometry(route, 0);
  const middle = pointAlongGeometry(route, .5);
  const end = pointAlongGeometry(route, 1);
  assert.ok(Math.abs(start.latitude - 52.5) < .000001);
  assert.ok(middle.latitude > start.latitude && middle.latitude < end.latitude);
  assert.ok(Math.abs(end.longitude - 13.42) < .000001);
  assert.ok(end.heading >= 0 && end.heading < 360);
});
