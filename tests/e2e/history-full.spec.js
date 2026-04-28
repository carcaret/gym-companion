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
});
