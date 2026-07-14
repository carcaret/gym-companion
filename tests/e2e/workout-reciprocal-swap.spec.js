const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage, fillAllWorkoutReps, getTestDB } = require('./helpers.js');

// Fixture DB: DIA1 = [press_banca, curl_biceps, ejercicio_sin_historial], DIA2 = [sentadilla], DIA3 = [press_banca, sentadilla]
// curl_biceps está SOLO en DIA1 → único candidato a reciprocidad al swapear desde DIA2.
// press_banca/sentadilla están en 2 días cada uno → caso ambiguo, sin reciprocidad.

test.describe('swap recíproco entre días de rutina', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startWorkout(page, dayLabel) {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    const startBtn = page.locator('#start-workout-btn');
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  async function openCardAndSwap(page, logIdx, exerciseName) {
    const body = page.locator(`#body-${logIdx}`);
    const isOpen = await body.evaluate(el => el.classList.contains('open')).catch(() => false);
    if (!isOpen) {
      await page.locator('.card-header').nth(logIdx).click();
      await expect(body).toHaveClass(/open/);
    }
    await page.locator(`[data-action="swapExercise"][data-logidx="${logIdx}"]`).click();
    await expect(page.locator('#modal-title')).toContainText('Cambiar ejercicio');
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: exerciseName }).click();
  }

  async function getPendingSwaps(page) {
    return page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.pendingSwaps || {};
    });
  }

  test('1 — swap desde único match en otro día ofrece modal recíproco; confirmar crea el pendiente', async ({ page }) => {
    await startWorkout(page, 'Día 2');
    await openCardAndSwap(page, 0, 'Curl Bíceps');

    await expect(page.locator('#modal-title')).toContainText('Intercambio recíproco');
    await expect(page.locator('#modal-body')).toContainText('Full Body - Día 1');
    await page.locator('#modal-actions button', { hasText: 'Sí' }).click();

    const pendingSwaps = await getPendingSwaps(page);
    expect(pendingSwaps.DIA1.fromExerciseId).toBe('curl_biceps');
    expect(pendingSwaps.DIA1.toExerciseId).toBe('sentadilla');
  });

  test('2 — declinar el modal (No) no crea ningún pendiente', async ({ page }) => {
    await startWorkout(page, 'Día 2');
    await openCardAndSwap(page, 0, 'Curl Bíceps');

    await expect(page.locator('#modal-title')).toContainText('Intercambio recíproco');
    await page.locator('#modal-actions button', { hasText: 'No' }).click();

    const pendingSwaps = await getPendingSwaps(page);
    expect(pendingSwaps.DIA1).toBeUndefined();
  });

  test('3 — swap ambiguo (ejercicio en 2+ días) no ofrece modal recíproco (regresión)', async ({ page }) => {
    await startWorkout(page, 'Día 1');
    await openCardAndSwap(page, 0, 'Sentadilla'); // sentadilla está en DIA2 y DIA3 → ambiguo

    // El swap normal se aplica igual que siempre, sin modal extra
    await expect(page.locator('#w-title-0')).toContainText('Sentadilla');
    await expect(page.locator('#modal-overlay')).toBeHidden();

    const pendingSwaps = await getPendingSwaps(page);
    expect(Object.keys(pendingSwaps)).toHaveLength(0);
  });
});
