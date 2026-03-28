const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Graficas completo', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.click('[data-view="graficas"]');
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('seleccionar ejercicio muestra 2 canvas', async ({ page }) => {
    // Set range to include fixture data
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const select = page.locator('#chart-exercise-select');
    await expect(select.locator('option')).not.toHaveCount(1);
    await select.selectOption({ index: 1 });

    // Both canvases should be present
    await expect(page.locator('#chart-canvas')).toBeVisible();
    await expect(page.locator('#chart-canvas-weight')).toBeVisible();
  });

  test('cambiar rango de fechas actualiza lista de ejercicios', async ({ page }) => {
    // Set range that includes data
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const select = page.locator('#chart-exercise-select');
    const optionsBefore = await select.locator('option').count();

    // Now set a range with no data
    await page.fill('#chart-from', '2025-06-01');
    await page.fill('#chart-to', '2025-06-30');
    await page.locator('#chart-from').dispatchEvent('change');

    const optionsAfter = await select.locator('option').count();
    // Should only have the placeholder option
    expect(optionsAfter).toBeLessThan(optionsBefore);
  });

  test('rango sin datos muestra select vacio', async ({ page }) => {
    await page.fill('#chart-from', '2030-01-01');
    await page.fill('#chart-to', '2030-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const select = page.locator('#chart-exercise-select');
    // Only the placeholder option
    const options = await select.locator('option').count();
    expect(options).toBe(1);
  });

  test('cambiar ejercicio actualiza graficas', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const select = page.locator('#chart-exercise-select');
    await expect(select.locator('option')).not.toHaveCount(1);

    // Select first exercise
    await select.selectOption({ index: 1 });
    await expect(page.locator('#chart-canvas')).toBeVisible();

    // Select a different exercise (if available)
    const optCount = await select.locator('option').count();
    if (optCount > 2) {
      await select.selectOption({ index: 2 });
      await expect(page.locator('#chart-canvas')).toBeVisible();
    }
  });
});
