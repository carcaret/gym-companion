import { test, expect } from '@playwright/test';
import { seedLoggedIn, seedForLogin } from './fixtures/seed';

test.describe('Autenticación', () => {

  test('la pantalla de login se muestra al arrancar sin sesión', async ({ page }) => {
    await seedForLogin(page);
    await page.goto('/');

    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#app-shell')).toBeHidden();
  });

  test('el mensaje de error está oculto en carga inicial', async ({ page }) => {
    await seedForLogin(page);
    await page.goto('/');

    await expect(page.locator('#login-error')).toBeHidden();
  });

  test('login correcto → muestra la app y oculta el login', async ({ page }) => {
    await seedForLogin(page);
    await page.goto('/');

    await page.fill('#login-user', 'test');
    await page.fill('#login-pass', 'test1234');
    await page.click('#login-btn');

    await expect(page.locator('#app-shell')).toBeVisible();
    await expect(page.locator('#login-screen')).toBeHidden();
  });

  test('login con contraseña incorrecta → muestra mensaje de error', async ({ page }) => {
    await seedForLogin(page);
    await page.goto('/');

    await page.fill('#login-user', 'test');
    await page.fill('#login-pass', 'wrongpassword');
    await page.click('#login-btn');

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText('incorrectos');
    await expect(page.locator('#app-shell')).toBeHidden();
  });

  test('login con usuario incorrecto → muestra mensaje de error', async ({ page }) => {
    await seedForLogin(page);
    await page.goto('/');

    await page.fill('#login-user', 'noexiste');
    await page.fill('#login-pass', 'test1234');
    await page.click('#login-btn');

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#app-shell')).toBeHidden();
  });

  test('auto-login con sesión en localStorage → salta el login', async ({ page }) => {
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('#app-shell')).toBeVisible();
    await expect(page.locator('#login-screen')).toBeHidden();
  });

  test('logout → vuelve a la pantalla de login', async ({ page }) => {
    await seedLoggedIn(page);
    await page.goto('/');

    await page.click('[data-view="ajustes"]');
    await page.click('#logout-btn');

    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#app-shell')).toBeHidden();
  });

});
