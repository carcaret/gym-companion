const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Graficas', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('seleccionar ejercicio muestra graficas', async ({ page }) => {
    await page.click('[data-view="graficas"]');

    // Adjust date range to include fixture data (Jan 2024)
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    // Trigger change event
    await page.locator('#chart-from').dispatchEvent('change');

    const select = page.locator('#chart-exercise-select');
    await expect(select).toBeVisible();

    // Wait for options to populate
    await expect(select.locator('option')).not.toHaveCount(1);
    await select.selectOption({ index: 1 });

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible();
  });
});
