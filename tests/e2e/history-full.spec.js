const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Historial completo', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.click('[data-view="historial"]');
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('click en entry muestra detalle con ejercicios', async ({ page }) => {
    const firstEntry = page.locator('.historial-entry-btn').first();
    await expect(firstEntry).toBeVisible();
    await firstEntry.click();

    await expect(page.locator('.historial-detail-card').first()).toBeVisible();
  });

  test('detalle muestra peso, series, reps por ejercicio', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    const content = page.locator('#historial-content');
    await expect(content).toContainText('kg');
    await expect(content).toContainText(/\d+×\d+/);
  });

  test('tap en card expande y muestra controles de edicion', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    const cardHeader = page.locator('.historial-detail-card .card-header').first();
    await cardHeader.click();

    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();
    await expect(page.locator('.historial-detail-card .param-input').first()).toBeVisible();
  });

  test('segundo tap en card colapsa el body', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    const cardHeader = page.locator('.historial-detail-card .card-header').first();
    await cardHeader.click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    await cardHeader.click();
    await expect(page.locator('.historial-detail-card .card-body.open')).toHaveCount(0);
  });

  test('boton Guardar no aparece antes de modificar nada', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    const cardHeader = page.locator('.historial-detail-card .card-header').first();
    await cardHeader.click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    await expect(page.locator('.historial-save-btn')).toHaveCount(0);
  });

  test('boton Guardar aparece al modificar un valor', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const weightInput = page.locator('.card-body.open .param-input').first();
    await weightInput.fill('75');
    await weightInput.dispatchEvent('change');

    await expect(page.locator('.historial-save-btn').first()).toBeVisible();
  });

  test('guardar actualiza subtitulo y colapsa la card', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    await weightInput.fill('75');
    await weightInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();

    await expect(page.locator('.historial-detail-card .card-body.open')).toHaveCount(0);
    await expect(page.locator('#historial-content')).toContainText('75');
  });

  test('colapsar sin guardar descarta cambios y muestra valor original al reexpandir', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    const cardHeader = page.locator('.historial-detail-card .card-header').first();
    await cardHeader.click();

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    const originalValue = await weightInput.inputValue();
    await weightInput.fill('999');
    await weightInput.dispatchEvent('change');

    await expect(page.locator('.historial-save-btn').first()).toBeVisible();

    // Colapsar sin guardar
    await cardHeader.click();
    await expect(page.locator('.historial-detail-card .card-body.open')).toHaveCount(0);

    // Esperar la animacion y re-render
    await page.waitForTimeout(400);

    // Reexpandir
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const restoredInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    await expect(restoredInput).toHaveValue(originalValue);
  });

  test('navegar atras sin guardar descarta cambios', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    const originalValue = await weightInput.inputValue();
    await weightInput.fill('999');
    await weightInput.dispatchEvent('change');

    await page.locator('#historial-back-btn').click();
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();

    // Reabrir mismo dia
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const restoredInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    await expect(restoredInput).toHaveValue(originalValue);
  });

  test('eliminar entry confirmar desaparece de la lista', async ({ page }) => {
    const entries = page.locator('.historial-entry-btn');
    const initialCount = await entries.count();

    await page.locator('.historial-delete-btn').first().click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');
    await expect(page.locator('#modal-title')).toContainText('Borrar');

    await page.locator('#modal-actions .btn-danger').click();

    const newCount = await page.locator('.historial-entry-btn').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('eliminar entry cancelar sigue en la lista', async ({ page }) => {
    const entries = page.locator('.historial-entry-btn');
    const initialCount = await entries.count();

    await page.locator('.historial-delete-btn').first().click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    await page.locator('#modal-actions .btn-secondary').click();

    const newCount = await page.locator('.historial-entry-btn').count();
    expect(newCount).toBe(initialCount);
  });

  test('volver desde detalle vuelve a la lista', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await expect(page.locator('#historial-back-btn')).toBeVisible();

    await page.locator('#historial-back-btn').click();

    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
  });

  test('navegar a entry A → volver → entry B no muestra datos de A', async ({ page }) => {
    const entries = page.locator('.historial-entry-btn');
    await expect(entries).toHaveCount(3);

    // Entry 0 = 2024-01-10, DIA2, solo Sentadilla
    await entries.nth(0).click();
    const titlesDia2 = page.locator('.historial-detail-card .card-title');
    await expect(titlesDia2).toHaveCount(1);
    await expect(titlesDia2.first()).toContainText('Sentadilla');

    // Volver a la lista
    await page.locator('#historial-back-btn').click();
    await expect(entries).toHaveCount(3);

    // Entry 1 = 2024-01-08, DIA1, Press Banca + Curl Bíceps
    await entries.nth(1).click();
    const titlesDia1 = page.locator('.historial-detail-card .card-title');
    await expect(titlesDia1).toHaveCount(2);
    await expect(titlesDia1.nth(0)).toContainText('Press Banca');
    await expect(titlesDia1.nth(1)).toContainText('Curl Bíceps');
    // No debe quedar rastro de Sentadilla
    await expect(page.locator('.historial-detail-card .card-title', { hasText: 'Sentadilla' })).toHaveCount(0);
  });

  test('subtitulo se actualiza al modificar peso sin guardar', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const subtitleBefore = await page.locator('.historial-detail-card .card-subtitle').first().textContent();
    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    await weightInput.fill('123');
    await weightInput.dispatchEvent('change');

    const subtitleAfter = await page.locator('.historial-detail-card .card-subtitle').first().textContent();
    expect(subtitleAfter).toContain('123');
    expect(subtitleAfter).not.toBe(subtitleBefore);
  });

  test('boton + de peso actualiza el input de peso', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    const initialValue = parseFloat(await weightInput.inputValue());

    await page.locator('[data-action="adjustParam"][data-param="weight"][data-delta="2.5"]').first().click();

    await expect(weightInput).toHaveValue(String(initialValue + 2.5));
  });

  test('boton - de peso actualiza el input de peso', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    const initialValue = parseFloat(await weightInput.inputValue());

    await page.locator('[data-action="adjustParam"][data-param="weight"][data-delta="-2.5"]').first().click();

    await expect(weightInput).toHaveValue(String(Math.max(0, initialValue - 2.5)));
  });

  test('boton + de series actualiza el input de series', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const seriesInput = page.locator('.card-body.open [id^="h-series-"]').first();
    const initialValue = parseInt(await seriesInput.inputValue());

    await page.locator('[data-action="adjustParam"][data-param="series"][data-delta="1"]').first().click();

    await expect(seriesInput).toHaveValue(String(initialValue + 1));
  });

  test('chip de serie en historial abre chip strip y permite cambiar rep', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    // Click S1 chip to open the chip strip
    await page.locator('#h-rep-0-0').click();
    await expect(page.locator('.chip-strip').first()).toBeVisible();

    // Select a different rep value
    const chipToClick = page.locator('.chip-strip .chip').first();
    const newValue = await chipToClick.textContent();
    await chipToClick.click();

    // h-rep-0-0 shows the selected value and card is dirty
    await expect(page.locator('#h-rep-0-0')).toHaveText(newValue.trim());
    await expect(page.locator('.historial-save-btn').first()).toBeVisible();
  });
});
