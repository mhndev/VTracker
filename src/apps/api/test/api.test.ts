import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase } from '../src/database/connection.js';
import { initializeDatabase } from '../src/database/index.js';
import { AuditEvent, Organization, ServiceRelationship } from '../src/models/index.js';
import { persistTelematicsMessage, processLocationUpdate } from '../src/telematics/ingestion.js';
import { evictExpiredLogs } from '../src/services/retention.service.js';

const app = createApp();

before(async () => { await initializeDatabase(true); });
after(async () => { await closeDatabase(); });

test('health endpoint is public and commands are disabled', async () => {
  const response = await supertest(app).get('/api/health').expect(200);
  assert.equal(response.body.highRiskCommandsEnabled, false);
});

test('protocol catalog exposes active and researched device families with messages and commands', async () => {
  const response = await supertest(app)
    .get('/api/telematics/protocols')
    .set('x-demo-actor', 'user-customer-admin')
    .expect(200);
  assert.equal(response.body.count, 4);
  const coban = response.body.profiles.find((profile: { id: string }) => profile.id === 'protocol-coban-gps103');
  assert.equal(coban.implementationStatus, 'ACTIVE');
  assert.ok(coban.messageDefinitions.some((definition: { messageType: string }) => definition.messageType === 'STATUS_SYNC'));
  assert.ok(coban.commandDefinitions.some((definition: { commandKey: string }) => definition.commandKey === 'DEVICE_INFO'));
  const teltonika = response.body.profiles.find((profile: { id: string }) => profile.id === 'protocol-teltonika-codec8');
  assert.equal(teltonika.implementationStatus, 'CATALOG_ONLY');
  const queclink = response.body.profiles.find((profile: { id: string }) => profile.id === 'protocol-queclink-gv300');
  assert.equal(queclink.implementationStatus, 'CATALOG_ONLY');
});

test('platform admins manage reseller device-family availability', async () => {
  await supertest(app).get('/api/admin/device-catalog').set('x-demo-actor', 'user-customer-admin').expect(403);
  const catalog = await supertest(app).get('/api/admin/device-catalog').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.equal(catalog.body.profiles.length, 4);
  assert.equal(catalog.body.resellers[0].id, 'org-reseller');
  assert.equal(catalog.body.availability.find((item: { protocolProfileId: string }) => item.protocolProfileId === 'protocol-coban-gps103').available, true);

  const changed = await supertest(app)
    .put('/api/admin/device-catalog/resellers/org-reseller/protocols/protocol-teltonika-codec8')
    .set('x-demo-actor', 'user-platform-support')
    .send({ available: true })
    .expect(200);
  assert.equal(changed.body.available, true);
});

test('customer receives all owned vehicle coordinates', async () => {
  const response = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(response.body.accessMode, 'member');
  assert.equal(response.body.stats.locationVisible, 4);
});

test('vehicle message logs are scoped to actors with location access', async () => {
  await persistTelematicsMessage({
    id: 'inbound-test',
    imei: '358123049582103',
    direction: 'INBOUND',
    kind: 'LOCATION',
    recordedAt: new Date(Date.now() - 1000),
    raw: 'imei:358123049582103,status,123456;'
  });
  await persistTelematicsMessage({
    id: 'outbound-test',
    imei: '358123049582103',
    vehicleId: 'vehicle-1',
    actorId: 'user-customer-admin',
    direction: 'OUTBOUND',
    kind: 'COMMAND',
    recordedAt: new Date(),
    raw: 'check123456;\r\n'
  });

  const customer = await supertest(app)
    .get('/api/telematics/vehicles/vehicle-1/messages')
    .set('x-demo-actor', 'user-customer-admin')
    .expect(200);
  assert.equal(customer.body.imei, '358123049582103');
  assert.equal(customer.body.messages[0].direction, 'OUTBOUND');
  assert.equal(customer.body.messages[0].actorId, 'user-customer-admin');
  assert.equal(customer.body.messages[0].raw, 'check••••••;');
  assert.equal(customer.body.messages[1].kind, 'LOCATION');
  assert.equal(customer.body.messages[1].raw, 'imei:358123049582103,status,••••••;');

  await supertest(app)
    .get('/api/telematics/vehicles/vehicle-2/messages')
    .set('x-demo-actor', 'user-reseller-support')
    .expect(403);
  await supertest(app)
    .get('/api/telematics/vehicles/vehicle-1/messages')
    .set('x-demo-actor', 'user-platform-support')
    .expect(403);
});

