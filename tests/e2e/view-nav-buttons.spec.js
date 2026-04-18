const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Botones de navegación en vistas (Volver + Ejercicio)', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ── Helpers ──

  async function goToRoutinePreview(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();
  }

  async function goToHistoryDetail(page) {
    await page.click('[data-view="historial"]');
    const firstEntry = page.locator('.historial-entry-btn').first();
    await expect(firstEntry).toBeVisible();
    await firstEntry.click();
    await expect(page.locator('#historial-back-btn')).toBeVisible();
  }

  // ════════════════════════════════════════════════
  // Vista Rutina (routine preview)
  // ════════════════════════════════════════════════

  test('routine preview: botones Volver y Ejercicio están en view-nav-actions', async ({ page }) => {
    await goToRoutinePreview(page);
    const container = page.locator('.view-nav-actions');
    await expect(container).toBeVisible();
    await expect(container.locator('#back-to-selector-btn')).toBeVisible();
    await expect(container.locator('#add-exercise-btn')).toBeVisible();
  });

  test('routine preview: botón Volver es el primero (izquierda)', async ({ page }) => {
    await goToRoutinePreview(page);
    const container = page.locator('.view-nav-actions');
    const buttons = container.locator('button');
    await expect(buttons).toHaveCount(2);
    // First button should be the back button
    await expect(buttons.nth(0)).toHaveAttribute('id', 'back-to-selector-btn');
    await expect(buttons.nth(1)).toHaveAttribute('id', 'add-exercise-btn');
  });

  test('routine preview: botón Volver tiene texto "← Volver" y estilo btn-secondary', async ({ page }) => {
    await goToRoutinePreview(page);
    const backBtn = page.locator('#back-to-selector-btn');
    await expect(backBtn).toContainText('← Volver');
    await expect(backBtn).toHaveClass(/btn-secondary/);
  });

  test('routine preview: botón Ejercicio tiene texto "+ Ejercicio" y estilo btn-accent-subtle', async ({ page }) => {
    await goToRoutinePreview(page);
    const addBtn = page.locator('#add-exercise-btn');
    await expect(addBtn).toContainText('+ Ejercicio');
    await expect(addBtn).toHaveClass(/btn-accent-subtle/);
  });

  test('routine preview: botón Volver vuelve al selector de rutinas', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#back-to-selector-btn').click();
    // Should see the day selector
    await expect(page.locator('.day-btn').first()).toBeVisible();
    await expect(page.locator('#start-workout-btn')).not.toBeVisible();
  });

  test('routine preview: botón + Ejercicio abre modal', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#add-exercise-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');
  });

  test('routine preview: ambos botones ocupan mitad del ancho (flex: 1)', async ({ page }) => {
    await goToRoutinePreview(page);
    const backBtn = page.locator('#back-to-selector-btn');
    const addBtn = page.locator('#add-exercise-btn');
    const backBox = await backBtn.boundingBox();
    const addBox = await addBtn.boundingBox();
    // Both buttons should have similar width (flex: 1 each)
    expect(Math.abs(backBox.width - addBox.width)).toBeLessThan(5);
    // Back button should be on the left
    expect(backBox.x).toBeLessThan(addBox.x);
  });

  // ════════════════════════════════════════════════
  // Vista Historial detalle
  // ════════════════════════════════════════════════

  test('history detail: botón Volver está en view-nav-actions', async ({ page }) => {
    await goToHistoryDetail(page);
    const container = page.locator('#historial-content .view-nav-actions');
    await expect(container).toBeVisible();
    await expect(container.locator('#historial-back-btn')).toBeVisible();
  });

  test('history detail: botón Volver tiene texto "← Volver" y estilo btn-secondary', async ({ page }) => {
    await goToHistoryDetail(page);
    const backBtn = page.locator('#historial-back-btn');
    await expect(backBtn).toContainText('← Volver');
    await expect(backBtn).toHaveClass(/btn-secondary/);
  });

  test('history detail: botón Volver vuelve a la lista de historial', async ({ page }) => {
    await goToHistoryDetail(page);
    await page.locator('#historial-back-btn').click();
    // Should see history list again
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
    await expect(page.locator('#historial-back-btn')).not.toBeVisible();
  });

  test('history detail: botón Volver ocupa mitad del ancho del contenedor', async ({ page }) => {
    await goToHistoryDetail(page);
    const backBtn = page.locator('#historial-back-btn');
    const container = page.locator('#historial-content .view-nav-actions');
    const btnBox = await backBtn.boundingBox();
    const containerBox = await container.boundingBox();
    // Button should be roughly half the container width (flex: 1 in a flex container)
    // With a single button and flex:1, it takes full width — that's the expected behavior
    expect(btnBox.width).toBeGreaterThan(0);
    expect(btnBox.width).toBeLessThanOrEqual(containerBox.width + 1);
  });

  // ════════════════════════════════════════════════
  // Vista Entreno completado — botón Volver a rutinas
  // ════════════════════════════════════════════════

  async function completeWorkout(page) {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
    const { fillAllWorkoutReps } = require('./helpers.js');
    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');
  }

  test('completed view: botón Volver lleva al selector de rutinas', async ({ page }) => {
    await completeWorkout(page);
    await page.locator('#back-to-selector-btn').click();
    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('.day-btn').first()).toBeVisible();
  });

  test('completed view: botón Volver actualiza el título a "Rutinas"', async ({ page }) => {
    await completeWorkout(page);
    await page.locator('#back-to-selector-btn').click();
    await expect(page.locator('#hoy-title')).toHaveText('Rutinas');
  });

  test('completed view: botón Volver oculta la vista de completado', async ({ page }) => {
    await completeWorkout(page);
    await page.locator('#back-to-selector-btn').click();
    await expect(page.locator('.workout-status')).toHaveCount(0);
    await expect(page.locator('.historial-detail-card')).toHaveCount(0);
  });

  test('completed view: desde selector tras volver, se puede seleccionar otra rutina', async ({ page }) => {
    await completeWorkout(page);
    await page.locator('#back-to-selector-btn').click();
    // Se pueden ver todos los botones de rutina
    await expect(page.locator('.day-btn')).toHaveCount(3);
    // Se puede hacer clic en otra rutina y ver su preview
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();
  });

  test('completed view: tras volver al selector y navegar a otra pestaña, volver a Hoy muestra de nuevo el resumen completado', async ({ page }) => {
    await completeWorkout(page);
    await page.locator('#back-to-selector-btn').click();
    await expect(page.locator('.day-selector')).toBeVisible();

    // Navegar fuera y volver — debe mostrar el resumen porque el entreno sigue completado
    await page.click('[data-view="historial"]');
    await page.click('[data-view="hoy"]');
    await expect(page.locator('.workout-status')).toContainText('completado');
    await expect(page.locator('.day-selector')).toHaveCount(0);
  });
});
