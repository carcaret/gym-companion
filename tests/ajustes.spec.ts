import { test, expect } from '@playwright/test';
import { seedLoggedIn } from './fixtures/seed';

test.describe('Vista Ajustes', () => {

  test.beforeEach(async ({ page }) => {
    await seedLoggedIn(page);
    await page.goto('/');
    await page.click('[data-view="ajustes"]');
  });

  test.describe('Estructura de la vista', () => {

    test('la sección GitHub API está visible', async ({ page }) => {
      await expect(page.locator('#set-repo')).toBeVisible();
      await expect(page.locator('#set-branch')).toBeVisible();
      await expect(page.locator('#set-pat')).toBeVisible();
      await expect(page.locator('#save-github-btn')).toBeVisible();
      await expect(page.locator('#test-github-btn')).toBeVisible();
    });

    test('la sección Cambiar contraseña está visible', async ({ page }) => {
      await expect(page.locator('#set-old-pass')).toBeVisible();
      await expect(page.locator('#set-new-pass')).toBeVisible();
      await expect(page.locator('#change-pass-btn')).toBeVisible();
    });

    test('la sección Datos está visible', async ({ page }) => {
      await expect(page.locator('#export-btn')).toBeVisible();
      await expect(page.locator('#import-file')).toBeAttached();
    });

    test('el botón Cerrar sesión está visible', async ({ page }) => {
      await expect(page.locator('#logout-btn')).toBeVisible();
    });

    test('los mensajes de estado están ocultos inicialmente', async ({ page }) => {
      await expect(page.locator('#pass-status')).toBeHidden();
      await expect(page.locator('#github-status')).toBeHidden();
    });

  });

  test.describe('Cambiar contraseña', () => {

    test('contraseña actual incorrecta → muestra error', async ({ page }) => {
      await page.fill('#set-old-pass', 'wrongpassword');
      await page.fill('#set-new-pass', 'nuevapass123');
      await page.click('#change-pass-btn');

      await expect(page.locator('#pass-status')).toBeVisible();
      await expect(page.locator('#pass-status')).toContainText('incorrecta');
    });

    test('contraseña actual correcta → muestra éxito', async ({ page }) => {
      await page.fill('#set-old-pass', 'test1234');
      await page.fill('#set-new-pass', 'nuevapass123');
      await page.click('#change-pass-btn');

      await expect(page.locator('#pass-status')).toBeVisible();
      await expect(page.locator('#pass-status')).toContainText('correctamente');
    });

    test('tras cambio exitoso los campos quedan vacíos', async ({ page }) => {
      await page.fill('#set-old-pass', 'test1234');
      await page.fill('#set-new-pass', 'nuevapass123');
      await page.click('#change-pass-btn');

      await expect(page.locator('#pass-status')).toContainText('correctamente');
      await expect(page.locator('#set-old-pass')).toHaveValue('');
      await expect(page.locator('#set-new-pass')).toHaveValue('');
    });

  });

  test.describe('Exportar datos', () => {

    test('click en Exportar JSON dispara una descarga', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      await page.click('#export-btn');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/gym_companion_backup.*\.json/);
    });

  });

  test.describe('Configuración GitHub', () => {

    test('campo rama tiene valor "main" por defecto', async ({ page }) => {
      await expect(page.locator('#set-branch')).toHaveValue('main');
    });

    test('campo ruta tiene valor "db.json" por defecto', async ({ page }) => {
      await expect(page.locator('#set-path')).toHaveValue('db.json');
    });

  });

  test.describe('Logout', () => {

    test('cerrar sesión navega a la pantalla de login', async ({ page }) => {
      await page.click('#logout-btn');

      await expect(page.locator('#login-screen')).toBeVisible();
      await expect(page.locator('#app-shell')).toBeHidden();
    });

    test('tras logout los campos de login están vacíos', async ({ page }) => {
      await page.click('#logout-btn');

      await expect(page.locator('#login-user')).toHaveValue('');
      await expect(page.locator('#login-pass')).toHaveValue('');
    });

  });

});