test('vehicle details persist decoded state and split trips after a five-minute stop', async () => {
  const base = Date.now() - 10 * 60_000;
  const location = (occurredAt: Date, speedKph: number, latitude: number) => ({
    imei: '358123049582103',
    occurredAt,
    validFix: true,
    latitude,
    longitude: 13.4095,
    speedKph,
    heading: 90,
    fuelPercent: 64,
    ignitionOn: speedKph > 0,
    doorOpen: false,
    externalPower: true,
    armed: false,
    immobilized: false,
    rawStatusMask: '10010000'
  });
  await processLocationUpdate(location(new Date(base), 30, 52.5208));
  await processLocationUpdate(location(new Date(base + 4 * 60_000), 0, 52.5218));
  await processLocationUpdate(location(new Date(base + 10 * 60_000), 0, 52.5218));
  await processLocationUpdate(location(new Date(base + 10 * 60_000 + 1000), 25, 52.5228));

  const response = await supertest(app)
    .get('/api/telematics/vehicles/vehicle-1/details')
    .set('x-demo-actor', 'user-customer-admin')
    .expect(200);
  assert.equal(response.body.connection.online, true);
  assert.equal(response.body.state.fuelPercent, 64);
  assert.equal(response.body.state.doorOpen, false);
  assert.equal(response.body.motion.moving, true);
  assert.equal(response.body.trips.length, 2);
  assert.equal(response.body.trips[0].status, 'IN_PROGRESS');
  assert.equal(response.body.trips[1].status, 'COMPLETED');

  for (let index = 0; index < 105; index += 1) {
    await processLocationUpdate(location(new Date(base + 11 * 60_000 + index * 1000), 25, 52.5228 + index * 0.00001));
  }
  const sampled = await supertest(app)
    .get('/api/telematics/vehicles/vehicle-1/details')
    .set('x-demo-actor', 'user-customer-admin')
    .expect(200);
  assert.equal(sampled.body.trips[0].pathPoints.length, 100);
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

test('retention configuration exposes four capacity tiers and supports customer assignment', async () => {
  await supertest(app).get('/api/admin/retention').set('x-demo-actor', 'user-customer-admin').expect(403);
  const policies = await supertest(app).get('/api/admin/retention').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.deepEqual(policies.body.map((policy: { logRetentionDays: number }) => policy.logRetentionDays), [30, 183, 365, 1826]);
  assert.ok(policies.body.every((policy: { estimatedRetainedLogBytesPerVehicle: number; estimatedMonthlyTripGrowthBytesPerVehicle: number }) => policy.estimatedRetainedLogBytesPerVehicle > 0 && policy.estimatedMonthlyTripGrowthBytesPerVehicle > 0));

  const assignment = await supertest(app)
    .put('/api/admin/retention/organizations/org-customer')
    .set('x-demo-actor', 'user-platform-support')
    .send({ retentionPolicyId: 'retention-6-months' })
    .expect(200);
  assert.equal(assignment.body.retentionPolicyId, 'retention-6-months');
  assert.equal(assignment.body.policy.logRetentionDays, 183);

  await persistTelematicsMessage({
    id: 'expired-log',
    imei: '358123049582103',
    vehicleId: 'vehicle-1',
    actorId: 'user-customer-admin',
    direction: 'OUTBOUND',
    kind: 'COMMAND',
    recordedAt: new Date(Date.now() - 200 * 24 * 60 * 60_000),
    raw: 'expired-retention-test'
  });
  const beforeCleanup = await supertest(app).get('/api/telematics/vehicles/vehicle-1/details').set('x-demo-actor', 'user-customer-admin').expect(200);
  await evictExpiredLogs();
  const logs = await supertest(app).get('/api/telematics/vehicles/vehicle-1/messages').set('x-demo-actor', 'user-customer-admin').expect(200);
  const afterCleanup = await supertest(app).get('/api/telematics/vehicles/vehicle-1/details').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.ok(!logs.body.messages.some((message: { raw: string }) => message.raw === 'expired-retention-test'));
  assert.equal(afterCleanup.body.trips.length, beforeCleanup.body.trips.length);
});

test('platform organization membership alone does not grant the platform support role', async () => {
  await supertest(app).get('/api/admin/overview').set('x-demo-actor', 'user-platform-viewer').expect(403);
  await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-platform-viewer').expect(403);
});

test('session provisioning policy exposes only role-scoped creation and management capabilities', async () => {
  const platform = await supertest(app).get('/api/session').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.equal(platform.body.provisioningCapabilities.createResellers, true);
  assert.deepEqual(platform.body.provisioningCapabilities.createCustomersForResellerIds, []);
  assert.deepEqual(platform.body.provisioningCapabilities.manageVehiclesForCustomerIds, []);
  assert.deepEqual(platform.body.provisioningCapabilities.manageDeviceAssignmentsForCustomerIds, []);
  assert.equal(platform.body.provisioningCapabilities.platformCustomerLocationAccess, 'NONE');

  const platformViewer = await supertest(app).get('/api/session').set('x-demo-actor', 'user-platform-viewer').expect(200);
  assert.equal(platformViewer.body.provisioningCapabilities.createResellers, false);

  const resellerAdmin = await supertest(app).get('/api/session').set('x-demo-actor', 'user-reseller-admin').expect(200);
  assert.equal(resellerAdmin.body.provisioningCapabilities.createResellers, false);
  assert.deepEqual(resellerAdmin.body.provisioningCapabilities.createCustomersForResellerIds, ['org-reseller']);
  assert.deepEqual(resellerAdmin.body.provisioningCapabilities.manageVehiclesForCustomerIds, ['org-customer']);
  assert.deepEqual(resellerAdmin.body.provisioningCapabilities.manageDeviceAssignmentsForCustomerIds, ['org-customer']);

  const resellerSupport = await supertest(app).get('/api/session').set('x-demo-actor', 'user-reseller-support').expect(200);
  assert.deepEqual(resellerSupport.body.provisioningCapabilities.createCustomersForResellerIds, []);
  assert.deepEqual(resellerSupport.body.provisioningCapabilities.manageVehiclesForCustomerIds, []);

  const customerAdmin = await supertest(app).get('/api/session').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(customerAdmin.body.provisioningCapabilities.createResellers, false);
  assert.deepEqual(customerAdmin.body.provisioningCapabilities.createCustomersForResellerIds, []);
  assert.deepEqual(customerAdmin.body.provisioningCapabilities.manageVehiclesForCustomerIds, ['org-customer']);
  assert.deepEqual(customerAdmin.body.provisioningCapabilities.manageDeviceAssignmentsForCustomerIds, ['org-customer']);
});

test('platform overview contains no coordinate fields', async () => {
  const response = await supertest(app).get('/api/admin/overview').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.equal(/latitude|longitude/.test(JSON.stringify(response.body)), false);
});

test('platform support can create, list, and update a reseller with audited capabilities', async () => {
  const created = await supertest(app).post('/api/admin/resellers').set('x-demo-actor', 'user-platform-support').send({
    name: 'Pars Fleet Services',
    defaultLocale: 'fa',
    status: 'ACTIVE',
    capabilities: ['CUSTOMER_PROVISION', 'SUPPORT_OPERATIONS']
  }).expect(201);
  assert.match(created.body.id, /^org-reseller-/);
  assert.equal(created.body.defaultLocale, 'fa');
  assert.equal(created.body.status, 'ACTIVE');
  assert.deepEqual(created.body.capabilities, ['CUSTOMER_PROVISION', 'SUPPORT_OPERATIONS']);
  assert.equal(/latitude|longitude|messageContent/.test(JSON.stringify(created.body)), false);

  const listed = await supertest(app).get('/api/admin/resellers').set('x-demo-actor', 'user-platform-support').expect(200);
  const listedReseller = listed.body.find((item: { id: string }) => item.id === created.body.id);
  assert.equal(listedReseller.name, 'Pars Fleet Services');
  assert.equal(listedReseller.customerCount, 0);
  assert.equal(/latitude|longitude|messageContent/.test(JSON.stringify(listed.body)), false);

  const updated = await supertest(app).patch(`/api/admin/resellers/${created.body.id}`).set('x-demo-actor', 'user-platform-support').send({
    name: 'Pars Fleet Operations',
    status: 'SUSPENDED',
    capabilities: ['SUPPORT_OPERATIONS']
  }).expect(200);
  assert.equal(updated.body.name, 'Pars Fleet Operations');
  assert.equal(updated.body.status, 'SUSPENDED');
  assert.deepEqual(updated.body.capabilities, ['SUPPORT_OPERATIONS']);

  const overview = await supertest(app).get('/api/admin/overview').set('x-demo-actor', 'user-platform-support').expect(200);
  const mutations = overview.body.recentAudit.filter((event: { resourceId: string }) => event.resourceId === created.body.id);
  assert.deepEqual(new Set(mutations.map((event: { action: string }) => event.action)), new Set([
    'DELEGATED_CAPABILITIES_CHANGED',
    'RESELLER_LIFECYCLE_CHANGED',
    'RESELLER_UPDATED',
    'RESELLER_CREATED'
  ]));
  assert.equal(/latitude|longitude/.test(JSON.stringify(overview.body)), false);
});

test('reseller provisioning validates input and denies non-platform actors', async () => {
  const valid = { name: 'Denied Reseller', defaultLocale: 'en', status: 'ACTIVE', capabilities: ['CUSTOMER_PROVISION'] };
  const viewerDenied = await supertest(app).post('/api/admin/resellers').set('x-demo-actor', 'user-platform-viewer').send(valid).expect(403);
  assert.equal(viewerDenied.body.error.code, 'RESELLER_PROVISIONING_DENIED');
  await supertest(app).get('/api/admin/resellers').set('x-demo-actor', 'user-reseller-admin').expect(403);
  await supertest(app).patch('/api/admin/resellers/org-reseller').set('x-demo-actor', 'user-customer-admin').send({ status: 'SUSPENDED' }).expect(403);

  const invalidLocale = await supertest(app).post('/api/admin/resellers').set('x-demo-actor', 'user-platform-support').send({ ...valid, defaultLocale: 'de' }).expect(400);
  assert.equal(invalidLocale.body.error.code, 'INVALID_RESELLER');
  const invalidStatus = await supertest(app).post('/api/admin/resellers').set('x-demo-actor', 'user-platform-support').send({ ...valid, status: 'DELETED' }).expect(400);
  assert.equal(invalidStatus.body.error.code, 'INVALID_RESELLER');
  const invalidCapability = await supertest(app).post('/api/admin/resellers').set('x-demo-actor', 'user-platform-support').send({ ...valid, capabilities: ['LOCATION_CURRENT'] }).expect(400);
  assert.equal(invalidCapability.body.error.code, 'INVALID_RESELLER');
});

test('suspending a reseller removes its customer-provisioning authority', async () => {
  await supertest(app).patch('/api/admin/resellers/org-reseller').set('x-demo-actor', 'user-platform-support').send({ status: 'SUSPENDED' }).expect(200);
  const suspendedSession = await supertest(app).get('/api/session').set('x-demo-actor', 'user-reseller-admin').expect(200);
  assert.deepEqual(suspendedSession.body.provisioningCapabilities.createCustomersForResellerIds, []);
  assert.deepEqual(suspendedSession.body.provisioningCapabilities.manageVehiclesForCustomerIds, []);
  assert.deepEqual(suspendedSession.body.provisioningCapabilities.manageDeviceAssignmentsForCustomerIds, []);
  await supertest(app).patch('/api/admin/resellers/org-reseller').set('x-demo-actor', 'user-platform-support').send({ status: 'ACTIVE' }).expect(200);
  const restoredSession = await supertest(app).get('/api/session').set('x-demo-actor', 'user-reseller-admin').expect(200);
  assert.deepEqual(restoredSession.body.provisioningCapabilities.createCustomersForResellerIds, ['org-reseller']);
  assert.deepEqual(restoredSession.body.provisioningCapabilities.manageVehiclesForCustomerIds, ['org-customer']);
  assert.deepEqual(restoredSession.body.provisioningCapabilities.manageDeviceAssignmentsForCustomerIds, ['org-customer']);
});

test('reseller admin can transactionally create, list, and update customers in its own scope', async () => {
  const created = await supertest(app).post('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-reseller-admin').send({
    name: 'Tehran Field Services',
    defaultLocale: 'fa',
    timezone: 'Asia/Tehran',
    status: 'ACTIVE'
  }).expect(201);
  assert.match(created.body.id, /^org-customer-/);
  assert.equal(created.body.defaultLocale, 'fa');
  assert.equal(created.body.timezone, 'Asia/Tehran');
  assert.equal(created.body.status, 'ACTIVE');
  assert.equal(created.body.serviceRelationship.status, 'ACTIVE');
  assert.equal(/password|token|invite|latitude|longitude|messageContent/i.test(JSON.stringify(created.body)), false);

  const [storedCustomer, storedRelationship] = await Promise.all([
    Organization.findByPk(created.body.id),
    ServiceRelationship.findByPk(created.body.serviceRelationship.id)
  ]);
  assert.equal(storedCustomer?.type, 'CUSTOMER');
  assert.equal(storedCustomer?.timezone, 'Asia/Tehran');
  assert.equal(storedRelationship?.resellerOrganizationId, 'org-reseller');
  assert.equal(storedRelationship?.customerOrganizationId, created.body.id);

  const listed = await supertest(app).get('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-reseller-admin').expect(200);
  assert.equal(listed.body.some((customer: { id: string }) => customer.id === created.body.id), true);
  assert.equal(/latitude|longitude|messageContent/i.test(JSON.stringify(listed.body)), false);

  const updated = await supertest(app).patch(`/api/resellers/org-reseller/customers/${created.body.id}`).set('x-demo-actor', 'user-reseller-admin').send({
    name: 'Tehran Fleet Operations',
    defaultLocale: 'en',
    timezone: 'Europe/Berlin',
    status: 'SUSPENDED'
  }).expect(200);
  assert.equal(updated.body.name, 'Tehran Fleet Operations');
  assert.equal(updated.body.defaultLocale, 'en');
  assert.equal(updated.body.timezone, 'Europe/Berlin');
  assert.equal(updated.body.status, 'SUSPENDED');

  const audits = await AuditEvent.findAll({ where: { actorId: 'user-reseller-admin' } });
  const relevantActions = new Set(audits
    .filter(event => event.resourceId === created.body.id || event.resourceId === created.body.serviceRelationship.id)
    .map(event => event.action));
  assert.deepEqual(relevantActions, new Set(['CUSTOMER_CREATED', 'SERVICE_RELATIONSHIP_CREATED', 'CUSTOMER_UPDATED']));
});

test('customer provisioning validates input and rejects unauthorized or cross-reseller mutations', async () => {
  const valid = { name: 'Scoped Customer', defaultLocale: 'en', timezone: 'Europe/Berlin', status: 'ACTIVE' };
  const supportDenied = await supertest(app).post('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-reseller-support').send(valid).expect(403);
  assert.equal(supportDenied.body.error.code, 'CUSTOMER_PROVISIONING_DENIED');
  await supertest(app).get('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-customer-admin').expect(403);
  await supertest(app).post('/api/resellers/org-other-reseller/customers').set('x-demo-actor', 'user-reseller-admin').send(valid).expect(403);
  const crossReseller = await supertest(app).patch('/api/resellers/org-other-reseller/customers/org-customer').set('x-demo-actor', 'user-reseller-admin').send({ name: 'Hijacked Customer' }).expect(403);
  assert.equal(crossReseller.body.error.code, 'CUSTOMER_SETTINGS_DENIED');

  const invalidTimezone = await supertest(app).post('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-reseller-admin').send({ ...valid, timezone: 'Mars/Olympus' }).expect(400);
  assert.equal(invalidTimezone.body.error.code, 'INVALID_CUSTOMER');
  const invalidLocale = await supertest(app).post('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-reseller-admin').send({ ...valid, defaultLocale: 'de' }).expect(400);
  assert.equal(invalidLocale.body.error.code, 'INVALID_CUSTOMER');
  const invalidStatus = await supertest(app).post('/api/resellers/org-reseller/customers').set('x-demo-actor', 'user-reseller-admin').send({ ...valid, status: 'DELETED' }).expect(400);
  assert.equal(invalidStatus.body.error.code, 'INVALID_CUSTOMER');
});

test('platform support never receives customer coordinates through an operational dashboard', async () => {
  const response = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.equal(response.body.accessMode, 'platform');
  assert.equal(response.body.stats.locationVisible, 0);
  assert.equal(/latitude|longitude/.test(JSON.stringify(response.body)), false);
});

test('session and settings expose the effective organization locale', async () => {
  const session = await supertest(app).get('/api/session').set('x-demo-actor', 'user-customer-admin').expect(200);
  const customerScope = session.body.scopes.find((scope: { id: string }) => scope.id === 'org-customer');
  assert.equal(session.body.effectiveLocale, 'en');
  assert.equal(customerScope.defaultLocale, 'en');
  assert.equal(customerScope.effectiveLocale, 'en');
  const settings = await supertest(app).get('/api/organizations/org-customer/settings').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.deepEqual(settings.body, { organizationId: 'org-customer', defaultLocale: 'en', effectiveLocale: 'en' });
});

test('customer organization admin can persist locale and the change is audited', async () => {
  const updated = await supertest(app).patch('/api/organizations/org-customer/settings').set('x-demo-actor', 'user-customer-admin').send({ defaultLocale: 'fa' }).expect(200);
  assert.deepEqual(updated.body, { organizationId: 'org-customer', defaultLocale: 'fa', effectiveLocale: 'fa' });
  const session = await supertest(app).get('/api/session').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(session.body.effectiveLocale, 'fa');
  assert.equal(session.body.scopes.find((scope: { id: string }) => scope.id === 'org-customer').effectiveLocale, 'fa');
  const audit = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const localeChange = audit.body.find((event: { action: string; resourceId: string }) => event.action === 'ORGANIZATION_LOCALE_CHANGED' && event.resourceId === 'org-customer');
  assert.deepEqual(localeChange.details, { previousLocale: 'en', defaultLocale: 'fa' });
});

test('platform support can update a reseller locale', async () => {
  const updated = await supertest(app).patch('/api/organizations/org-reseller/settings').set('x-demo-actor', 'user-platform-support').send({ defaultLocale: 'fa' }).expect(200);
  assert.equal(updated.body.defaultLocale, 'fa');
  const settings = await supertest(app).get('/api/organizations/org-reseller/settings').set('x-demo-actor', 'user-platform-support').expect(200);
  assert.equal(settings.body.effectiveLocale, 'fa');
  const session = await supertest(app).get('/api/session').set('x-demo-actor', 'user-reseller-support').expect(200);
  assert.equal(session.body.effectiveLocale, 'fa');
});

test('organization locale validation and cross-tenant authorization are enforced', async () => {
  const invalid = await supertest(app).patch('/api/organizations/org-customer/settings').set('x-demo-actor', 'user-customer-admin').send({ defaultLocale: 'de' }).expect(400);
  assert.equal(invalid.body.error.code, 'INVALID_ORGANIZATION_SETTINGS');
  const resellerDenied = await supertest(app).patch('/api/organizations/org-customer/settings').set('x-demo-actor', 'user-reseller-support').send({ defaultLocale: 'en' }).expect(403);
  assert.equal(resellerDenied.body.error.code, 'ORGANIZATION_SETTINGS_UPDATE_DENIED');
  const crossTenantRead = await supertest(app).get('/api/organizations/org-private/settings').set('x-demo-actor', 'user-customer-admin').expect(403);
  assert.equal(crossTenantRead.body.error.code, 'ORGANIZATION_SETTINGS_READ_DENIED');
  const platformViewerDenied = await supertest(app).patch('/api/organizations/org-reseller/settings').set('x-demo-actor', 'user-platform-viewer').send({ defaultLocale: 'en' }).expect(403);
  assert.equal(platformViewerDenied.body.error.code, 'ORGANIZATION_SETTINGS_UPDATE_DENIED');
});

test('reseller cannot create location grants', async () => {
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-reseller-support').send({ organizationId: 'org-customer', vehicleId: 'vehicle-2', durationHours: 2, purpose: 'Unauthorized attempt' }).expect(403);
});

test('customer can create a vehicle with a map marker appearance', async () => {
  const created = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({
    organizationId: 'org-customer',
    name: 'Courier Bike 21',
    plate: 'B-CB 2100',
    kind: 'BICYCLE',
    markerStyle: 'DIRECTIONAL',
    markerColor: 'GREEN',
    markerSize: 'SMALL'
  }).expect(201);
  assert.equal(created.body.markerStyle, 'DIRECTIONAL');
  const dashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const vehicle = dashboard.body.vehicles.find((item: { id: string }) => item.id === created.body.id);
  assert.equal(vehicle.kind, 'BICYCLE');
  assert.equal(vehicle.markerColor, 'GREEN');
});

test('delegated reseller vehicle creation preserves customer ownership and location privacy', async () => {
  const created = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-admin').send({
    organizationId: 'org-customer',
    name: 'Delegated Service Van',
    plate: 'B-DV 1717',
    kind: 'VAN',
    markerStyle: 'BADGE',
    markerColor: 'AMBER',
    markerSize: 'LARGE'
  }).expect(201);
  assert.equal(created.body.ownerOrganizationId, 'org-customer');
  assert.equal(/latitude|longitude/.test(JSON.stringify(created.body)), false);

  const resellerDashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-reseller-admin').expect(200);
  const resellerVehicle = resellerDashboard.body.vehicles.find((vehicle: { id: string }) => vehicle.id === created.body.id);
  assert.equal(resellerVehicle.ownerOrganizationId, 'org-customer');
  assert.equal(resellerVehicle.locationAccess, false);
  assert.equal(resellerVehicle.location, undefined);

  const customerDashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(customerDashboard.body.vehicles.some((vehicle: { id: string }) => vehicle.id === created.body.id), true);
  const audit = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const creationEvent = audit.body.find((event: { action: string; actorId: string; resourceId: string }) =>
    event.action === 'VEHICLE_CREATED' && event.actorId === 'user-reseller-admin' && event.resourceId === created.body.id);
  assert.equal(creationEvent.details.ownerOrganizationId, 'org-customer');
});

