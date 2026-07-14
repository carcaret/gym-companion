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

  async function createPendingSwapOnDia1(page) {
    await startWorkout(page, 'Día 2');
    await openCardAndSwap(page, 0, 'Curl Bíceps');
    await page.locator('#modal-actions button', { hasText: 'Sí' }).click();
    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');
    await page.locator('#back-to-selector-btn').click();
  }

  test('4 — selector de días muestra aviso del intercambio pendiente', async ({ page }) => {
    await createPendingSwapOnDia1(page);

    const dia1Card = page.locator('.day-btn', { hasText: 'Día 1' });
    await expect(dia1Card).toContainText('Sentadilla');
    await expect(dia1Card).toContainText('Curl Bíceps');
  });

  test('5 — al iniciar el día destino, el ejercicio queda sustituido y el pendiente sigue vivo', async ({ page }) => {
    await createPendingSwapOnDia1(page);
    await startWorkout(page, 'Día 1');

    await expect(page.locator('#w-title-0')).toContainText('Press Banca');
    await expect(page.locator('#w-title-1')).toContainText('Sentadilla'); // curl_biceps sustituido
    await expect(page.locator('#w-title-2')).toContainText('Ejercicio Sin Historial');

    const pendingSwaps = await getPendingSwaps(page);
    expect(pendingSwaps.DIA1).toBeDefined(); // sigue vivo, no se borra hasta terminar (Task 4)
  });

  test('7 — al terminar el entreno del día destino, el pendiente se borra', async ({ page }) => {
    await createPendingSwapOnDia1(page);
    await startWorkout(page, 'Día 1');

    let pendingSwaps = await getPendingSwaps(page);
    expect(pendingSwaps.DIA1).toBeDefined();

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    pendingSwaps = await getPendingSwaps(page);
    expect(pendingSwaps.DIA1).toBeUndefined();
  });

});

test.describe('swap recíproco — pendiente caducado', () => {
  test.beforeEach(async ({ page }) => {
    const db = JSON.parse(getTestDB());
    db.pendingSwaps = { DIA1: { fromExerciseId: 'curl_biceps', toExerciseId: 'sentadilla', weekStart: '2000-01-03' } };
    await page.addInitScript(dbJson => {
      localStorage.setItem('gym_companion_db', dbJson);
    }, JSON.stringify(db));
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('6 — pendiente con semana caducada no se aplica y se limpia al iniciar', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
    await expect(page.locator('#w-title-1')).toContainText('Curl Bíceps'); // sin sustituir

    const pendingSwaps = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.pendingSwaps || {};
    });
    expect(pendingSwaps.DIA1).toBeUndefined(); // limpiado de inmediato, nada que preservar
  });
});

test.describe('swap recíproco — día destino ya hecho esta semana', () => {
  // Lunes de la semana en curso (mismo algoritmo que getWeekStartStr de src/dates.js,
  // pero con fecha local ya que aquí solo se usa como string a inyectar en la fixture).
  // Cae siempre dentro de la semana ISO actual, sin importar qué día se ejecute el test.
  function currentWeekMondayStr() {
    const d = new Date();
    const day = d.getDay(); // 0=domingo..6=sábado
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  test.beforeEach(async ({ page }) => {
    const db = JSON.parse(getTestDB());
    // DIA1 ya completado el lunes de la semana en curso (dentro de la semana en curso
    // siempre, sin importar qué día de la semana se ejecute la suite).
    db.history.push({
      date: currentWeekMondayStr(),
      type: 'DIA1',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 },
        { exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 15 }
      ]
    });
    await page.addInitScript(dbJson => {
      localStorage.setItem('gym_companion_db', dbJson);
    }, JSON.stringify(db));
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('8 — DIA1 ya hecho esta semana: swap hacia su ejercicio único no ofrece modal recíproco', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    await page.locator('.card-header').nth(0).click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);
    await page.locator('[data-action="swapExercise"][data-logidx="0"]').click();
    await expect(page.locator('#modal-title')).toContainText('Cambiar ejercicio');
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Curl Bíceps' }).click();

    // El swap normal se aplica; NO debe aparecer el modal de intercambio recíproco
    await expect(page.locator('#w-title-0')).toContainText('Curl Bíceps');
    await expect(page.locator('#modal-overlay')).toBeHidden();

    const pendingSwaps = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.pendingSwaps || {};
    });
    expect(Object.keys(pendingSwaps)).toHaveLength(0);
  });
});
