const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

test.describe('Vista de entreno completado', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function completeWorkout(page) {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const startBtn = page.locator('#start-workout-btn');
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');
  }

  test('el mensaje de completado usa color accent (no verde)', async ({ page }) => {
    await completeWorkout(page);

    const status = page.locator('.workout-status');
    // No debe tener estilos inline que fuercen verde
    const style = await status.getAttribute('style');
    expect(style).toBeNull();

    // El checkmark usa clase CSS con color accent (no inline style)
    const checkmark = status.locator('.workout-status-icon');
    await expect(checkmark).toHaveCount(1);
    const color = await checkmark.evaluate(el => getComputedStyle(el).color);
    // --accent: #569cd6 → rgb(86, 156, 214)
    expect(color).toBe('rgb(86, 156, 214)');
  });

  test('las cards usan formato de historial (compact-card + card-title/subtitle)', async ({ page }) => {
    await completeWorkout(page);

    const cards = page.locator('.historial-detail-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Cada card debe ser compact-card
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card).toHaveClass(/compact-card/);
    }

    // Cada card debe tener card-title y card-subtitle
    const titles = page.locator('.historial-detail-card .card-title');
    const subtitles = page.locator('.historial-detail-card .card-subtitle');
    expect(await titles.count()).toBe(count);
    expect(await subtitles.count()).toBe(count);
  });

  test('las cards NO tienen botón de editar', async ({ page }) => {
    await completeWorkout(page);

    const editBtns = page.locator('.historial-detail-card .historial-edit-btn');
    await expect(editBtns).toHaveCount(0);
  });

  test('las cards NO usan meta-pills con emojis', async ({ page }) => {
    await completeWorkout(page);

    const metaPills = page.locator('.meta-pill');
    await expect(metaPills).toHaveCount(0);
  });

  test('el subtitle muestra peso, series y reps formateados', async ({ page }) => {
    await completeWorkout(page);

    // Press Banca should show weight and series info
    const firstSubtitle = page.locator('.historial-detail-card .card-subtitle').first();
    const text = await firstSubtitle.textContent();
    // Should contain series×reps format (e.g. "60 kg · 3×10")
    expect(text).toMatch(/\d+×\d+/);
  });

  test('toast de inicio no tiene emoji', async ({ page }) => {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const startBtn = page.locator('#start-workout-btn');
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(startBtn).toBeVisible();

    // Listen for the toast
    await startBtn.click();
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    const toastText = await toast.textContent();
    expect(toastText).not.toContain('💪');
    expect(toastText).toContain('¡Entreno iniciado!');
  });

  test('toast de fin no tiene emoji', async ({ page }) => {
    await completeWorkout(page);

    // The toast should appear after completing
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    const toastText = await toast.textContent();
    expect(toastText).not.toContain('🎉');
    expect(toastText).toContain('¡Entreno completado!');
  });

  test('la vista completada coincide en estructura con el detalle del historial', async ({ page }) => {
    await completeWorkout(page);

    // Verify completed view structure while it's visible
    const completedCards = page.locator('#view-hoy .historial-detail-card');
    const completedCount = await completedCards.count();
    expect(completedCount).toBeGreaterThan(0);

    const completedClasses = await completedCards.first().getAttribute('class');
    expect(completedClasses).toContain('compact-card');
    expect(completedClasses).toContain('historial-detail-card');
    await expect(page.locator('#view-hoy .historial-detail-card .card-title').first()).toBeVisible();
    await expect(page.locator('#view-hoy .historial-detail-card .card-subtitle').first()).toBeVisible();

    // Navigate to history and open a detail
    await page.click('[data-view="historial"]');
    const historyEntry = page.locator('.historial-entry-btn').first();
    await expect(historyEntry).toBeVisible();
    await historyEntry.click();

    // Verify history detail uses same structure
    const historyCards = page.locator('#view-historial .historial-detail-card');
    const historyCount = await historyCards.count();
    expect(historyCount).toBeGreaterThan(0);

    const historyClasses = await historyCards.first().getAttribute('class');
    expect(historyClasses).toContain('compact-card');
    expect(historyClasses).toContain('historial-detail-card');
    await expect(page.locator('#view-historial .historial-detail-card .card-title').first()).toBeVisible();
    await expect(page.locator('#view-historial .historial-detail-card .card-subtitle').first()).toBeVisible();
  });

  test('no hay botón Cerrar en la vista de completado', async ({ page }) => {
    await completeWorkout(page);

    await expect(page.locator('#completed-close-btn')).toHaveCount(0);
  });

  test('navegar entre múltiples pestañas y volver muestra el selector (no el resumen)', async ({ page }) => {
    await completeWorkout(page);

    // Navegar a ajustes y volver
    await page.click('[data-view="ajustes"]');
    await page.click('[data-view="hoy"]');
    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('.workout-status')).toHaveCount(0);

    // Navegar a gráficas y volver
    await page.click('[data-view="graficas"]');
    await page.click('[data-view="hoy"]');
    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('.workout-status')).toHaveCount(0);
  });

  test('navegar a otra pestaña y volver muestra el selector (no el resumen completado)', async ({ page }) => {
    await completeWorkout(page);

    await page.click('[data-view="historial"]');
    await expect(page.locator('#view-historial')).toBeVisible();
    await page.click('[data-view="hoy"]');

    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('.workout-status')).toHaveCount(0);
  });

  // ════════════════════════════════════════════════
  // Botón "← Volver a rutinas" en vista completado
  // ════════════════════════════════════════════════

  test('vista completada: existe botón #back-to-selector-btn', async ({ page }) => {
    await completeWorkout(page);
    await expect(page.locator('#back-to-selector-btn')).toBeVisible();
  });

  test('vista completada: botón Volver tiene texto "← Volver a rutinas"', async ({ page }) => {
    await completeWorkout(page);
    await expect(page.locator('#back-to-selector-btn')).toContainText('← Volver a rutinas');
  });

  test('vista completada: botón Volver tiene clase btn-secondary', async ({ page }) => {
    await completeWorkout(page);
    await expect(page.locator('#back-to-selector-btn')).toHaveClass(/btn-secondary/);
  });

  test('vista completada: botón Volver está dentro de view-nav-actions', async ({ page }) => {
    await completeWorkout(page);
    const container = page.locator('#view-hoy .view-nav-actions');
    await expect(container).toBeVisible();
    await expect(container.locator('#back-to-selector-btn')).toBeVisible();
  });

  test('vista completada: view-nav-actions solo tiene un botón (ocupa ancho completo)', async ({ page }) => {
    await completeWorkout(page);
    const container = page.locator('#view-hoy .view-nav-actions');
    await expect(container.locator('button')).toHaveCount(1);
  });

  test('vista completada: botón Volver ocupa el ancho del contenedor (flex: 1)', async ({ page }) => {
    await completeWorkout(page);
    const btn = page.locator('#view-hoy #back-to-selector-btn');
    const container = page.locator('#view-hoy .view-nav-actions');
    const btnBox = await btn.boundingBox();
    const containerBox = await container.boundingBox();
    // Con un único botón y flex:1, debe ocupar (casi) todo el ancho
    expect(btnBox.width).toBeGreaterThan(containerBox.width * 0.9);
  });

  test('durante el entreno activo NO existe el botón Volver a rutinas', async ({ page }) => {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    await expect(page.locator('#back-to-selector-btn')).toHaveCount(0);
  });

  // ════════════════════════════════════════════════
  // Comportamiento post-completado sin flag
  // ════════════════════════════════════════════════

  test('tras pulsar Volver, aparece el selector de rutinas con título "Rutinas"', async ({ page }) => {
    await completeWorkout(page);
    await page.locator('#back-to-selector-btn').click();

    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('.workout-status')).toHaveCount(0);
    await expect(page.locator('#hoy-title')).toHaveText('Rutinas');
  });

  test('sin pulsar Volver, el resumen sigue visible al recargar la vista (botón Volver presente)', async ({ page }) => {
    await completeWorkout(page);

    // El resumen se renderizó directamente por finishWorkout — el botón Volver está visible
    await expect(page.locator('#back-to-selector-btn')).toBeVisible();
    await expect(page.locator('.workout-status')).toContainText('completado');
  });
});
