const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

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
    // Select routine from day selector
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // Fill all reps (helper expands each card via accordion)
    await fillAllWorkoutReps(page);

    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');
  });
});
