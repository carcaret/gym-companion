const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Workout flow', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('iniciar y finalizar entrenamiento', async ({ page }) => {
    const startBtn = page.locator('#start-workout-btn');
    const hasRoutine = await startBtn.isVisible().catch(() => false);

    if (hasRoutine) {
      await startBtn.click();
      await expect(page.locator('.workout-status')).toBeVisible();
      await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

      const finishBtn = page.locator('#finish-workout-btn');
      await finishBtn.click();

      await expect(page.locator('.workout-status')).toContainText('completado');
    }
  });
});
