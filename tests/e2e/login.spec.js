const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('login correcto muestra la app', async ({ page }) => {
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'test123');
    await page.click('#login-form button[type="submit"]');

    await expect(page.locator('#app-shell')).toBeVisible();
    await expect(page.locator('#login-screen')).not.toHaveClass(/active/);
  });

  test('login incorrecto muestra error', async ({ page }) => {
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'wrongpass');
    await page.click('#login-form button[type="submit"]');

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText('incorrectos');
  });

  test('logout vuelve a pantalla de login', async ({ page }) => {
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'test123');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');
    await page.click('#logout-btn');

    await expect(page.locator('#login-screen')).toHaveClass(/active/);
  });
});
