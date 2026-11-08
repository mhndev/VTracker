import { expect, test, type Page } from '@playwright/test';

const portalUrl = 'http://127.0.0.1:15173';
const adminUrl = 'http://127.0.0.1:15174';
const simulatorUrl = 'http://127.0.0.1:15175';

async function openPortal(page: Page) {
  await page.goto(portalUrl);
  await expect(page.getByRole('heading', { name: 'Good morning, Maya.' })).toBeVisible();
}

test.describe('Sentinel Fleet critical journeys', () => {
  test('customer monitors the fleet and inspects saved telematics', async ({ page }) => {
    await openPortal(page);

    await page.getByRole('button', { name: 'Refresh positions' }).click();
    await expect(page.getByText(/live positions updated/i)).toBeVisible();

    await page.getByRole('button', { name: 'Live map' }).click();
    await expect(page.getByRole('heading', { name: 'Live fleet map' })).toBeVisible();

    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your vehicles' })).toBeVisible();
    await page.locator('#vehicle-vehicle-1').getByRole('button', { name: 'Telematics' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Delivery Van 12' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Current state' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Trips' }).click();
    await expect(dialog.getByText('TRIP HISTORY')).toBeVisible();
    await dialog.getByRole('button', { name: 'Logs' }).click();
    await expect(dialog.getByText('DEVICE LOGS')).toBeVisible();
  });

  test('customer grants scoped location access and reseller sees only granted locations', async ({ page }) => {
    await openPortal(page);

    await page.getByRole('button', { name: 'Privacy & access' }).click();
    await expect(page.getByRole('heading', { name: 'Grant temporary access' })).toBeVisible();
    const builder = page.locator('.grant-builder').filter({ hasText: 'Grant temporary access' });
    await builder.getByLabel('Vehicle').selectOption('vehicle-2');
    await builder.getByLabel('Purpose').fill('E2E support diagnosis');
    await builder.getByRole('button', { name: 'Create secure grant' }).click();
    await expect(page.getByText('Temporary location access granted.')).toBeVisible();

    await page.getByLabel('Switch portal role').selectOption('user-reseller-support');
    await expect(page.getByRole('heading', { name: /Good morning, Noah Fischer/ })).toBeVisible();
    await page.getByRole('button', { name: 'Granted map' }).click();
    await expect(page.getByRole('heading', { name: 'Granted location map' })).toBeVisible();
    await expect(page.getByText('Delivery Van 12', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Service Car 07', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Cargo Van 19', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Requires grant').first()).toBeVisible();
  });

  test('reseller opens a customer workspace and adds a fleet vehicle', async ({ page }) => {
    await openPortal(page);

    await page.getByLabel('Switch portal role').selectOption('user-reseller-admin');
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
    const customer = page.locator('.customer-card').filter({ hasText: 'Berlin Field Logistics' });
    await customer.getByRole('button', { name: /Open the permitted operational workspace for Berlin Field Logistics/ }).click();
    await expect(page.getByRole('heading', { name: /Good morning, Leila Haddad/ })).toBeVisible();

    await page.getByRole('button', { name: 'Customer fleet' }).click();
    await page.getByRole('button', { name: 'Add customer vehicle' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Vehicle name').fill('E2E Support Van');
    await dialog.getByLabel('Registration plate').fill('E2E-1108');
    await dialog.getByRole('button', { name: 'Create vehicle' }).click();
    await expect(page.getByText('Vehicle created', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Support Van', { exact: true }).first()).toBeVisible();
  });

  test('admin exposes onboarding videos without weakening the coordinate boundary', async ({ page, request }) => {
    await page.goto(adminUrl);
    await expect(page.getByRole('heading', { name: 'Control center', exact: true, level: 1 })).toBeVisible();
    await expect(page.getByText('Coordinates excluded', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Onboarding videos' }).click();
    await expect(page.getByRole('heading', { name: 'Onboarding library', level: 1 })).toBeVisible();
    await expect(page.locator('video')).toHaveCount(3);

    for (const source of await page.locator('video source').evaluateAll(nodes => nodes.map(node => (node as HTMLSourceElement).src))) {
      const response = await request.get(source);
      expect(response.ok(), `${source} should be available`).toBeTruthy();
      expect(response.headers()['content-type']).toMatch(/^video\//);
    }
  });

  test('device simulator loads independently for lab workflows', async ({ page }) => {
    await page.goto(simulatorUrl);
    await expect(page.getByRole('heading', { name: '303FG Operations Console' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect & send login/ })).toBeVisible();
  });
});
