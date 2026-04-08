const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

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

  test('el acordeón abierto ANTES del drag sigue siendo el correcto (re-render no cierra)', async ({ page }) => {
    await startWorkout(page);

    // Abrir card 1
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#body-1')).toHaveClass(/open/);

    // Simular drag (reorderExercises no hace re-render, así que el accordion no cambia)
    // En la app real SortableJS mueve el DOM — el next render vendría solo si se hace
    // alguna acción que cause updateWorkoutCardInPlace
    // Verificamos que el accordion sigue abierto en body-1
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 1));
    await expect(page.locator('#toast')).toContainText('Orden actualizado');

    // body-1 debe seguir abierto (reorderExercises no re-renderiza)
    await expect(page.locator('#body-1')).toHaveClass(/open/);
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
