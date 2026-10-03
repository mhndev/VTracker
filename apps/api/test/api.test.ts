import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase } from '../src/database/connection.js';
import { initializeDatabase } from '../src/database/index.js';

const app = createApp();

before(async () => { await initializeDatabase(true); });
after(async () => { await closeDatabase(); });

test('health endpoint is public and commands are disabled', async () => {
  const response = await supertest(app).get('/api/health').expect(200);
  assert.equal(response.body.highRiskCommandsEnabled, false);
});

test('customer receives all owned vehicle coordinates', async () => {
  const response = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(response.body.accessMode, 'member');
  assert.equal(response.body.stats.locationVisible, 4);
});

test('reseller receives only specifically granted location', async () => {
  const response = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-reseller-support').expect(200);
  assert.equal(response.body.accessMode, 'service');
  assert.equal(response.body.stats.locationVisible, 1);
  assert.equal(response.body.vehicles.filter((vehicle: { location?: unknown }) => vehicle.location).length, 1);
});

test('platform admin endpoint rejects customer actor', async () => {
  await supertest(app).get('/api/admin/overview').set('x-demo-actor', 'user-customer-admin').expect(403);
});

test('platform overview contains no coordinate fields', async () => {
  const response = await supertest(app).get('/api/admin/overview').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.equal(/latitude|longitude/.test(JSON.stringify(response.body)), false);
});

test('reseller cannot create location grants', async () => {
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-reseller-support').send({ organizationId: 'org-customer', vehicleId: 'vehicle-2', durationHours: 2, purpose: 'Unauthorized attempt' }).expect(403);
});

test('grant creation rejects malformed bodies with a client error', async () => {
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ vehicleId: 'vehicle-2', durationHours: 2, purpose: 'Missing organization id' }).expect(400);
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ organizationId: 'org-customer', durationHours: 2, purpose: 'Missing vehicle id' }).expect(400);
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ organizationId: 'org-customer', vehicleId: 'vehicle-private', durationHours: 2, purpose: 'Cross tenant attempt' }).expect(400);
});

test('cross-tenant location views are audited for the owning customer', async () => {
  await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-reseller-support').expect(200);
  const audit = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const viewed = audit.body.filter((event: { action: string; actorId: string }) => event.action === 'LOCATION_VIEWED' && event.actorId === 'user-reseller-support');
  assert.ok(viewed.length >= 1, 'expected a LOCATION_VIEWED audit event for the reseller support actor');
  assert.deepEqual([...new Set(viewed.map((event: { resourceId: string }) => event.resourceId))], ['vehicle-1']);
});

test('owning-organization members do not generate location audit noise', async () => {
  const before = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const countBefore = before.body.filter((event: { action: string }) => event.action === 'LOCATION_VIEWED').length;
  await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const after = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const countAfter = after.body.filter((event: { action: string }) => event.action === 'LOCATION_VIEWED').length;
  assert.equal(countAfter, countBefore);
});

test('customer can create and then revoke a location grant', async () => {
  const created = await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ organizationId: 'org-customer', vehicleId: 'vehicle-2', durationHours: 2, purpose: 'Diagnose reporting gap NT-311' }).expect(201);
  assert.equal(created.body.granteeOrganizationId, 'org-reseller');
  const grants = await supertest(app).get('/api/grants?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(grants.body.find((grant: { id: string }) => grant.id === created.body.id).granteeOrganizationName, 'NordTrack Services');
  await supertest(app).delete(`/api/grants/${created.body.id}`).set('x-demo-actor', 'user-customer-admin').expect(204);
});