test('reseller vehicle creation requires its role, entitlement, exact delegation, and active relationship', async () => {
  const payload = { organizationId: 'org-private', name: 'Undelegated Car', plate: 'B-UD 1717', kind: 'CAR', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' };
  const undelegated = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-admin').send(payload).expect(403);
  assert.equal(undelegated.body.error.code, 'VEHICLE_ADMIN_REQUIRED');
  const supportDenied = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-support').send({ ...payload, organizationId: 'org-customer' }).expect(403);
  assert.equal(supportDenied.body.error.code, 'VEHICLE_ADMIN_REQUIRED');

  const relationship = await ServiceRelationship.findByPk('relationship-1');
  assert.ok(relationship);
  relationship.status = 'SUSPENDED';
  await relationship.save();
  try {
    const inactiveSession = await supertest(app).get('/api/session').set('x-demo-actor', 'user-reseller-admin').expect(200);
    assert.deepEqual(inactiveSession.body.provisioningCapabilities.manageVehiclesForCustomerIds, []);
    await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-admin').send({ ...payload, organizationId: 'org-customer' }).expect(403);
  } finally {
    relationship.status = 'ACTIVE';
    await relationship.save();
  }
});

test('vehicle creation enforces customer fleet administration and input validation', async () => {
  const payload = { organizationId: 'org-customer', name: 'Support Bike', plate: 'B-S 1', kind: 'BICYCLE', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' };
  await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-support').send(payload).expect(403);
  await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...payload, kind: 'SPACESHIP' }).expect(400);
});

