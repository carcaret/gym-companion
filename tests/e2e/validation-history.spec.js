const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Validación en edición de Historial', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    // Navigate to historial
    await page.click('[data-view="historial"]');
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function openFirstEntryAndEdit(page) {
    // Click first history entry
    await page.locator('.historial-entry-btn').first().click();
    await expect(page.locator('#historial-content')).toBeVisible();

    // Click edit button (✏️) on first exercise
    const editBtn = page.locator('.historial-edit-btn').first();
    await editBtn.click();

    // Should be in edit mode (card has class editing)
    await expect(page.locator('.historial-detail-card.editing')).toBeVisible();
  }

  test('editar entry → vaciar una rep → click ✅ → se bloquea + input-error', async ({ page }) => {
    await openFirstEntryAndEdit(page);

    // Clear first rep
    const repInput = page.locator('#h-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Click save (✅)
    const saveBtn = page.locator('.historial-edit-btn').first();
    await saveBtn.click();

    // Should still be in edit mode (blocked)
    await expect(page.locator('.historial-detail-card.editing')).toBeVisible();

    // Rep input should have error class
    await expect(repInput).toHaveClass(/input-error/);
  });

  test('editar entry → vaciar una rep → rellenarla → click ✅ → se cierra ok', async ({ page }) => {
    await openFirstEntryAndEdit(page);

    // Clear first rep
    const repInput = page.locator('#h-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Try to save - should block
    const saveBtn = page.locator('.historial-edit-btn').first();
    await saveBtn.click();
    await expect(page.locator('.historial-detail-card.editing')).toBeVisible();

    // Fix the rep
    await repInput.fill('10');
    await repInput.dispatchEvent('change');

    // Now save should work
    await saveBtn.click();
    await expect(page.locator('.historial-detail-card.editing')).not.toBeVisible();
  });

  test('editar entry → todo correcto → se cierra normalmente', async ({ page }) => {
    await openFirstEntryAndEdit(page);

    // All reps should already be filled from fixture data
    // Click save (✅)
    const saveBtn = page.locator('.historial-edit-btn').first();
    await saveBtn.click();

    // Edit mode should close
    await expect(page.locator('.historial-detail-card.editing')).not.toBeVisible();
  });

  test('editar entry → toast de warning al intentar guardar con errores', async ({ page }) => {
    await openFirstEntryAndEdit(page);

    // Clear a rep
    const repInput = page.locator('#h-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Try to save
    const saveBtn = page.locator('.historial-edit-btn').first();
    await saveBtn.click();

    // Toast should show warning
    await expect(page.locator('.toast')).toContainText('Corrige los campos');
  });
});
