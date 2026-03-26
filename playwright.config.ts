import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:4321',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    locale: 'es-ES',
    userAgent: devices['iPhone 14'].userAgent,
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },

  webServer: {
    command: 'vite build && npx serve dist -p 4321 --no-clipboard',
    port: 4321,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