test('vehicle creation rejects a duplicate normalized plate without creating another vehicle', async () => {
  const payload = { organizationId: 'org-customer', name: 'Duplicate Van', plate: ' b-fl 1204 ', kind: 'VAN', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' };
  const duplicate = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send(payload).expect(409);
  assert.equal(duplicate.body.error.code, 'VEHICLE_PLATE_EXISTS');
  const dashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(dashboard.body.vehicles.filter((vehicle: { plate: string }) => vehicle.plate === 'B-FL 1204').length, 1);
});

test('vehicle creation validation returns INVALID_VEHICLE for all input violations', async () => {
  const valid = { organizationId: 'org-customer', name: 'Test Vehicle', plate: 'B-TV 9999', kind: 'CAR', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' };
  // Name too short
  const shortName = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...valid, name: 'A' }).expect(400);
  assert.equal(shortName.body.error.code, 'INVALID_VEHICLE');
  // Plate too short
  const shortPlate = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...valid, plate: 'X' }).expect(400);
  assert.equal(shortPlate.body.error.code, 'INVALID_VEHICLE');
  // Invalid marker style
  const badStyle = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...valid, markerStyle: 'NEON' }).expect(400);
  assert.equal(badStyle.body.error.code, 'INVALID_VEHICLE');
  // Invalid marker color
  const badColor = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...valid, markerColor: 'PINK' }).expect(400);
  assert.equal(badColor.body.error.code, 'INVALID_VEHICLE');
  // Missing organization
  const noOrg = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...valid, organizationId: '' }).expect(400);
  assert.equal(noOrg.body.error.code, 'INVALID_VEHICLE');
});

