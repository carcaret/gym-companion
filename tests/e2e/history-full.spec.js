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

    // Should show exercise detail cards
    await expect(page.locator('.historial-detail-card').first()).toBeVisible();
  });

  test('detalle muestra peso, series, reps por ejercicio', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    const content = page.locator('#historial-content');
    // Should contain weight info
    await expect(content).toContainText('kg');
    // Should contain series x reps format
    await expect(content).toContainText(/\d+×\d+/);
  });

  test('click en editar muestra controles de edicion', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();

    // Click edit button
    const editBtn = page.locator('.historial-edit-btn').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Should show editing controls (param-row with inputs)
    await expect(page.locator('.historial-detail-card.editing')).toBeVisible();
    await expect(page.locator('.historial-detail-card.editing .param-input').first()).toBeVisible();
  });

  test('editar peso en historial y verificar cambio', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-edit-btn').first().click();

    // Find the weight input and change it
    const weightInput = page.locator('.historial-detail-card.editing .param-input').first();
    await weightInput.fill('75');
    await weightInput.dispatchEvent('change');

    // Click the checkmark to save/close edit mode
    await page.locator('.historial-detail-card.editing .historial-edit-btn').click();

    // Should show updated weight
    await expect(page.locator('#historial-content')).toContainText('75');
  });

  test('eliminar entry confirmar desaparece de la lista', async ({ page }) => {
    const entries = page.locator('.historial-entry-btn');
    const initialCount = await entries.count();

    // Click delete on first entry
    await page.locator('.historial-delete-btn').first().click();

    // Modal should appear
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');
    await expect(page.locator('#modal-title')).toContainText('Borrar');

    // Click "Borrar" button
    await page.locator('#modal-actions .btn-danger').click();

    // Should have one fewer entry
    const newCount = await page.locator('.historial-entry-btn').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('eliminar entry cancelar sigue en la lista', async ({ page }) => {
    const entries = page.locator('.historial-entry-btn');
    const initialCount = await entries.count();

    await page.locator('.historial-delete-btn').first().click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    // Click "Cancelar"
    await page.locator('#modal-actions .btn-secondary').click();

    // Count should remain the same
    const newCount = await page.locator('.historial-entry-btn').count();
    expect(newCount).toBe(initialCount);
  });

  test('filtro Día 1 muestra solo entries de Día 1', async ({ page }) => {
    const dia1Filter = page.locator('.filter-btn', { hasText: 'Día 1' });
    await dia1Filter.click();

    const entries = page.locator('.historial-entry-btn');
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // All visible entries should be Día 1
    for (let i = 0; i < count; i++) {
      await expect(entries.nth(i)).toContainText('Día 1');
    }
  });

  test('filtro Todos muestra todos los entries', async ({ page }) => {
    // First filter to Día 1
    await page.locator('.filter-btn', { hasText: 'Día 1' }).click();
    const dia1Count = await page.locator('.historial-entry-btn').count();

    // Then switch to Todos
    await page.locator('.filter-btn', { hasText: 'Todos' }).click();
    const todosCount = await page.locator('.historial-entry-btn').count();

    expect(todosCount).toBeGreaterThanOrEqual(dia1Count);
  });

  test('volver desde detalle vuelve a la lista', async ({ page }) => {
    await page.locator('.historial-entry-btn').first().click();
    await expect(page.locator('#historial-back-btn')).toBeVisible();

    await page.locator('#historial-back-btn').click();

    // Should see list again
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
  });
});
