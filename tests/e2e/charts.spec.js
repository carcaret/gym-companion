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
    await page.locator('#chart-from').dispatchEvent('change');

    // Open searchable dropdown and pick first exercise
    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    await expect(list).toBeVisible();
    const firstItem = list.locator('.searchable-select-item').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible();
  });
});