test('vehicle creation succeeds on retry after a duplicate plate error', async () => {
  // First attempt with a plate that already exists from seeding (vehicle-1)
  const duplicatePlate = { organizationId: 'org-customer', name: 'Retry Truck', plate: 'B-FL 1204', kind: 'TRUCK', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' };
  const rejected = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send(duplicatePlate).expect(409);
  assert.equal(rejected.body.error.code, 'VEHICLE_PLATE_EXISTS');
  // Retry with a corrected plate succeeds
  const corrected = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({ ...duplicatePlate, plate: 'B-RT 7700' }).expect(201);
  assert.ok(corrected.body.id);
  assert.equal(corrected.body.plate, 'B-RT 7700');
  assert.equal(corrected.body.kind, 'TRUCK');
});

test('vehicle creation authorization error includes the expected error code', async () => {
  const payload = { organizationId: 'org-customer', name: 'Unauthorized Van', plate: 'B-UV 0001', kind: 'VAN', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM' };
  const denied = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-support').send(payload).expect(403);
  assert.equal(denied.body.error.code, 'VEHICLE_ADMIN_REQUIRED');
  assert.ok(denied.body.error.message);
  // Platform viewer is also denied
  const platformDenied = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-platform-viewer').send(payload).expect(403);
  assert.equal(platformDenied.body.error.code, 'VEHICLE_ADMIN_REQUIRED');
});

test('customer can edit, archive, filter, and restore a vehicle without losing its assignment history', async () => {
  const updated = await supertest(app).patch('/api/vehicles/vehicle-1').set('x-demo-actor', 'user-customer-admin').send({
    name: 'Delivery Van 12 Updated',
    plate: 'B-FL 1212',
    kind: 'VAN',
    markerStyle: 'PIN',
    markerColor: 'GREEN',
    markerSize: 'LARGE'
  }).expect(200);
  assert.equal(updated.body.name, 'Delivery Van 12 Updated');
  assert.equal(updated.body.plate, 'B-FL 1212');
  assert.equal(updated.body.archivedAt, null);

  const archived = await supertest(app).post('/api/vehicles/vehicle-1/archive').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.ok(archived.body.archivedAt);
  const defaultDashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(defaultDashboard.body.vehicles.some((vehicle: { id: string }) => vehicle.id === 'vehicle-1'), false);
  const archivedList = await supertest(app).get('/api/vehicles?organizationId=org-customer&status=ARCHIVED').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(archivedList.body.some((vehicle: { id: string }) => vehicle.id === 'vehicle-1'), true);

  const restored = await supertest(app).post('/api/vehicles/vehicle-1/restore').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(restored.body.archivedAt, null);
  const restoredDashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const restoredVehicle = restoredDashboard.body.vehicles.find((vehicle: { id: string }) => vehicle.id === 'vehicle-1');
  assert.equal(restoredVehicle.device.id, 'device-1');

  const audit = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const actions = audit.body.filter((event: { resourceId: string }) => event.resourceId === 'vehicle-1').map((event: { action: string }) => event.action);
  assert.ok(actions.includes('VEHICLE_UPDATED'));
  assert.ok(actions.includes('VEHICLE_ARCHIVED'));
  assert.ok(actions.includes('VEHICLE_RESTORED'));
});

test('delegated reseller lifecycle management is exact-scope and support remains denied', async () => {
  const updated = await supertest(app).patch('/api/vehicles/vehicle-2').set('x-demo-actor', 'user-reseller-admin').send({
    name: 'Delegated Service Car 07',
    plate: 'B-FL 0702',
    kind: 'CAR',
    markerStyle: 'BADGE',
    markerColor: 'VIOLET',
    markerSize: 'MEDIUM'
  }).expect(200);
  assert.equal(updated.body.ownerOrganizationId, 'org-customer');
  assert.equal(/latitude|longitude/.test(JSON.stringify(updated.body)), false);
  await supertest(app).post('/api/vehicles/vehicle-2/archive').set('x-demo-actor', 'user-reseller-admin').expect(200);
  await supertest(app).post('/api/vehicles/vehicle-2/restore').set('x-demo-actor', 'user-reseller-admin').expect(200);

  const supportDenied = await supertest(app).post('/api/vehicles/vehicle-2/archive').set('x-demo-actor', 'user-reseller-support').expect(403);
  assert.equal(supportDenied.body.error.code, 'VEHICLE_ADMIN_REQUIRED');
  const crossScopeDenied = await supertest(app).patch('/api/vehicles/vehicle-private').set('x-demo-actor', 'user-reseller-admin').send({
    name: 'Cross-scope edit', plate: 'B-MM 4431', kind: 'CAR', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM'
  }).expect(403);
  assert.equal(crossScopeDenied.body.error.code, 'VEHICLE_ADMIN_REQUIRED');
  await supertest(app).get('/api/vehicles?organizationId=org-private&status=ARCHIVED').set('x-demo-actor', 'user-reseller-admin').expect(403);

  const resellerDashboard = await supertest(app).get('/api/dashboard?organizationId=org-customer').set('x-demo-actor', 'user-reseller-admin').expect(200);
  const vehicle = resellerDashboard.body.vehicles.find((item: { id: string }) => item.id === 'vehicle-2');
  assert.equal(vehicle.locationAccess, false);
  assert.equal(vehicle.location, undefined);
});

test('customer can end and create device assignments without losing assignment history', async () => {
  const inventory = await supertest(app).get('/api/device-assignments/inventory?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(inventory.body.length, 5);
  assert.equal(inventory.body.find((device: { id: string }) => device.id === 'device-6').currentAssignment, null);
  assert.equal(inventory.body.find((device: { id: string }) => device.id === 'device-1').currentAssignment.vehicle.id, 'vehicle-1');
  assert.equal(/latitude|longitude/.test(JSON.stringify(inventory.body)), false);
  const before = await supertest(app).get('/api/device-assignments?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.equal(before.body.filter((assignment: { unassignedAt: string | null }) => assignment.unassignedAt === null).length, 4);
  assert.equal(before.body.find((assignment: { id: string }) => assignment.id === 'assignment-1').device.serial, '358123049582103');

  const deviceConflict = await supertest(app).post('/api/device-assignments').set('x-demo-actor', 'user-customer-admin').send({ deviceId: 'device-1', vehicleId: 'vehicle-2' }).expect(409);
  assert.equal(deviceConflict.body.error.code, 'DEVICE_ALREADY_ASSIGNED');

  const newVehicle = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-customer-admin').send({
    organizationId: 'org-customer', name: 'Assignment Test Van', plate: 'B-AS 1901', kind: 'VAN', markerStyle: 'DOT', markerColor: 'BLUE', markerSize: 'MEDIUM'
  }).expect(201);
  const ended = await supertest(app).delete('/api/device-assignments/assignment-1').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.ok(ended.body.unassignedAt);
  assert.equal(ended.body.deviceId, 'device-1');

  const vehicleConflict = await supertest(app).post('/api/device-assignments').set('x-demo-actor', 'user-customer-admin').send({ deviceId: 'device-1', vehicleId: 'vehicle-2' }).expect(409);
  assert.equal(vehicleConflict.body.error.code, 'VEHICLE_ALREADY_ASSIGNED');
  const assigned = await supertest(app).post('/api/device-assignments').set('x-demo-actor', 'user-customer-admin').send({ deviceId: 'device-1', vehicleId: newVehicle.body.id }).expect(201);
  assert.equal(assigned.body.unassignedAt, null);
  assert.equal(assigned.body.device.custodyOrganizationId, 'org-customer');
  assert.equal(assigned.body.vehicle.ownerOrganizationId, 'org-customer');

  const history = await supertest(app).get('/api/device-assignments?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  assert.ok(history.body.find((assignment: { id: string }) => assignment.id === 'assignment-1').unassignedAt);
  assert.equal(history.body.filter((assignment: { deviceId: string; unassignedAt: string | null }) => assignment.deviceId === 'device-1' && assignment.unassignedAt === null).length, 1);
  const audit = await supertest(app).get('/api/audit?organizationId=org-customer').set('x-demo-actor', 'user-customer-admin').expect(200);
  const actions = audit.body.filter((event: { resourceId: string }) => [ended.body.id, assigned.body.id].includes(event.resourceId)).map((event: { action: string }) => event.action);
  assert.ok(actions.includes('DEVICE_UNASSIGNED'));
  assert.ok(actions.includes('DEVICE_ASSIGNED'));
});

test('delegated reseller assignment management is exact-scope and tenant-safe', async () => {
  const newVehicle = await supertest(app).post('/api/vehicles').set('x-demo-actor', 'user-reseller-admin').send({
    organizationId: 'org-customer', name: 'Delegated Device Van', plate: 'B-DD 1902', kind: 'VAN', markerStyle: 'PIN', markerColor: 'GREEN', markerSize: 'MEDIUM'
  }).expect(201);
  await supertest(app).delete('/api/device-assignments/assignment-2').set('x-demo-actor', 'user-reseller-admin').expect(200);
  const assigned = await supertest(app).post('/api/device-assignments').set('x-demo-actor', 'user-reseller-admin').send({ deviceId: 'device-2', vehicleId: newVehicle.body.id }).expect(201);
  assert.equal(assigned.body.vehicle.ownerOrganizationId, 'org-customer');
  assert.equal(/latitude|longitude/.test(JSON.stringify(assigned.body)), false);

  const supportDenied = await supertest(app).delete('/api/device-assignments/assignment-3').set('x-demo-actor', 'user-reseller-support').expect(403);
  assert.equal(supportDenied.body.error.code, 'DEVICE_ASSIGNMENT_ADMIN_REQUIRED');
  const undelegatedDenied = await supertest(app).delete('/api/device-assignments/assignment-5').set('x-demo-actor', 'user-reseller-admin').expect(403);
  assert.equal(undelegatedDenied.body.error.code, 'DEVICE_ASSIGNMENT_ADMIN_REQUIRED');
  const crossTenantDenied = await supertest(app).post('/api/device-assignments').set('x-demo-actor', 'user-reseller-admin').send({ deviceId: 'device-5', vehicleId: 'vehicle-1' }).expect(403);
  assert.equal(crossTenantDenied.body.error.code, 'DEVICE_ASSIGNMENT_SCOPE_DENIED');
  await supertest(app).get('/api/device-assignments?organizationId=org-private').set('x-demo-actor', 'user-reseller-admin').expect(403);
  await supertest(app).get('/api/device-assignments/inventory?organizationId=org-private').set('x-demo-actor', 'user-reseller-admin').expect(403);
});

test('grant creation rejects malformed bodies with a client error', async () => {
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ vehicleId: 'vehicle-2', durationHours: 2, purpose: 'Missing organization id' }).expect(400);
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ organizationId: 'org-customer', durationHours: 2, purpose: 'Missing vehicle id' }).expect(400);
  await supertest(app).post('/api/grants').set('x-demo-actor', 'user-customer-admin').send({ organizationId: 'org-customer', vehicleId: 'vehicle-private', durationHours: 2, purpose: 'Cross tenant attempt' }).expect(400);
});

test('malformed and oversized JSON bodies return client errors', async () => {
  const malformed = await supertest(app)
    .post('/api/grants')
    .set('x-demo-actor', 'user-customer-admin')
    .set('content-type', 'application/json')
    .send('{')
    .expect(400);
  assert.equal(malformed.body.error.code, 'MALFORMED_JSON');

  const oversized = await supertest(app)
    .post('/api/grants')
    .set('x-demo-actor', 'user-customer-admin')
    .send({ purpose: 'x'.repeat(33 * 1024) })
    .expect(413);
  assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE');
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
