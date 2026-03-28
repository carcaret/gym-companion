const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Historial', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('historial muestra entries del fixture', async ({ page }) => {
    await page.click('[data-view="historial"]');
    const entries = page.locator('.historial-entry-btn');
    await expect(entries.first()).toBeVisible();
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('filtros por dia funcionan', async ({ page }) => {
    await page.click('[data-view="historial"]');

    const dia1Filter = page.locator('.filter-btn', { hasText: 'Día 1' });
    if (await dia1Filter.isVisible()) {
      await dia1Filter.click();
      const entries = page.locator('.historial-entry-btn');
      await expect(entries.first()).toBeVisible();
    }
  });

  test('detalle de entry muestra ejercicios', async ({ page }) => {
    await page.click('[data-view="historial"]');
    const firstEntry = page.locator('.historial-entry-btn').first();
    await expect(firstEntry).toBeVisible();
    await firstEntry.click();

    // After clicking, should see exercise details
    await expect(page.locator('#historial-content')).toContainText(/kg|series|reps/i);
  });
});
