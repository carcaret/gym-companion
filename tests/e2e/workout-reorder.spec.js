const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

// Lee los logs del entreno de hoy directamente de localStorage (fuente de verdad).
async function readPersistedLogs(page) {
  return await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('gym_companion_db'));
    const today = new Date().toISOString().slice(0, 10);
    return db.history.find(h => h.date === today)?.logs ?? null;
  });
}

// Invariante fuerte anti-camuflaje: cada card visible (en orden visual) debe
// corresponder al log persistido en esa misma posición — por nombre Y por peso.
// Si los índices del DOM se desincronizan de entry.logs (el bug), esto falla.
async function assertDomMatchesData(page) {
  const logs = await readPersistedLogs(page);
  expect(logs).toBeTruthy();
  const names = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('gym_companion_db'));
    return Object.fromEntries(Object.values(db.exercises).map(e => [e.id, e.name]));
  });
  const cardCount = await page.locator('#workout-cards-list .card').count();
  expect(cardCount).toBe(logs.length);
  for (let i = 0; i < logs.length; i++) {
    const title = (await page.locator(`#w-title-${i}`).innerText()).trim();
    expect(title, `título de la card ${i} debe ser el ejercicio del log ${i}`)
      .toContain(names[logs[i].exercise_id]);
    const weightVal = await page.locator(`#w-weight-${i}`).inputValue();
    expect(Number(weightVal), `peso mostrado en la card ${i} debe coincidir con el log ${i}`)
      .toBe(logs[i].weight);
  }
}

// The test DB has DIA1 with exercises: ['press_banca', 'curl_biceps']
// Exercise names:
//   press_banca  → 'Press banca'
//   curl_biceps  → 'Curl de bíceps con barra'

