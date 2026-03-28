const { test, expect } = require('@playwright/test');
const { injectTestDB, injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Ajustes y configuracion', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('cambiar contraseña con password correcto permite re-login', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    // Login first
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'test123');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Go to settings
    await page.click('[data-view="ajustes"]');

    // Change password
    await page.fill('#set-old-pass', 'test123');
    await page.fill('#set-new-pass', 'newpass456');
    await page.click('#change-pass-btn');

    // Should show success
    await expect(page.locator('#pass-status')).toContainText('cambiada');

    // Logout
    await page.click('#logout-btn');
    await expect(page.locator('#login-screen')).toHaveClass(/active/);

    // Re-login with new password
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'newpass456');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test('cambiar contraseña con password incorrecto muestra error', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'test123');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');

    await page.fill('#set-old-pass', 'wrongpass');
    await page.fill('#set-new-pass', 'newpass456');
    await page.click('#change-pass-btn');

    await expect(page.locator('#pass-status')).toContainText('incorrecta');
  });
});
