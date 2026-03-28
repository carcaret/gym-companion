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
    const dayBtn = page.locator('.day-btn', { hasText: 'Lunes' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  async function fillAllReps(page) {
    const repInputs = page.locator('input[id^="w-rep-"]');
    const count = await repInputs.count();
    for (let i = 0; i < count; i++) {
      const input = repInputs.nth(i);
      const val = await input.inputValue();
      if (!val || val === '') {
        await input.fill('10');
        await input.dispatchEvent('change');
      }
    }
  }

  test('rep vacía → intentar finalizar → se bloquea + input tiene clase input-error', async ({ page }) => {
    await startWorkout(page);

    // Expand first card and clear a rep
    await page.locator('.card-header').first().click();
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Try to finish
    await page.locator('#finish-workout-btn').click();

    // Should NOT complete
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // The rep input should have input-error class
    await expect(repInput).toHaveClass(/input-error/);
  });

  test('rep vacía → intentar finalizar → toast muestra warning', async ({ page }) => {
    await startWorkout(page);

    // Expand first card and clear a rep to make it invalid
    await page.locator('.card-header').first().click();
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Try to finish
    await page.locator('#finish-workout-btn').click();

    // Toast should appear with warning
    await expect(page.locator('.toast')).toContainText('Completa todos los campos');
  });

  test('rep vacía → rellenarla → clase input-error desaparece', async ({ page }) => {
    await startWorkout(page);

    // Expand first card
    await page.locator('.card-header').first().click();
    const repInput = page.locator('#w-rep-0-0');

    // Clear the rep to make it invalid
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Try to finish so errors are applied
    await page.locator('#finish-workout-btn').click();
    await expect(repInput).toHaveClass(/input-error/);

    // Fix the rep
    await repInput.fill('10');
    await repInput.dispatchEvent('change');

    // Error should be gone
    await expect(repInput).not.toHaveClass(/input-error/);
  });

  test('todas las reps completas → finalizar funciona normalmente', async ({ page }) => {
    await startWorkout(page);

    // Expand all cards and fill all reps
    const cards = page.locator('.card-header');
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      await cards.nth(i).click();
    }

    await fillAllReps(page);

    // Finish
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');
  });

  test('card colapsada con error → se expande al intentar finalizar', async ({ page }) => {
    await startWorkout(page);

    // Expand first card, clear a rep, then collapse it
    await page.locator('.card-header').first().click();
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Collapse the card
    await page.locator('.card-header').first().click();
    const body = page.locator('#body-0');
    await expect(body).not.toHaveClass(/open/);

    // Try to finish
    await page.locator('#finish-workout-btn').click();

    // First card should now be expanded because it has errors
    await expect(body).toHaveClass(/open/);
  });

  test('vaciar rep muestra input-error en tiempo real al intentar finalizar', async ({ page }) => {
    await startWorkout(page);
    await page.locator('.card-header').first().click();

    // Clear a rep to make it invalid
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Try to finish — validation marks the empty rep
    await page.locator('#finish-workout-btn').click();

    // The specific rep should have error class
    await expect(repInput).toHaveClass(/input-error/);

    // Weight should NOT have error (it's valid)
    const weightInput = page.locator('#w-weight-0');
    await expect(weightInput).not.toHaveClass(/input-error/);
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
