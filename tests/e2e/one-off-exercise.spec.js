const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

// DIA1 en la fixture: press_banca, curl_biceps, ejercicio_sin_historial.
// El único ejercicio añadible desde el modal es Sentadilla.

async function readDB(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
}

async function readTodayLogs(page) {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('gym_companion_db'));
    const today = new Date().toISOString().slice(0, 10);
    return db.history.find(h => h.date === today)?.logs ?? null;
  });
}

test.describe('Ejercicio puntual (solo esta sesión)', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function openAddModal(page) {
    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#one-off-toggle')).toBeVisible();
  }

  test('1 — el chip aparece en el modal y arranca apagado', async ({ page }) => {
    await openAddModal(page);
    await expect(page.locator('#one-off-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#one-off-toggle')).not.toHaveClass(/\bon\b/);
  });

  test('2 — chip apagado: el ejercicio entra en la rutina (comportamiento de siempre)', async ({ page }) => {
    await openAddModal(page);
    await page.locator('.exercise-list-item[data-id="sentadilla"]').click();

    const db = await readDB(page);
    expect(db.routines.DIA1).toContain('sentadilla');

    const logs = await readTodayLogs(page);
    expect(logs).toHaveLength(4);
    expect(logs[3].exercise_id).toBe('sentadilla');
    expect(logs[3].oneOff).toBeUndefined();
  });

  test('3 — chip encendido: entra en el entreno pero NO en la rutina', async ({ page }) => {
    await openAddModal(page);
    await page.locator('#one-off-toggle').click();
    await expect(page.locator('#one-off-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.exercise-list-item[data-id="sentadilla"]').click();

    await expect(page.locator('#toast')).toContainText('solo para hoy');
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(4);

    const db = await readDB(page);
    expect(db.routines.DIA1).toEqual(['press_banca', 'curl_biceps', 'ejercicio_sin_historial']);

    const logs = await readTodayLogs(page);
    expect(logs[3].exercise_id).toBe('sentadilla');
    expect(logs[3].oneOff).toBe(true);
  });

  test('4 — chip encendido oculta "Crear nuevo ejercicio"; apagarlo lo devuelve', async ({ page }) => {
    await openAddModal(page);
    await expect(page.locator('#create-exercise-btn')).toBeVisible();

    await page.locator('#one-off-toggle').click();
    await expect(page.locator('#create-exercise-btn')).toBeHidden();

    await page.locator('#one-off-toggle').click();
    await expect(page.locator('#create-exercise-btn')).toBeVisible();
  });

  test('5 — la card puntual dice "Quitar" y se borra sin modal ni tocar la rutina', async ({ page }) => {
    await openAddModal(page);
    await page.locator('#one-off-toggle').click();
    await page.locator('.exercise-list-item[data-id="sentadilla"]').click();
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(4);

    await page.locator('#workout-cards-list .card').nth(3).locator('.card-header').click();
    const removeBtn = page.locator('[data-action="removeExercise"][data-exerciseid="sentadilla"]');
    await expect(removeBtn).toHaveText('Quitar');
    await removeBtn.click();

    await expect(page.locator('#modal-title')).toBeHidden();
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(3);

    const db = await readDB(page);
    expect(db.routines.DIA1).toEqual(['press_banca', 'curl_biceps', 'ejercicio_sin_historial']);
  });

  test('6 — reordenar con un puntual presente no mete el puntual en la rutina', async ({ page }) => {
    await openAddModal(page);
    await page.locator('#one-off-toggle').click();
    await page.locator('.exercise-list-item[data-id="sentadilla"]').click();
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(4);

    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 1));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    const db = await readDB(page);
    expect(db.routines.DIA1).toEqual(['curl_biceps', 'press_banca', 'ejercicio_sin_historial']);

    const logs = await readTodayLogs(page);
    expect(logs.map(l => l.exercise_id)).toEqual(['curl_biceps', 'press_banca', 'ejercicio_sin_historial', 'sentadilla']);
  });

  test('7 — al finalizar, el puntual queda en el historial y la rutina sigue limpia', async ({ page }) => {
    await openAddModal(page);
    await page.locator('#one-off-toggle').click();
    await page.locator('.exercise-list-item[data-id="sentadilla"]').click();

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno completado');

    const logs = await readTodayLogs(page);
    expect(logs.map(l => l.exercise_id)).toContain('sentadilla');

    const db = await readDB(page);
    expect(db.routines.DIA1).not.toContain('sentadilla');
  });
});
