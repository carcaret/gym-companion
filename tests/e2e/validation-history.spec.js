const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Validación en edición de Historial', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.click('[data-view="historial"]');
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function openFirstEntryAndExpand(page) {
    await page.locator('.historial-entry-btn').first().click();
    await expect(page.locator('#historial-content')).toBeVisible();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();
  }

  test('expandir entry → vaciar rep → click Guardar → se bloquea + input-error', async ({ page }) => {
    await openFirstEntryAndExpand(page);

    const repInput = page.locator('#h-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();

    // Card debe seguir abierta
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();
    await expect(repInput).toHaveClass(/input-error/);
  });

  test('expandir entry → vaciar rep → rellenarla → click Guardar → se cierra ok', async ({ page }) => {
    await openFirstEntryAndExpand(page);

    const repInput = page.locator('#h-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    await repInput.fill('10');
    await repInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open')).toHaveCount(0);
  });

  test('expandir entry → todo correcto → guardar se cierra normalmente', async ({ page }) => {
    await openFirstEntryAndExpand(page);

    // Modificar un valor para que aparezca Guardar
    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    const original = await weightInput.inputValue();
    await weightInput.fill(String(parseInt(original) + 5));
    await weightInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open')).toHaveCount(0);
  });

  test('entry con reps.actual vacío → al expandir se rellenan con expected', async ({ page }) => {
    // El fixture tiene un entry en 2024-01-05 con reps.actual = []
    const entries = page.locator('.historial-entry-btn');
    await entries.last().click();

    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    const repInput = page.locator('#h-rep-0-0');
    await expect(repInput).toHaveValue('10');
  });

  test('entry con reps.actual vacío → colapsar sin guardar → reexpandir → sigue rellenando con expected', async ({ page }) => {
    const entries = page.locator('.historial-entry-btn');
    await entries.last().click();

    const cardHeader = page.locator('.historial-detail-card .card-header').first();
    await cardHeader.click();
    await expect(page.locator('#h-rep-0-0')).toHaveValue('10');

    // Colapsar sin guardar
    await cardHeader.click();
    await page.waitForTimeout(400);

    // Reexpandir: debe volver a rellenar con expected
    await cardHeader.click();
    await expect(page.locator('#h-rep-0-0')).toHaveValue('10');
  });

  test('expandir entry → toast de warning al intentar guardar con errores', async ({ page }) => {
    await openFirstEntryAndExpand(page);

    const repInput = page.locator('#h-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();

    await expect(page.locator('.toast')).toContainText('Corrige los campos');
  });

  test('guardar persiste cambio en localStorage', async ({ page }) => {
    await openFirstEntryAndExpand(page);

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    await weightInput.fill('77');
    await weightInput.dispatchEvent('change');

    await page.locator('.historial-save-btn').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open')).toHaveCount(0);

    // El primer entry mostrado es 2024-01-10 — buscar por fecha, no por índice
    const stored = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.find(h => h.date === '2024-01-10').logs[0].weight;
    });
    expect(stored).toBe(77);
  });

  test('colapsar sin guardar NO persiste cambio en localStorage', async ({ page }) => {
    await openFirstEntryAndExpand(page);

    const weightInput = page.locator('.card-body.open [id^="h-weight-"]').first();
    const originalValue = await weightInput.inputValue();
    await weightInput.fill('999');
    await weightInput.dispatchEvent('change');

    const cardHeader = page.locator('.historial-detail-card .card-header').first();
    await cardHeader.click();
    await page.waitForTimeout(400);

    // El primer entry mostrado es 2024-01-10 — buscar por fecha, no por índice
    const stored = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.find(h => h.date === '2024-01-10').logs[0].weight;
    });
    expect(String(stored)).toBe(originalValue);
  });
});
