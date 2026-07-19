const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

// Fixture DIA1 = [press_banca(0), curl_biceps(1), ejercicio_sin_historial(2)]
// Regresión: al sustituir/quitar la card abierta, NO debe quedar abierta la
// card que ocupa ese índice después de la mutación (era un fallback por índice).

test.describe('Estado abierto de card tras swap / quitar / añadir', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startDia1(page) {
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  async function openCard(page, idx) {
    await page.locator('.card-header').nth(idx).click();
    await expect(page.locator(`#body-${idx}`)).toHaveClass(/open/);
  }

  test('swap de la card abierta: queda abierta esa card con el nuevo ejercicio, no la siguiente', async ({ page }) => {
    await startDia1(page);
    await openCard(page, 1); // curl_biceps abierto

    await page.locator('[data-action="swapExercise"][data-logidx="1"]').click();
    await expect(page.locator('#modal-title')).toContainText('Cambiar ejercicio');
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Sentadilla' }).click();

    // La card 1 sigue abierta y ahora muestra el nuevo ejercicio
    await expect(page.locator('#w-title-1')).toContainText('Sentadilla');
    await expect(page.locator('#body-1')).toHaveClass(/open/);
    // Exactamente una abierta; la siguiente (idx 2) NO se abre sola
    await expect(page.locator('.card-body.open')).toHaveCount(1);
    await expect(page.locator('#body-2')).not.toHaveClass(/open/);
    await expect(page.locator('#body-0')).not.toHaveClass(/open/);
  });

  test('quitar la card abierta: no queda ninguna abierta (la siguiente no se abre sola)', async ({ page }) => {
    await startDia1(page);
    await openCard(page, 1); // curl_biceps abierto

    await page.locator('[data-action="removeExercise"][data-exerciseid="curl_biceps"]').click();
    await page.locator('#modal-actions .btn-danger').click();

    // Quedan 2 cards; idx 1 ahora es ejercicio_sin_historial (desplazado desde idx 2)
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(2);
    await expect(page.locator('#w-title-1')).toContainText('Ejercicio Sin Historial');
    // Ninguna abierta — la card desplazada a idx 1 NO debe quedar abierta
    await expect(page.locator('.card-body.open')).toHaveCount(0);
    await expect(page.locator('#body-1')).not.toHaveClass(/open/);
  });

  test('añadir ejercicio mantiene abierta la card actual y añade la nueva cerrada', async ({ page }) => {
    await startDia1(page);
    await openCard(page, 0); // press_banca abierto

    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-title')).toContainText('Añadir');
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Sentadilla' }).click();

    // press_banca sigue abierto; la nueva card (al final) está cerrada
    await expect(page.locator('#body-0')).toHaveClass(/open/);
    await expect(page.locator('.card-body.open')).toHaveCount(1);
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(4);
    await expect(page.locator('#body-3')).not.toHaveClass(/open/);
  });

  test('reordenar mantiene abierta la card por ejercicio, no por índice', async ({ page }) => {
    await startDia1(page);
    await openCard(page, 0); // press_banca abierto (idx 0)

    // Mover press_banca de idx 0 a idx 2
    await page.evaluate(() => GymCompanion.reorderExercises('DIA1', 0, 2));

    // press_banca ahora en idx 2 y sigue abierto; idx 0 (curl_biceps) cerrado
    await expect(page.locator('#w-title-2')).toContainText('Press Banca');
    await expect(page.locator('#body-2')).toHaveClass(/open/);
    await expect(page.locator('.card-body.open')).toHaveCount(1);
    await expect(page.locator('#body-0')).not.toHaveClass(/open/);
  });
});
