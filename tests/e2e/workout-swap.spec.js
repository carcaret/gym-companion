const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

// Fixture DB: DIA1 = [press_banca, curl_biceps], DIA2 = [sentadilla]
// Exercise names: press_banca → 'Press Banca', curl_biceps → 'Curl Bíceps', sentadilla → 'Sentadilla'

test.describe('swap puntual de ejercicio en entreno activo', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startWorkout(page, dayLabel = 'Día 1') {
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

  // ── Escenario 1 ──────────────────────────────────────────────────────────

  test('1 — cambiar ejercicio actualiza el título del card', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');
    await expect(page.locator('#w-title-0')).toContainText('Sentadilla');
  });

  // ── Escenario 2 ──────────────────────────────────────────────────────────

  test('2 — log en localStorage tiene swappedFrom correcto', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');

    const log = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      const entry = db.history.find(h => h.date === today);
      return entry?.logs[0];
    });

    expect(log.exercise_id).toBe('sentadilla');
    expect(log.swappedFrom).toBe('press_banca');
  });

  // ── Escenario 3 ──────────────────────────────────────────────────────────

  test('3 — finalizar entreno → historial muestra el ejercicio sustituto', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    await page.locator('[data-view="historial"]').click();
    const entry = page.locator('.historial-entry-btn').first();
    await entry.click();
    await expect(page.locator('.historial-detail-card .card-title').first()).toContainText('Sentadilla');
  });

  // ── Escenario 4 ──────────────────────────────────────────────────────────

  test('4 — DIA1 sigue con el ejercicio original tras el swap (regresión clave)', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');

    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });

    expect(routineDia1).toContain('press_banca');
    expect(routineDia1).not.toContain('sentadilla');
  });

  // ── Escenario 5 ──────────────────────────────────────────────────────────

  test('5 — modal de swap excluye los ejercicios ya presentes en el entreno', async ({ page }) => {
    await startWorkout(page);

    // Open swap modal for logIdx=0 (press_banca)
    await page.locator('.card-header').nth(0).click();
    await page.locator('[data-action="swapExercise"][data-logidx="0"]').click();
    await expect(page.locator('#modal-title')).toContainText('Cambiar ejercicio');

    const items = page.locator('#exercise-modal-list .exercise-list-item');
    const allText = await items.allTextContents();
    const texts = allText.join('\n');

    expect(texts).not.toContain('Press Banca');
    expect(texts).not.toContain('Curl Bíceps');
    expect(texts).toContain('Sentadilla');
  });

  // ── Escenario 6 ──────────────────────────────────────────────────────────

  test('6 — swap A→B→A: swappedFrom desaparece al volver al original', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');

    const logAfterFirst = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      return db.history.find(h => h.date === today)?.logs[0];
    });
    expect(logAfterFirst.swappedFrom).toBe('press_banca');

    // Swap back to original
    await openCardAndSwap(page, 0, 'Press Banca');

    const logAfterReturn = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      return db.history.find(h => h.date === today)?.logs[0];
    });
    expect(logAfterReturn.exercise_id).toBe('press_banca');
    expect(logAfterReturn.swappedFrom).toBeUndefined();
  });

  // ── Escenario 7 ──────────────────────────────────────────────────────────

  test('7 — quitar de rutina sobre log swapped: log desaparece, plantilla DIA1 intacta', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');

    // Click "Quitar de rutina" on the now-sentadilla log
    await page.locator('[data-action="removeExercise"][data-exerciseid="sentadilla"]').click();
    await page.locator('#modal-actions .btn-danger').click();

    // 2 cards left (curl_biceps + ejercicio_sin_historial)
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(2);
    await expect(page.locator('#w-title-0')).toContainText('Curl Bíceps');

    // DIA1 routine still has press_banca
    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });
    expect(routineDia1).toContain('press_banca');
    expect(routineDia1).not.toContain('sentadilla');
  });

  // ── Escenario 8 ──────────────────────────────────────────────────────────

  test('8 — tras swap A→B, "+ Ejercicio" no ofrece B (fix bug duplicado)', async ({ page }) => {
    await startWorkout(page);
    await openCardAndSwap(page, 0, 'Sentadilla');

    // Open "+ Ejercicio"
    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-title')).toContainText('Añadir');

    const items = page.locator('#exercise-modal-list .exercise-list-item');
    const allText = await items.allTextContents();
    const texts = allText.join('\n');

    expect(texts).not.toContain('Sentadilla');
  });
});
