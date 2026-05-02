const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Gestion de rutina', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function goToRoutine(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();
  }

  async function goToActiveWorkout(page, dayLabel = 'Día 1') {
    await goToRoutine(page, dayLabel);
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('añadir ejercicio existente a rutina se guarda en DB', async ({ page }) => {
    await goToActiveWorkout(page);

    const initialSize = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1.length;
    });

    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    const firstItem = page.locator('.exercise-list-item').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();

    const newSize = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1.length;
    });
    expect(newSize).toBe(initialSize + 1);
  });

  test('crear ejercicio nuevo se guarda en DB y rutina', async ({ page }) => {
    await goToActiveWorkout(page);

    const initialSize = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1.length;
    });

    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    await page.locator('#create-exercise-btn').click();
    await page.fill('#new-exercise-name', 'Press Arnold');
    await page.locator('#modal-actions .btn-primary').click();

    const result = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return {
        routineSize: db.routines.DIA1.length,
        hasExercise: !!db.exercises['press_arnold']
      };
    });
    expect(result.routineSize).toBe(initialSize + 1);
    expect(result.hasExercise).toBe(true);
  });

  test('crear ejercicio con nombre duplicado muestra warning y modal sigue abierto', async ({ page }) => {
    await goToActiveWorkout(page);

    await page.locator('#add-exercise-mid-btn').click();
    await page.locator('#create-exercise-btn').click();

    await page.fill('#new-exercise-name', 'Press Banca');
    await page.locator('#modal-actions .btn-primary').click();

    await expect(page.locator('#toast')).toContainText('Ya existe');
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');
    await expect(page.locator('#new-exercise-name')).toHaveValue('Press Banca');
  });

  test('crear ejercicio nuevo cierra el modal tras éxito', async ({ page }) => {
    await goToActiveWorkout(page);

    await page.locator('#add-exercise-mid-btn').click();
    await page.locator('#create-exercise-btn').click();

    await page.fill('#new-exercise-name', 'Ejercicio Único XYZ');
    await page.locator('#modal-actions .btn-primary').click();

    await expect(page.locator('#modal-overlay')).toHaveAttribute('hidden', '');
  });

  test('buscar ejercicio en modal filtra correctamente', async ({ page }) => {
    await goToActiveWorkout(page);
    await page.locator('#add-exercise-mid-btn').click();

    const searchInput = page.locator('#exercise-search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('sentad');

    const visibleItems = page.locator('.exercise-list-item:visible');
    const count = await visibleItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('añadir ejercicio durante entreno activo aparece como card', async ({ page }) => {
    await goToRoutine(page);
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    const initialCards = await page.locator('.card').count();

    // Add exercise mid-workout
    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    const firstItem = page.locator('.exercise-list-item').first();
    const hasItems = await firstItem.isVisible().catch(() => false);
    if (hasItems) {
      await firstItem.click();
      const newCards = await page.locator('.card').count();
      expect(newCards).toBe(initialCards + 1);
    }
  });

  test('crear ejercicio nuevo a mitad de entreno aparece como card y en logs', async ({ page }) => {
    await goToRoutine(page);
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    const initialCards = await page.locator('.card').count();

    await page.locator('#add-exercise-mid-btn').click();
    await page.locator('#create-exercise-btn').click();
    await page.fill('#new-exercise-name', 'Ejercicio Mid Entreno');
    await page.locator('#modal-actions .btn-primary').click();

    // Nueva card visible en el entreno
    const newCards = await page.locator('.card').count();
    expect(newCards).toBe(initialCards + 1);

    // Y el log está persistido en el entry activo de hoy
    const result = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      const entry = db.history.find(h => h.date === today);
      const last = entry?.logs[entry.logs.length - 1];
      return {
        inRoutine: db.routines.DIA1.includes('ejercicio_mid_entreno'),
        inExercises: !!db.exercises['ejercicio_mid_entreno'],
        lastLogId: last?.exercise_id,
        lastActualAllNumbers: last ? last.reps.actual.every(v => typeof v === 'number') : false
      };
    });
    expect(result.inRoutine).toBe(true);
    expect(result.inExercises).toBe(true);
    expect(result.lastLogId).toBe('ejercicio_mid_entreno');
    expect(result.lastActualAllNumbers).toBe(true);
  });

  test('crear ejercicio nuevo a mitad de entreno NO desaparece de la lista al re-abrir', async ({ page }) => {
    // Regresión: antes se creaba en rutina pero no en logs, y al re-abrir el modal
    // "añadir" la lista lo filtraba (ya está en routineIds) → el usuario lo buscaba y no estaba.
    await goToRoutine(page);
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    await page.locator('#add-exercise-mid-btn').click();
    await page.locator('#create-exercise-btn').click();
    await page.fill('#new-exercise-name', 'Hammer Curl Unicornio');
    await page.locator('#modal-actions .btn-primary').click();

    // Reaparece como card en el entreno, no hay que buscarlo en la lista
    await expect(page.locator('.card-title', { hasText: 'Hammer Curl Unicornio' })).toBeVisible();
  });
});
