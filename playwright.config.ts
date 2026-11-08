import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  outputDir: 'output/playwright/results',
  use: {
    baseURL: 'http://127.0.0.1:15173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev:services',
    url: 'http://127.0.0.1:15173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_DIALECT: 'sqlite',
      DATABASE_URL: '',
      DATABASE_STORAGE: ':memory:',
      DATABASE_LOGGING: 'false',
      API_PORT: '18787',
      PORTAL_PORT: '15173',
      ADMIN_PORT: '15174',
      SIMULATOR_PORT: '15175',
      SIMULATOR_CONTROL_PORT: '15176',
      TELEMATICS_PORT: '18090',
      VITE_API_BASE: 'http://127.0.0.1:18787',
      CORS_ORIGIN: 'http://127.0.0.1:15173,http://127.0.0.1:15174,http://127.0.0.1:15175'
    }
  }
});