test.describe('drag-reorder workout exercises', () => {
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
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  // ── Presencia del handle ──────────────────────────────────────────────────

  test('el handle (≡) es visible en cada tarjeta de ejercicio durante entreno activo', async ({ page }) => {
    await startWorkout(page);
    const handles = page.locator('.drag-handle');
    const count = await handles.count();
    expect(count).toBeGreaterThan(0);
    // Every card has exactly one handle
    const cards = page.locator('#workout-cards-list .card');
    const cardCount = await cards.count();
    expect(count).toBe(cardCount);
    for (let i = 0; i < count; i++) {
      await expect(handles.nth(i)).toBeVisible();
    }
  });

  test('el handle NO aparece en la vista de historial', async ({ page }) => {
    await page.locator('[data-view="historial"]').click();
    await expect(page.locator('#view-historial')).toBeVisible();
    const handles = page.locator('#historial-content .drag-handle');
    await expect(handles).toHaveCount(0);
  });

  test('el handle NO aparece cuando no hay entreno activo (vista previa de hoy)', async ({ page }) => {
    // No workout started — should be in pre-start state
    const handles = page.locator('#hoy-content .drag-handle');
    await expect(handles).toHaveCount(0);
  });

  // ── Reordenado vía GymCompanion.reorderExercises ─────────────────────────
  // (Simula el callback onEnd de SortableJS directamente)

  test('reorderExercises actualiza DB.routines en localStorage', async ({ page }) => {
    await startWorkout(page);

    // Llamar reorderExercises: mover index 0 a index 1 (swap)
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 1));
    // Esperar el toast (persistDB y toast son async)
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    // Verificar localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('gym_companion_db');
      return JSON.parse(raw);
    });
    expect(stored.routines.DIA1[0]).toBe('curl_biceps');
    expect(stored.routines.DIA1[1]).toBe('press_banca');
  });

  test('reorderExercises actualiza entry.logs del entreno activo (invariante)', async ({ page }) => {
    await startWorkout(page);

    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 1));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('gym_companion_db');
      const db = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      return db.history.find(h => h.date === today)?.logs;
    });
    expect(stored).toBeTruthy();
    expect(stored[0].exercise_id).toBe('curl_biceps');
    expect(stored[1].exercise_id).toBe('press_banca');
  });

  test('tras reordenar y re-renderizar, el nuevo orden se refleja en el DOM', async ({ page }) => {
    await startWorkout(page);
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 1));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    // Navegar a historial y volver a hoy fuerza renderHoy() con el nuevo orden
    await page.locator('[data-view="historial"]').click();
    await expect(page.locator('#view-historial')).toBeVisible();
    await page.locator('[data-view="hoy"]').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // La primera card debe ser curl_biceps (el que movimos a índice 0)
    await expect(page.locator('#w-title-0')).toContainText('Curl');
    await expect(page.locator('#w-title-1')).toContainText('Press');
  });

  // ── Editar tras reordenar (regresión del bug de índices) ───────────────────
  // Bug: reorderExercises reordenaba entry.logs pero no re-renderizaba; las cards
  // conservaban sus índices horneados, así que editar una card mutaba el log de
  // OTRO ejercicio (el que ocupaba antes esa posición).

  test('editar peso tras reordenar modifica el ejercicio mostrado, no el que estaba antes en esa posición', async ({ page }) => {
    await startWorkout(page); // DIA1: [press, curl, sinhist]
    const before = await readPersistedLogs(page);
    const pressBefore = before.find(l => l.exercise_id === 'press_banca').weight;
    const sinhistBefore = before.find(l => l.exercise_id === 'ejercicio_sin_historial').weight;

    // mover press (idx0) al final → [curl, sinhist, press]
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 2));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    // el DOM refleja el nuevo orden INMEDIATAMENTE, sin navegar fuera
    await expect(page.locator('#w-title-0')).toContainText('Curl');
    await expect(page.locator('#w-title-2')).toContainText('Press');
    await assertDomMatchesData(page);

    // editar el peso de la card 0 (ahora Curl) a 88
    await page.locator('.card-header').first().click();
    const w0 = page.locator('#w-weight-0');
    await w0.fill('88');
    await w0.blur();

    const after = await readPersistedLogs(page);
    expect(after.find(l => l.exercise_id === 'curl_biceps').weight).toBe(88);
    expect(after.find(l => l.exercise_id === 'press_banca').weight).toBe(pressBefore);
    expect(after.find(l => l.exercise_id === 'ejercicio_sin_historial').weight).toBe(sinhistBefore);
    await assertDomMatchesData(page);
  });

  test('editar reps por serie (chip) tras reordenar afecta al ejercicio correcto', async ({ page }) => {
    await startWorkout(page);
    const before = await readPersistedLogs(page);

    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 2)); // [curl, sinhist, press]
    await expect(page.locator('#toast')).toContainText('Orden actualizado');
    await assertDomMatchesData(page);

    // abrir card 0 (Curl), enfocar serie 1 y fijar un valor de chip distintivo
    await page.locator('.card-header').first().click();
    await page.locator('#w-rep-0-0').click();
    const chip = page.locator('#w-chips-0 .chip').last();
    const chipVal = Number(await chip.getAttribute('data-value'));
    await chip.click();

    const after = await readPersistedLogs(page);
    expect(after.find(l => l.exercise_id === 'curl_biceps').reps.actual[0]).toBe(chipVal);
    for (const id of ['press_banca', 'ejercicio_sin_historial']) {
      expect(after.find(l => l.exercise_id === id).reps.actual)
        .toEqual(before.find(l => l.exercise_id === id).reps.actual);
    }
    await assertDomMatchesData(page);
  });

  test('ajustar peso con botones +/- tras reordenar afecta al ejercicio correcto', async ({ page }) => {
    await startWorkout(page);
    const before = await readPersistedLogs(page);

    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 2, 0)); // [sinhist, press, curl]
    await expect(page.locator('#toast')).toContainText('Orden actualizado');
    await assertDomMatchesData(page);

    await page.locator('.card-header').first().click(); // abrir card 0 (sinhist)
    await page.locator('#body-0 [data-action="adjustParam"][data-param="weight"][data-delta="2.5"]').click();

    const after = await readPersistedLogs(page);
    const sinhistBefore = before.find(l => l.exercise_id === 'ejercicio_sin_historial').weight;
    expect(after.find(l => l.exercise_id === 'ejercicio_sin_historial').weight)
      .toBe(Math.round((sinhistBefore + 2.5) * 10) / 10);
    expect(after.find(l => l.exercise_id === 'press_banca').weight)
      .toBe(before.find(l => l.exercise_id === 'press_banca').weight);
    expect(after.find(l => l.exercise_id === 'curl_biceps').weight)
      .toBe(before.find(l => l.exercise_id === 'curl_biceps').weight);
    await assertDomMatchesData(page);
  });

  test('varios reordenamientos consecutivos mantienen el DOM coherente y editar sigue siendo correcto', async ({ page }) => {
    await startWorkout(page);

    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 2));
    await assertDomMatchesData(page);
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 2, 1));
    await assertDomMatchesData(page);
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 1, 0));
    await assertDomMatchesData(page);

    // tras la cadena de reorders, editar la card 0 modifica el ejercicio que ahí se muestra
    const logs = await readPersistedLogs(page);
    const card0Id = logs[0].exercise_id;
    await page.locator('.card-header').first().click();
    const w0 = page.locator('#w-weight-0');
    await w0.fill('77');
    await w0.blur();

    const after = await readPersistedLogs(page);
    expect(after.find(l => l.exercise_id === card0Id).weight).toBe(77);
    // ningún otro log cambió de peso
    for (const l of after) {
      if (l.exercise_id === card0Id) continue;
      expect(l.weight).toBe(logs.find(x => x.exercise_id === l.exercise_id).weight);
    }
    await assertDomMatchesData(page);
  });

  test('cambiar (swap) un ejercicio tras reordenar mantiene la correspondencia card↔log', async ({ page }) => {
    await startWorkout(page);

    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 2)); // [curl, sinhist, press]
    await expect(page.locator('#toast')).toContainText('Orden actualizado');
    await assertDomMatchesData(page);

    // swap la card 0 (Curl) por Sentadilla
    await page.locator('.card-header').first().click();
    await page.locator('#body-0 [data-action="swapExercise"]').click();
    await expect(page.locator('#modal-body')).toBeVisible();
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Sentadilla' }).click();
    await expect(page.locator('#toast')).toContainText('Cambiado a');

    const logs = await readPersistedLogs(page);
    expect(logs[0].exercise_id).toBe('sentadilla');
    expect(logs.some(l => l.exercise_id === 'curl_biceps')).toBe(false);
    await assertDomMatchesData(page);
  });

  test('escenario reportado: añadir ejercicio mid-workout, moverlo y editarlo modifica el ejercicio correcto', async ({ page }) => {
    await startWorkout(page); // [press, curl, sinhist]

    // añadir Sentadilla durante el entreno
    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-body')).toBeVisible();
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Sentadilla' }).click();
    await expect(page.locator('#toast')).toContainText('añadido');

    const logs = await readPersistedLogs(page); // [press, curl, sinhist, sentadilla]
    expect(logs[logs.length - 1].exercise_id).toBe('sentadilla');
    await assertDomMatchesData(page);

    // mover Sentadilla (último) al principio
    await page.evaluate((idx) => GymCompanion.reorderExercises('DIA1', idx, 0), logs.length - 1);
    await expect(page.locator('#toast')).toContainText('Orden actualizado');
    await expect(page.locator('#w-title-0')).toContainText('Sentadilla');
    await assertDomMatchesData(page);

    // editar el peso de Sentadilla (card 0) a 130
    await page.locator('.card-header').first().click();
    const w0 = page.locator('#w-weight-0');
    await w0.fill('130');
    await w0.blur();

    const after = await readPersistedLogs(page);
    expect(after.find(l => l.exercise_id === 'sentadilla').weight).toBe(130);
    for (const id of ['press_banca', 'curl_biceps', 'ejercicio_sin_historial']) {
      expect(after.find(l => l.exercise_id === id).weight)
        .toBe(logs.find(l => l.exercise_id === id).weight);
    }
    await assertDomMatchesData(page);
  });

  // ── Acordeón sigue funcionando después del drag ────────────────────────────

  test('el acordeón sigue funcionando tras reordenar y re-renderizar', async ({ page }) => {
    await startWorkout(page);

    // Reordenar
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 1));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    // Navegar fuera y volver para forzar re-render con el nuevo orden
    await page.locator('[data-view="historial"]').click();
    await page.locator('[data-view="hoy"]').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // Abrir la primera card
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);
    await expect(page.locator('#body-1')).not.toHaveClass(/open/);

    // Abrir la segunda card cierra la primera
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#body-1')).toHaveClass(/open/);
    await expect(page.locator('#body-0')).not.toHaveClass(/open/);
  });

  test('el ejercicio que estaba abierto sigue abierto tras reordenar, aunque cambie de posición', async ({ page }) => {
    await startWorkout(page); // [press, curl, sinhist]

    // Abrir la card de Curl (posición visual 1)
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#body-1')).toHaveClass(/open/);
    await expect(page.locator('#w-title-1')).toContainText('Curl');

    // Reordenar: Curl pasa de idx1 a idx0
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 1, 0));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    // Sigue habiendo exactamente una card abierta y es la de Curl (ahora en posición 0).
    // Se verifica por contenido, no por índice: el ejercicio se movió a otra posición.
    const openCard = page.locator('.card', { has: page.locator('.card-body.open') });
    await expect(page.locator('.card-body.open')).toHaveCount(1);
    await expect(openCard.locator('.card-title')).toContainText('Curl');
    await assertDomMatchesData(page);
  });

  // ── Ejercicio añadido mid-workout también tiene handle ─────────────────────

  test('ejercicio añadido mid-workout también tiene drag-handle', async ({ page }) => {
    await startWorkout(page);

    const initialHandles = await page.locator('.drag-handle').count();

    // Abrir modal de añadir ejercicio
    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-body')).toBeVisible();

    // Seleccionar el primer ejercicio disponible de la lista
    const firstExerciseItem = page.locator('#exercise-modal-list .exercise-list-item').first();
    await expect(firstExerciseItem).toBeVisible();
    await firstExerciseItem.click();

    // Debería haber un handle más
    const newHandles = await page.locator('.drag-handle').count();
    expect(newHandles).toBe(initialHandles + 1);
  });

  // ── Drag handle no dispara el accordion ──────────────────────────────────

  test('clic en drag-handle no abre el acordeón', async ({ page }) => {
    await startWorkout(page);

    // Verificar que antes del clic no hay nada abierto
    await expect(page.locator('.card-body.open')).toHaveCount(0);

    // Clicar el drag-handle de la primera card
    await page.locator('.drag-handle').first().click();

    // El acordeón NO debe haberse abierto
    await expect(page.locator('.card-body.open')).toHaveCount(0);
  });

  // ── Verificar integridad del wrapper ─────────────────────────────────────

  test('existe el wrapper #workout-cards-list durante un entreno activo', async ({ page }) => {
    await startWorkout(page);
    await expect(page.locator('#workout-cards-list')).toBeVisible();
  });

  test('los .card son hijos directos de #workout-cards-list', async ({ page }) => {
    await startWorkout(page);
    const directCards = await page.evaluate(() => {
      const list = document.getElementById('workout-cards-list');
      return list ? [...list.children].filter(el => el.classList.contains('card')).length : 0;
    });
    const totalCards = await page.locator('#workout-cards-list .card').count();
    expect(directCards).toBe(totalCards);
    expect(directCards).toBeGreaterThan(0);
  });
});
