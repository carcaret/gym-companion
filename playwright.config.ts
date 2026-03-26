import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:4321',
    ...devices['iPhone 14'],
    locale: 'es-ES',
  },

  webServer: {
    command: 'npx serve . -p 4321 --no-clipboard',
    port: 4321,
    reuseExistingServer: true,
  },
});
