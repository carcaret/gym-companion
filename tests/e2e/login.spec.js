/**
 * Tests de arranque — el login ha sido eliminado.
 * La app debe mostrarse directamente sin pantalla de login.
 */
const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Arranque directo (sin login)', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('la app arranca directamente sin pantalla de login', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    // Debe mostrar la app directamente
    await expect(page.locator('#app-shell')).toBeVisible();
    // No debe existir pantalla de login activa
    await expect(page.locator('#login-screen')).toHaveCount(0);
  });

  test('sin datos locales → arranca con datos por defecto (db.json)', async ({ page }) => {
    // Sin inyectar nada — carga db.json por defecto
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    // La vista de Rutinas debe cargarse
    await expect(page.locator('#hoy-title')).toBeVisible();
  });

  test('la vista inicial es Rutinas', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#hoy-title')).toContainText('Rutinas');
  });

  test('el indicador de sync es visible en el header', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#sync-status-btn')).toBeVisible();
  });

  test('sin GitHub configurado → indicador en estado ok (sin GitHub = neutral)', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    const state = await page.locator('#sync-status-btn').getAttribute('data-state');
    expect(state).toBe('ok');
  });
});
