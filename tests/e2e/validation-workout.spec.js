const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Validación en vista Hoy', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startWorkout(page) {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  async function fillAllReps(page) {
    const cards = page.locator('.card-header');
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      await cards.nth(i).click();
    }
    // reps already pre-filled by buildLog
  }

  test('todas las reps completas → finalizar funciona normalmente', async ({ page }) => {
    await startWorkout(page);

    await fillAllReps(page);

    // Finish
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');
  });

  test('series 0 (manual input) → se clampea a 1 por setParam', async ({ page }) => {
    await startWorkout(page);
    await page.locator('.card-header').first().click();

    const seriesInput = page.locator('#w-series-0');
    await seriesInput.fill('0');
    await seriesInput.dispatchEvent('change');

    // setParam clamps to 1, so series should be 1
    await expect(seriesInput).toHaveValue('1');
  });
});
